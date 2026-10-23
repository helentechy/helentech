import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startMockSupabase } from '../tools/mock-supabase.mjs';
import { startDevServer } from '../tools/dev-server.mjs';
import { buildReport, buildRealtime, summarise, rangeFromParams, toCsv, serviceOfPath, serviceOfEnquiry } from '../api/_lib/aggregate.js';
import * as classify from '../api/_lib/classify.js';
import { __limiter as collectLimiter } from '../api/collect.js';
import { __loginLimiter, __roleCache } from '../api/admin/[action].js';
import { __resetForTests as resetContact } from '../api/contact.js';

let mock, app, base, origin;
const realFetch = globalThis.fetch;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const UA_PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const id = (p) => `${p}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

before(async () => {
  mock = await startMockSupabase({ users: [{ email: 'owner@test.com', password: 'OwnerPass#1' }, { email: 'viewer@test.com', password: 'ViewerPass#1' }, { email: 'nobody@test.com', password: 'NoRole#1' }] });
  mock.addAdmin('owner@test.com', 'owner'); mock.addAdmin('viewer@test.com', 'viewer');
  process.env.SUPABASE_URL = mock.url; process.env.SUPABASE_ANON_KEY = mock.anonKey; process.env.SUPABASE_SERVICE_ROLE_KEY = mock.serviceKey;
  process.env.RESEND_API_KEY = 're_test';
  app = await startDevServer(); base = app.url; origin = base;
  // stub only the email provider; everything else (our mock Supabase, the dev server) is real HTTP
  globalThis.fetch = async (url, opts) => (String(url).startsWith('https://api.resend.com') ? { ok: globalThis.__resendOk !== false, status: globalThis.__resendOk === false ? 500 : 200, json: async () => ({ id: 'x' }) } : realFetch(url, opts));
});
after(async () => { globalThis.fetch = realFetch; await app.close(); await mock.close(); });
beforeEach(() => { collectLimiter.reset(); __loginLimiter.reset(); __roleCache.clear(); resetContact(); globalThis.__resendOk = true; });

const post = (path, body, headers = {}) => realFetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'User-Agent': UA, ...headers }, body: JSON.stringify(body) });
const pv = (o = {}) => ({ t: 'pv', sid: o.sid, vid: o.vid, pid: o.pid || id('pid'), path: '/google-ads.html', title: 'Google Ads | HelenTech', nv: true, ...o });

/* ---------------------------------------------------------------- collection */
test('collect: stores a page view, session, geo, device and traffic source (no IP, no raw user agent)', async () => {
  const sid = id('s'), vid = id('v');
  const r = await post('/api/collect', pv({ sid, vid, path: '/google-ads.html?utm=1#x', ref: 'https://www.google.com/search?q=x', us: '', um: '' }), { 'x-vercel-ip-country': 'ng', 'x-vercel-ip-city': 'Lagos', 'x-forwarded-for': '203.0.113.9' });
  assert.equal(r.status, 204);
  const s = mock.tables.analytics_sessions.find((x) => x.id === sid);
  assert.equal(s.source, 'Google (organic)'); assert.equal(s.device, 'desktop'); assert.equal(s.country, 'NG'); assert.equal(s.city, 'Lagos'); assert.equal(s.is_new_visitor, true); assert.equal(s.entry_path, '/google-ads.html');
  const p = mock.tables.analytics_pageviews.find((x) => x.session_id === sid); assert.equal(p.path, '/google-ads.html'); assert.equal(p.title, 'Google Ads | HelenTech');
  const all = JSON.stringify(mock.tables); assert.ok(!all.includes('203.0.113.9'), 'IP must not be stored'); assert.ok(!all.includes('AppleWebKit'), 'raw user agent must not be stored');
});
test('collect: duplicate page view ids are ignored, engagement only ever increases, events are allow-listed', async () => {
  const sid = id('s'), vid = id('v'), pid = id('p');
  await post('/api/collect', pv({ sid, vid, pid })); await post('/api/collect', pv({ sid, vid, pid }));
  assert.equal(mock.tables.analytics_pageviews.filter((x) => x.id === pid).length, 1);
  await post('/api/collect', { t: 'ping', sid, vid, pid, path: '/google-ads.html', ms: 20000 });
  await post('/api/collect', { t: 'eng', sid, vid, pid, path: '/google-ads.html', ms: 5000 });   // smaller value must not overwrite
  assert.equal(mock.tables.analytics_pageviews.find((x) => x.id === pid).engaged_ms, 20000);
  await post('/api/collect', { t: 'eng', sid, vid, pid, path: '/google-ads.html', ms: 99999999 });
  assert.equal(mock.tables.analytics_pageviews.find((x) => x.id === pid).engaged_ms, 1800000, 'capped at 30 minutes');
  let r = await post('/api/collect', { t: 'ev', sid, vid, path: '/google-ads.html', name: 'whatsapp_click', props: { label: 'Chat on WhatsApp', evil: { a: 1 }, 'bad key!': 'x' } });
  assert.equal(r.status, 204);
  const ev = mock.tables.analytics_events.find((e) => e.session_id === sid); assert.equal(ev.name, 'whatsapp_click'); assert.deepEqual(ev.props, { label: 'Chat on WhatsApp' });
  r = await post('/api/collect', { t: 'ev', sid, vid, path: '/x.html', name: 'enquiry_submitted' }); assert.equal(r.status, 400, 'visitors cannot fake conversions through /api/collect');
  assert.equal(mock.tables.analytics_conversions.length, 0);
});
test('collect: rejects foreign origins, bots, bad ids, admin pages; never errors for the visitor', async () => {
  const sid = id('s'), vid = id('v');
  assert.equal((await post('/api/collect', pv({ sid, vid }), { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await post('/api/collect', pv({ sid, vid }), { 'User-Agent': 'Googlebot/2.1' })).status, 204);
  assert.equal(mock.tables.analytics_sessions.filter((s) => s.id === sid).length, 0);
  assert.equal((await post('/api/collect', pv({ sid: 'x', vid }))).status, 400);
  assert.equal((await post('/api/collect', pv({ sid, vid, path: '/admin/' }))).status, 204);
  assert.equal(mock.tables.analytics_sessions.filter((s) => s.id === sid).length, 0);
  assert.equal((await realFetch(base + '/api/collect', { method: 'GET' })).status, 405);
});
test('collect: classifies devices and sources', () => {
  assert.equal(classify.device(UA_PHONE), 'mobile'); assert.equal(classify.device('Mozilla/5.0 (iPad; CPU OS 17_0)'), 'tablet'); assert.equal(classify.device(UA), 'desktop');
  assert.equal(classify.source('https://l.facebook.com/x', {}, 'helentech.com').source, 'Social');
  assert.equal(classify.source('https://www.bing.com/', {}, 'helentech.com').source, 'Other search');
  assert.equal(classify.source('https://somesite.org/post', {}, 'helentech.com').source, 'Referral');
  assert.equal(classify.source('', {}, 'helentech.com').source, 'Direct');
  assert.equal(classify.source('https://helentech.com/blog.html', {}, 'helentech.com').source, 'Direct');
  assert.equal(classify.source('https://www.google.com', { gclid: true }, 'helentech.com').source, 'Paid (Google Ads)');
});

/* ---------------------------------------------------------------- conversions */
const enquiry = (o = {}) => post('/api/contact', { name: 'Ada Obi', email: 'ada@example.com', message: 'Please review my Google Ads account.', service: 'Google Ads & Analytics', enquiryType: 'Request a Quote', fillMs: 9000, page: '/google-ads.html', formSource: 'popup', ...o });
test('conversion: recorded only after a successful enquiry, with no personal data', async () => {
  const sid = id('s'), vid = id('v'); await post('/api/collect', pv({ sid, vid }));
  const before = mock.tables.analytics_conversions.length;
  await post('/api/collect', { t: 'ev', sid, vid, path: '/google-ads.html', name: 'cta_click', props: { label: 'Contact HelenTech' } });   // a click is NOT an enquiry
  assert.equal(mock.tables.analytics_conversions.length, before);
  globalThis.__resendOk = false; mock.tables.analytics_conversions.length = before;
  let r = await enquiry({ sid, vid, message: 'This one fails to send so it must not count.' }); assert.ok([500, 502].includes(r.status));
  assert.equal(mock.tables.analytics_conversions.length, before, 'failed enquiry must not be counted');
  globalThis.__resendOk = true;
  r = await enquiry({ sid, vid, message: 'This one is delivered successfully, thank you.' }); assert.equal(r.status, 200);
  assert.equal(mock.tables.analytics_conversions.length, before + 1);
  const c = mock.tables.analytics_conversions.at(-1);
  assert.equal(c.session_id, sid); assert.equal(c.path, '/google-ads.html'); assert.equal(c.service, 'Google Ads & Analytics'); assert.equal(c.enquiry_type, 'Request a Quote'); assert.equal(c.form_source, 'popup');
  const dump = JSON.stringify(c); for (const s of ['Ada', 'ada@example.com', 'delivered successfully']) assert.ok(!dump.includes(s), 'no personal data in conversions');
});
test('conversion: still counted (unattributed) when the visitor did not accept analytics; duplicates counted once', async () => {
  const before = mock.tables.analytics_conversions.length;
  await enquiry({ message: 'Anonymous visitor enquiry, no analytics ids.' }); await enquiry({ message: 'Anonymous visitor enquiry, no analytics ids.' });
  assert.equal(mock.tables.analytics_conversions.length, before + 1);
  assert.equal(mock.tables.analytics_conversions.at(-1).session_id, null);
});

/* ---------------------------------------------------------------- admin auth + data */
const jar = (res) => (res.headers.getSetCookie ? res.headers.getSetCookie() : []).map((c) => c.split(';')[0]).join('; ');
const adminHeaders = (cookie) => ({ Origin: origin, 'X-Requested-With': 'HT-Admin', 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) });
const login = (email, password) => realFetch(base + '/api/admin/login', { method: 'POST', headers: adminHeaders(), body: JSON.stringify({ email, password }) });
const today = () => new Date().toISOString().slice(0, 10);
const get = (path, cookie) => realFetch(base + path, { headers: { Cookie: cookie || '' } });

test('admin: every data endpoint refuses visitors who are not signed in', async () => {
  for (const p of ['me', 'stats?from=2020-01-01&to=2020-01-02&tz=0', 'realtime', 'export?type=pages&from=2020-01-01&to=2020-01-02&tz=0']) assert.equal((await get('/api/admin/' + p)).status, 401, p);
  assert.equal((await get('/api/admin/me', 'ht_admin=at_forged')).status, 401);
});
test('admin: wrong password, no dashboard role, blocked requests', async () => {
  assert.equal((await login('owner@test.com', 'wrong')).status, 401);
  assert.equal((await login('nobody@test.com', 'NoRole#1')).status, 403);
  assert.equal((await realFetch(base + '/api/admin/login', { method: 'POST', headers: { ...adminHeaders(), Origin: 'https://evil.example' }, body: JSON.stringify({ email: 'owner@test.com', password: 'OwnerPass#1' }) })).status, 403);
  assert.equal((await realFetch(base + '/api/admin/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'owner@test.com', password: 'OwnerPass#1' }) })).status, 403, 'needs the custom header (CSRF)');
});
test('admin: login rate limit', async () => {
  let last; for (let i = 0; i < 7; i++) last = await login('owner@test.com', 'bad' + i); assert.equal(last.status, 429);
});
test('admin: signed-in owner sees REAL aggregated numbers from the database; logout ends the session', async () => {
  const lr = await login('owner@test.com', 'OwnerPass#1'); assert.equal(lr.status, 200);
  const raw = lr.headers.getSetCookie().join(' | '); assert.match(raw, /HttpOnly/); assert.match(raw, /SameSite=Strict/); assert.match(raw, /Path=\/api\/admin/);
  const cookie = jar(lr); assert.deepEqual(await lr.json(), { email: 'owner@test.com', role: 'owner' });
  // generate known traffic: 3 visitors, 4 sessions
  const A = { sid: id('s'), vid: id('v') }, B = { sid: id('s'), vid: id('v') }, C = { sid: id('s'), vid: id('v') }, A2 = { sid: id('s'), vid: A.vid };
  const pidA1 = id('p'), pidA2 = id('p'), pidB = id('p'), pidC = id('p');
  await post('/api/collect', pv({ ...A, pid: pidA1, path: '/', title: 'HelenTech', ref: 'https://www.google.com/' })); await post('/api/collect', { t: 'eng', ...A, pid: pidA1, path: '/', ms: 10000 });
  await post('/api/collect', pv({ ...A, pid: pidA2, path: '/google-merchant-center.html', title: 'GMC', nv: true })); await post('/api/collect', { t: 'eng', ...A, pid: pidA2, path: '/google-merchant-center.html', ms: 50000 });
  await post('/api/collect', { t: 'ev', ...A, path: '/google-merchant-center.html', name: 'whatsapp_click', props: { label: 'WhatsApp' } });
  await post('/api/collect', pv({ ...B, pid: pidB, path: '/', title: 'HelenTech', ref: 'https://l.instagram.com/' }), { 'User-Agent': UA_PHONE });
  await post('/api/collect', pv({ ...C, pid: pidC, path: '/blog.html', title: 'Blog', ref: '' }));
  await post('/api/collect', pv({ ...A2, path: '/', title: 'HelenTech', nv: false }));   // A returns later in a new session
  await enquiry({ sid: A.sid, vid: A.vid, page: '/google-merchant-center.html', service: 'Google Merchant Center Setup & Suspension Fixes', formSource: 'popup', message: 'Real enquiry message for the dashboard test.' });
  const stats = await (await get(`/api/admin/stats?from=${today()}&to=${today()}&tz=0`, cookie)).json();
  assert.ok(stats.summary.sessions >= 4); assert.ok(stats.summary.visitors >= 3);
  const home = stats.pages.find((p) => p.path === '/'); assert.ok(home.views >= 3);
  const gmc = stats.pages.find((p) => p.path === '/google-merchant-center.html'); assert.equal(gmc.views, 1); assert.equal(gmc.avgSeconds, 50); assert.equal(gmc.name, '');
  assert.ok(stats.sources.find((s) => s.source === 'Social')); assert.ok(stats.sources.find((s) => s.source === 'Google (organic)')); assert.ok(stats.devices.find((d) => d.device === 'mobile'));
  assert.ok(stats.summary.enquiries >= 1); assert.ok(stats.leads.byService.find((s) => s.key === 'Google Merchant Center'));
  assert.ok(stats.services.find((s) => s.service === 'Google Merchant Center' && s.pageViews === 1 && s.enquiries >= 1 && s.ctaClicks >= 1));
  assert.ok(stats.meta.basis.includes('accepted analytics'));
  const rt = await (await get('/api/admin/realtime', cookie)).json(); assert.ok(rt.online >= 4); assert.ok(rt.feed.some((f) => f.type === 'enquiry')); assert.ok(rt.feed.some((f) => f.type === 'pageview'));
  const bad = await get('/api/admin/stats?from=nope&to=x', cookie); assert.equal(bad.status, 400);
  const out = await realFetch(base + '/api/admin/logout', { method: 'POST', headers: adminHeaders(cookie) }); assert.equal(out.status, 200);
  assert.match(out.headers.getSetCookie().join(' '), /Max-Age=0/);
});
test('admin: owner can export CSV (formula-injection safe); viewer is read-only', async () => {
  const sid = id('s'), vid = id('v'); await post('/api/collect', pv({ sid, vid, path: '/x.html', title: '=HYPERLINK("http://evil","click")' }));
  const owner = jar(await login('owner@test.com', 'OwnerPass#1'));
  const csv = await get(`/api/admin/export?type=pages&from=${today()}&to=${today()}&tz=0`, owner); assert.equal(csv.status, 200); assert.match(csv.headers.get('content-type'), /text\/csv/); assert.match(csv.headers.get('content-disposition'), /attachment/);
  const text = await csv.text(); assert.ok(text.startsWith('Page URL,Name,Title,Views')); assert.ok(text.includes(`"'=HYPERLINK`) || text.includes(`'=HYPERLINK`), 'formula must be neutralised'); assert.ok(!/(^|,)=HYPERLINK/m.test(text));
  const viewer = jar(await login('viewer@test.com', 'ViewerPass#1'));
  assert.equal((await get('/api/admin/me', viewer)).status, 200);
  assert.equal((await get(`/api/admin/stats?from=${today()}&to=${today()}&tz=0`, viewer)).status, 200);
  assert.equal((await get(`/api/admin/export?type=pages&from=${today()}&to=${today()}&tz=0`, viewer)).status, 403);
});
test('database: the public anon key cannot read or write analytics tables', async () => {
  const r = await realFetch(`${mock.url}/rest/v1/analytics_sessions?select=*`, { headers: { apikey: mock.anonKey, Authorization: `Bearer ${mock.anonKey}` } }); assert.equal(r.status, 401);
  const w = await realFetch(`${mock.url}/rest/v1/admin_users`, { method: 'POST', headers: { apikey: mock.anonKey, Authorization: `Bearer ${mock.anonKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: 'x', email: 'a@b.c', role: 'owner' }) }); assert.equal(w.status, 401);
});
test('backend not configured: collection stays silent, dashboard explains', async () => {
  const saved = { ...process.env }; delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try { assert.equal((await post('/api/collect', pv({ sid: id('s'), vid: id('v') }))).status, 204); assert.equal((await get('/api/admin/me')).status, 503); }
  finally { Object.assign(process.env, saved); }
});

/* ---------------------------------------------------------------- aggregation (pure) */
const T = (iso) => new Date(iso).toISOString();
test('aggregate: figures, bounce, exit rate, new vs returning, timezone buckets', () => {
  const sessions = [
    { id: 's1', visitor_id: 'v1', started_at: T('2026-10-01T23:30:00Z'), last_seen_at: T('2026-10-01T23:40:00Z'), is_new_visitor: true, entry_path: '/', source: 'Direct', device: 'desktop', country: 'NG' },
    { id: 's2', visitor_id: 'v2', started_at: T('2026-10-02T10:00:00Z'), last_seen_at: T('2026-10-02T10:01:00Z'), is_new_visitor: false, entry_path: '/blog.html', source: 'Social', device: 'mobile', country: 'GB' },
  ];
  const pageviews = [
    { id: 'p1', session_id: 's1', visitor_id: 'v1', path: '/', title: 'Home', created_at: T('2026-10-01T23:30:00Z'), engaged_ms: 30000 },
    { id: 'p2', session_id: 's1', visitor_id: 'v1', path: '/google-ads.html', title: 'Ads', created_at: T('2026-10-01T23:31:00Z'), engaged_ms: 90000 },
    { id: 'p3', session_id: 's2', visitor_id: 'v2', path: '/blog.html', title: 'Blog', created_at: T('2026-10-02T10:00:00Z'), engaged_ms: 6000 },
  ];
  const conversions = [{ session_id: 's1', path: '/google-ads.html', service: 'Google Ads', enquiry_type: 'Request a Quote', form_source: 'popup', created_at: T('2026-10-01T23:35:00Z') }, { session_id: null, path: '/contact.html', service: '', enquiry_type: 'General Enquiry', form_source: 'contact_page', created_at: T('2026-10-02T11:00:00Z') }];
  const range = rangeFromParams('2026-10-01', '2026-10-02', 0);
  const r = buildReport({ sessions, pageviews, events: [], conversions, range });
  assert.equal(r.summary.visitors, 2); assert.equal(r.summary.newVisitors, 1); assert.equal(r.summary.returningVisitors, 1); assert.equal(r.summary.sessions, 2); assert.equal(r.summary.pageviews, 3);
  assert.equal(r.summary.avgSessionSeconds, 63); assert.equal(r.summary.bounceRate, 50); assert.equal(r.summary.enquiries, 2); assert.equal(r.summary.enquiriesUnattributed, 1); assert.equal(r.summary.conversionRate, 50);
  const ads = r.pages.find((p) => p.path === '/google-ads.html'); assert.equal(ads.avgSeconds, 90); assert.equal(ads.exitRate, 100); assert.equal(r.pages.find((p) => p.path === '/').exitRate, 0);
  assert.equal(r.pages.find((p) => p.path === '/blog.html').bounceRate, 100);
  assert.deepEqual(r.series.map((s) => [s.date, s.visitors]), [['2026-10-01', 1], ['2026-10-02', 1]]);
  const lagos = buildReport({ sessions, pageviews, events: [], conversions, range: rangeFromParams('2026-10-01', '2026-10-02', 60) });   // UTC+1: 23:30Z is already Oct 2
  assert.deepEqual(lagos.series.map((s) => [s.date, s.sessions]), [['2026-10-01', 0], ['2026-10-02', 2]]);
  assert.equal(buildReport({ sessions, pageviews, events: [], conversions, range, bucket: 'week' }).series.length, 1);
  assert.equal(buildReport({ sessions, pageviews, events: [], conversions, range, bucket: 'month' }).series[0].date, '2026-10');
});
test('aggregate: realtime window, helpers, csv', () => {
  const now = Date.parse('2026-10-15T12:00:00Z');
  const sessions = [{ id: 'a', visitor_id: 'v', last_seen_at: T('2026-10-15T11:58:00Z'), country: 'NG', device: 'mobile' }, { id: 'b', visitor_id: 'w', last_seen_at: T('2026-10-15T11:50:00Z') }];
  const pageviews = [{ session_id: 'a', path: '/about.html', title: 'About', created_at: T('2026-10-15T11:57:00Z') }];
  const rt = buildRealtime({ sessions, pageviews, events: [], conversions: [], now }); assert.equal(rt.online, 1); assert.deepEqual(rt.pages, [{ path: '/about.html', visitors: 1 }]);
  assert.equal(rangeFromParams('2026-01-01', '2027-12-31', 0), null); assert.equal(rangeFromParams('x', 'y', 0), null);
  assert.equal(serviceOfPath('/blog-merchant-center-disapproved-products.html'), 'Google Merchant Center'); assert.equal(serviceOfEnquiry('Google Ads & Analytics'), 'Google Ads & Analytics (combined option)');
  assert.equal(toCsv(['a'], [['=cmd'], ['x,"y"']]), "a\r\n'=cmd\r\n\"x,\"\"y\"\"\"\r\n");
  assert.equal(summarise({ sessions: [], pageviews: [], events: [], conversions: [] }).sessions, 0);
});
