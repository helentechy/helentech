// /api/admin/<action>: private dashboard API. Actions: login, logout, me, stats, realtime, export.
// Login uses Supabase Auth (passwords never touch this code's storage). Roles come from the admin_users table:
//   owner  = full access + CSV export      viewer = read-only
// Session = Supabase access token in an HttpOnly, SameSite=Strict cookie that JavaScript on the page cannot read.
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, optional SITE_ORIGINS.
import * as db from '../_lib/supabase.js';
import { buildReport, buildRealtime, rangeFromParams, toCsv, summarise, PAGE_NAMES } from '../_lib/aggregate.js';
import { clientIp, makeLimiter, parseBody, parseCookies, cookie, originAllowed } from '../_lib/http.js';

const loginLimiter = makeLimiter(6, 15 * 60 * 1000);
export const __loginLimiter = loginLimiter;
const roleCache = new Map();   // userId -> { role, at }
export const __roleCache = roleCache;
const AT = 'ht_admin', RT = 'ht_admin_r';

const isSecure = (req) => String(req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https' || process.env.VERCEL === '1';
const setSession = (req, res, s) => res.setHeader('Set-Cookie', [
  cookie(AT, s.access_token, { maxAge: Math.max(60, s.expires_in || 3600), path: '/api/admin', secure: isSecure(req) }),
  cookie(RT, s.refresh_token || '', { maxAge: 60 * 60 * 24 * 7, path: '/api/admin', secure: isSecure(req) }),
]);
const clearSession = (req, res) => res.setHeader('Set-Cookie', [cookie(AT, '', { maxAge: 0, path: '/api/admin', secure: isSecure(req) }), cookie(RT, '', { maxAge: 0, path: '/api/admin', secure: isSecure(req) })]);

async function roleFor(userId) {
  const hit = roleCache.get(userId);
  if (hit && Date.now() - hit.at < 30000) return hit.role;
  const role = await db.adminRole(userId);
  roleCache.set(userId, { role, at: Date.now() });
  return role;
}
/** Returns { id, email, role } or null. Refreshes an expired access token when a refresh cookie exists. */
async function authenticate(req, res) {
  const c = parseCookies(req);
  let user = c[AT] ? await db.getUser(c[AT]) : null;
  if (!user && c[RT]) {
    const s = await db.refreshSession(c[RT]);
    if (s && s.access_token) { setSession(req, res, s); user = s.user || (await db.getUser(s.access_token)); }
  }
  if (!user || !user.id) return null;
  const role = await roleFor(user.id);
  return role ? { id: user.id, email: user.email, role } : null;
}

const COLS = {
  analytics_sessions: 'id,visitor_id,started_at,last_seen_at,is_new_visitor,entry_path,referrer_host,source,utm_campaign,device,browser,country,city',
  analytics_pageviews: 'id,session_id,visitor_id,path,title,created_at,engaged_ms',
  analytics_events: 'session_id,name,path,props,created_at',
  analytics_conversions: 'session_id,path,service,enquiry_type,form_source,created_at',
};
async function loadPeriod(startMs, endMs, { sessionCol = 'started_at' } = {}) {
  const a = new Date(startMs).toISOString(), b = new Date(endMs).toISOString();
  const rng = (col) => [`${col}=gte.${a}`, `${col}=lt.${b}`];
  const [s, p, e, c] = await Promise.all([
    db.selectAll('analytics_sessions', { select: COLS.analytics_sessions, filters: rng(sessionCol), order: `${sessionCol}.asc` }),
    db.selectAll('analytics_pageviews', { select: COLS.analytics_pageviews, filters: rng('created_at'), order: 'created_at.asc' }),
    db.selectAll('analytics_events', { select: COLS.analytics_events, filters: rng('created_at'), order: 'created_at.asc' }),
    db.selectAll('analytics_conversions', { select: COLS.analytics_conversions, filters: rng('created_at'), order: 'created_at.asc' }),
  ]);
  return { sessions: s.rows, pageviews: p.rows, events: e.rows, conversions: c.rows, truncated: s.truncated || p.truncated || e.truncated || c.truncated };
}

async function report(q) {
  const range = rangeFromParams(q.from, q.to, q.tz);
  if (!range) return { error: 'Choose a valid date range (maximum 400 days).' };
  const bucket = ['day', 'week', 'month'].includes(q.bucket) ? q.bucket : 'day';
  const span = range.end - range.start;
  const [cur, prev] = await Promise.all([loadPeriod(range.start, range.end), loadPeriod(range.start - span, range.start)]);
  return { data: buildReport({ ...cur, range, bucket, previous: prev, truncated: cur.truncated }), range };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const action = String((req.query && req.query.action) || String(req.url || '').split('?')[0].split('/').pop() || '');
  if (!db.authConfigured()) return res.status(503).json({ error: 'The dashboard backend is not configured yet. Add the Supabase environment variables.' });

  try {
    if (action === 'login') {
      if (req.method !== 'POST') return res.status(405).end();
      if (!originAllowed(req) || req.headers['x-requested-with'] !== 'HT-Admin') return res.status(403).json({ error: 'Request blocked.' });
      if (loginLimiter.over(clientIp(req))) return res.status(429).json({ error: 'Too many attempts. Please wait 15 minutes and try again.' });
      const b = parseBody(req);
      const email = String(b.email || '').trim().toLowerCase().slice(0, 200), password = String(b.password || '').slice(0, 200);
      if (!email || !password) return res.status(400).json({ error: 'Enter your email and password.' });
      const s = await db.passwordLogin(email, password);
      if (!s || !s.access_token) return res.status(401).json({ error: 'Incorrect email or password.' });
      const uid = (s.user && s.user.id) || ((await db.getUser(s.access_token)) || {}).id;
      const role = uid ? await db.adminRole(uid) : null;
      if (!role) return res.status(403).json({ error: 'This account does not have dashboard access.' });
      roleCache.set(uid, { role, at: Date.now() });
      setSession(req, res, s);
      return res.status(200).json({ email, role });
    }
    if (action === 'logout') {
      if (req.method !== 'POST') return res.status(405).end();
      if (!originAllowed(req) || req.headers['x-requested-with'] !== 'HT-Admin') return res.status(403).json({ error: 'Request blocked.' });
      const t = parseCookies(req)[AT]; if (t) await db.signOut(t);
      clearSession(req, res);
      return res.status(200).json({ ok: true });
    }

    const me = await authenticate(req, res);
    if (!me) return res.status(401).json({ error: 'Please sign in.' });
    if (req.method !== 'GET') return res.status(405).end();

    if (action === 'me') return res.status(200).json({ email: me.email, role: me.role });

    if (action === 'stats') {
      const r = await report(req.query || {});
      if (r.error) return res.status(400).json({ error: r.error });
      return res.status(200).json(r.data);
    }

    if (action === 'realtime') {
      const now = Date.now();
      const cur = await loadPeriod(now - 3600000, now + 60000, { sessionCol: 'last_seen_at' });
      return res.status(200).json(buildRealtime({ ...cur, now }));
    }

    if (action === 'export') {
      if (me.role !== 'owner') return res.status(403).json({ error: 'Only owners can export data.' });
      const q = req.query || {};
      const r = await report({ ...q, bucket: q.bucket || 'day' });
      if (r.error) return res.status(400).json({ error: r.error });
      const d = r.data; let csv, name;
      switch (q.type) {
        case 'pages': name = 'pages'; csv = toCsv(['Page URL', 'Name', 'Title', 'Views', 'Visitors', 'Avg time on page (s)', 'Total engagement (s)', 'Entrances', 'Bounce rate %', 'Exits', 'Exit rate %', 'Flag'], d.pages.map((p) => [p.path, p.name, p.title, p.views, p.visitors, p.avgSeconds, p.totalSeconds, p.entrances, p.bounceRate == null ? '' : p.bounceRate, p.exits, p.exitRate, p.flag])); break;
        case 'sources': name = 'traffic-sources'; csv = toCsv(['Source', 'Sessions', 'Visitors', 'Enquiries', 'Conversion rate %', 'Share %'], d.sources.map((s) => [s.source, s.sessions, s.visitors, s.enquiries, s.conversionRate, s.share])); break;
        case 'services': name = 'services'; csv = toCsv(['Service', 'Service page views', 'Article views', 'Visitors', 'Avg time on service page (s)', 'Contact clicks', 'Enquiries'], d.services.map((s) => [s.service, s.pageViews, s.articleViews, s.visitors, s.avgSeconds, s.ctaClicks, s.enquiries])); break;
        case 'events': name = 'events'; csv = toCsv(['Event', 'Count', 'Sessions'], d.events.map((e) => [e.name, e.count, e.sessions])); break;
        case 'leads': name = 'enquiries'; csv = toCsv(['Time (UTC)', 'Submitted from', 'Service', 'Enquiry type', 'Form', 'Traffic source', 'Landing page', 'Device', 'Country'], d.leads.recent.map((l) => [l.at, l.page, l.service, l.type, l.form, l.source, l.landing, l.device, l.country])); break;
        case 'geo': name = 'locations'; csv = toCsv(['Type', 'Location', 'Sessions', 'Visitors'], [...d.countries.map((c) => ['Country', c.country, c.sessions, c.visitors]), ...d.cities.map((c) => ['City', c.city, c.sessions, c.visitors])]); break;
        default: name = 'daily-trend'; csv = toCsv(['Period', 'Visitors', 'Sessions', 'Page views', 'Enquiries'], d.series.map((s) => [s.date, s.visitors, s.sessions, s.pageviews, s.enquiries]));
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="helentech-${name}-${q.from}-to-${q.to}.csv"`);
      return res.status(200).send(csv);
    }
    return res.status(404).json({ error: 'Not found' });
  } catch (e) {
    console.error('admin api error:', action, e && e.message);
    return res.status(500).json({ error: 'Something went wrong loading the data. Please try again.' });
  }
}
