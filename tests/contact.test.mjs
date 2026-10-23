import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { __resetForTests } from '../api/contact.js';

const realFetch = globalThis.fetch;
function mkRes() { const r = { code: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } }; return r; }
function mkReq(body, ip = '1.1.1.1', extra = {}) { return { method: 'POST', body, headers: { 'x-forwarded-for': ip, ...extra }, socket: {} }; }
const good = { name: 'Ada Obi', email: 'ada@example.com', phone: '+2348012345678', company: 'Ada Stores', service: 'Google Ads & Analytics', enquiryType: 'Request a Quote', budget: '$1,000 to $3,000', message: 'Please review my Google Ads account.', fillMs: 9000 };
let calls;
function setup(impl) { calls = []; globalThis.fetch = async (url, opts) => { calls.push({ url, opts, body: opts && opts.body ? JSON.parse(opts.body) : null }); return impl ? impl(url, opts) : { ok: true, status: 200, json: async () => ({ id: 'x' }) }; }; __resetForTests(); }
test.afterEach(() => { globalThis.fetch = realFetch; for (const k of ['RESEND_API_KEY', 'CONTACT_TO_EMAIL', 'CONTACT_FROM_EMAIL', 'SEND_ACK_EMAIL', 'ACK_RESPONSE_TIME', 'LEAD_BACKUP_WEBHOOK_URL']) delete process.env[k]; });

test('rejects non-POST', async () => { setup(); const res = mkRes(); await handler({ method: 'GET', headers: {}, socket: {} }, res); assert.equal(res.code, 405); });
test('valid enquiry emails helentech776@gmail.com with correct subject and reply-to', async () => {
  setup(); process.env.RESEND_API_KEY = 're_test'; const res = mkRes(); await handler(mkReq(good), res);
  assert.equal(res.code, 200); assert.equal(calls.length, 1);
  const b = calls[0].body; assert.deepEqual(b.to, ['helentech776@gmail.com']); assert.equal(b.reply_to, 'ada@example.com');
  assert.equal(b.subject, 'New HelenTech Website Enquiry \u2014 Request a Quote');
  for (const s of ['Ada Obi', 'ada@example.com', '+2348012345678', 'Ada Stores', 'Google Ads & Analytics'.replace('&', '&amp;'), 'Request a Quote', '$1,000 to $3,000', 'Please review my Google Ads account.']) assert.ok(b.html.includes(s), 'missing ' + s);
  assert.match(b.text, /Submitted: .*\d{4}-\d\d-\d\dT/);
  assert.equal(calls[0].opts.headers.Authorization, 'Bearer re_test');
});
test('optional fields can be empty', async () => { setup(); process.env.RESEND_API_KEY = 'k'; const res = mkRes(); await handler(mkReq({ name: 'Bo Li', email: 'bo@example.com', message: 'Just a general question please.', fillMs: 9000 }), res); assert.equal(res.code, 200); assert.match(calls[0].body.subject, /General Enquiry/); assert.ok(calls[0].body.text.includes('Phone / WhatsApp: Not provided')); });
test('validation errors', async () => {
  setup(); process.env.RESEND_API_KEY = 'k';
  for (const bad of [{ ...good, name: '' }, { ...good, email: 'nope' }, { ...good, message: 'short' }, { ...good, phone: 'abc' }]) { const res = mkRes(); await handler(mkReq(bad, Math.random() + ''), res); assert.equal(res.code, 400); }
  assert.equal(calls.length, 0);
});
test('honeypot and too-fast submissions are silently ignored', async () => {
  setup(); process.env.RESEND_API_KEY = 'k';
  let res = mkRes(); await handler(mkReq({ ...good, botcheck: 'x' }), res); assert.equal(res.code, 200);
  res = mkRes(); await handler(mkReq({ ...good, fillMs: 500 }, '2.2.2.2'), res); assert.equal(res.code, 200);
  assert.equal(calls.length, 0);
});
test('rate limiting per IP', async () => {
  setup(); process.env.RESEND_API_KEY = 'k'; let last;
  for (let i = 0; i < 6; i++) { last = mkRes(); await handler(mkReq({ ...good, message: 'Different message number ' + i + ' here' }, '9.9.9.9'), last); }
  assert.equal(last.code, 429);
});
test('duplicate submissions send only one email', async () => {
  setup(); process.env.RESEND_API_KEY = 'k'; const a = mkRes(), b = mkRes(); await handler(mkReq(good), a); await handler(mkReq(good), b);
  assert.equal(a.code, 200); assert.equal(b.code, 200); assert.equal(calls.length, 1); assert.equal(b.body.duplicate, true);
});
test('escapes HTML and blocks header injection', async () => {
  setup(); process.env.RESEND_API_KEY = 'k'; const res = mkRes();
  await handler(mkReq({ ...good, name: 'Eve <script>alert(1)</script>', enquiryType: 'Ask a Question\r\nBcc: evil@x.com', message: '<img src=x onerror=1> hello there' }), res);
  const b = calls[0].body; assert.ok(!b.html.includes('<script>')); assert.ok(!b.html.includes('<img src=x')); assert.ok(!/[\r\n]/.test(b.subject)); assert.match(b.subject, /General Enquiry/);
});
test('acknowledgement email only with a verified sender, and promises no time by default', async () => {
  setup(); process.env.RESEND_API_KEY = 'k'; let res = mkRes(); await handler(mkReq(good), res); assert.equal(calls.length, 1);
  setup(); process.env.RESEND_API_KEY = 'k'; process.env.CONTACT_FROM_EMAIL = 'HelenTech <enquiries@helentech.com>'; res = mkRes(); await handler(mkReq(good), res);
  assert.equal(calls.length, 2); assert.deepEqual(calls[1].body.to, ['ada@example.com']); assert.ok(!/within|hours|business day/i.test(calls[1].body.html));
  setup(); process.env.RESEND_API_KEY = 'k'; process.env.CONTACT_FROM_EMAIL = 'x@y.com'; process.env.ACK_RESPONSE_TIME = 'We aim to reply within 1 business day.'; res = mkRes(); await handler(mkReq(good), res);
  assert.ok(calls[1].body.html.includes('within 1 business day'));
});
test('acknowledgement failure does not fail the enquiry', async () => {
  setup((url, opts) => (JSON.parse(opts.body).to[0] === 'ada@example.com' ? { ok: false, status: 403, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({}) }));
  process.env.RESEND_API_KEY = 'k'; process.env.CONTACT_FROM_EMAIL = 'x@y.com'; const res = mkRes(); await handler(mkReq(good), res); assert.equal(res.code, 200);
});
test('email failure returns an error with fallback and logs the lead', async () => {
  setup(() => ({ ok: false, status: 500, json: async () => ({ message: 'boom' }) })); process.env.RESEND_API_KEY = 'k';
  const logged = []; const orig = console.error; console.error = (...a) => logged.push(a.join(' ')); const res = mkRes(); await handler(mkReq(good), res); console.error = orig;
  assert.equal(res.code, 502); assert.equal(res.body.fallback, true); assert.ok(logged.some((l) => l.includes('LEAD_NOT_DELIVERED') && l.includes('ada@example.com')));
});
test('email failure with backup webhook still saves the lead', async () => {
  setup((url) => (String(url).includes('resend') ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({}) }));
  process.env.RESEND_API_KEY = 'k'; process.env.LEAD_BACKUP_WEBHOOK_URL = 'https://hooks.example.com/abc'; const orig = console.error; console.error = () => {};
  const res = mkRes(); await handler(mkReq(good), res); console.error = orig;
  assert.equal(res.code, 200); assert.equal(calls[1].url, 'https://hooks.example.com/abc'); assert.equal(calls[1].body.lead.email, 'ada@example.com');
});
test('missing API key is handled without exposing details', async () => {
  setup(); const orig = console.error; console.error = () => {}; const res = mkRes(); await handler(mkReq(good), res); console.error = orig;
  assert.equal(res.code, 500); assert.equal(res.body.fallback, true); assert.ok(!JSON.stringify(res.body).includes('RESEND'));
});
test('network failure to Resend is handled', async () => {
  setup(() => { throw new TypeError('fetch failed'); }); process.env.RESEND_API_KEY = 'k'; const orig = console.error; console.error = () => {}; const res = mkRes(); await handler(mkReq(good), res); console.error = orig; assert.equal(res.code, 500);
});
test('existing Contact-page form payload still works', async () => {
  setup(); process.env.RESEND_API_KEY = 'k'; const res = mkRes();
  await handler(mkReq({ name: 'Kemi A', email: 'kemi@example.com', phone: '+2348011112222', company: 'Kemi Co', website: 'kemi.com', service: 'Google Ads', budget: 'Under $1,000', contactMethod: 'WhatsApp', details: 'Please fix my Google Ads tracking.', page: '/contact.html' }), res);
  assert.equal(res.code, 200); assert.ok(calls[0].body.html.includes('kemi.com'));
});

test('health check reports setup without exposing secrets', async () => {
  setup(); let res = mkRes(); await handler({ method: 'GET', query: { health: '1' }, headers: {}, socket: {} }, res);
  assert.equal(res.code, 200); assert.equal(res.body.ready, false); assert.ok(res.body.problems[0].includes('RESEND_API_KEY')); assert.equal(res.body.sendsTo, 'helentech776@gmail.com');
  process.env.RESEND_API_KEY = 're_secret_value_123'; res = mkRes(); await handler({ method: 'GET', query: { health: '' }, headers: {}, socket: {} }, res);
  assert.equal(res.body.ready, true); assert.equal(res.body.sender, 'resend sandbox'); assert.ok(res.body.problems[0].includes('sandbox')); assert.ok(!JSON.stringify(res.body).includes('re_secret_value_123'));
  res = mkRes(); await handler({ method: 'GET', headers: {}, socket: {} }, res); assert.equal(res.code, 405);
});
