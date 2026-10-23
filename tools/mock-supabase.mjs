// Local stand-in for Supabase, used ONLY for development and automated tests (no network, no real data).
// It implements the small part of Supabase Auth (GoTrue) and PostgREST that HelenTech uses, including
// "tables are not readable with the public anon key" (row level security without policies).
import http from 'node:http';
import { randomUUID } from 'node:crypto';

const PKS = { analytics_sessions: ['id'], analytics_pageviews: ['id'], analytics_events: ['id'], analytics_conversions: ['id'], admin_users: ['user_id'] };

export function startMockSupabase({ port = 0, users = [], admins = [], anonKey = 'anon-test-key', serviceKey = 'service-test-key' } = {}) {
  const tables = { analytics_sessions: [], analytics_pageviews: [], analytics_events: [], analytics_conversions: [], admin_users: [...admins] };
  const accounts = users.map((u) => ({ id: u.id || randomUUID(), email: u.email.toLowerCase(), password: u.password }));
  const tokens = new Map();  // access -> {user, exp}
  const refresh = new Map(); // refresh -> user
  const stats = { restCalls: 0, anonRestDenied: 0, authCalls: 0 };

  const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  const readBody = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { r(d ? JSON.parse(d) : {}); } catch (e) { r({}); } }); });
  function newSession(user) {
    const access = 'at_' + randomUUID(), rt = 'rt_' + randomUUID();
    tokens.set(access, { user, exp: Date.now() + 3600_000 }); refresh.set(rt, user);
    return { access_token: access, refresh_token: rt, expires_in: 3600, token_type: 'bearer', user: { id: user.id, email: user.email } };
  }
  function match(row, key, spec) {
    const m = /^(eq|neq|gt|gte|lt|lte|is|in)\.(.*)$/.exec(spec); if (!m) return true;
    const [, op, raw] = m; const v = row[key];
    if (op === 'is') return raw === 'null' ? v == null : String(v) === raw;
    if (op === 'in') return raw.replace(/^\(|\)$/g, '').split(',').includes(String(v));
    const num = (x) => (typeof x === 'number' || /^-?\d+(\.\d+)?$/.test(String(x)) ? Number(x) : null);
    let a = v, b = raw;
    if (num(v) != null && num(raw) != null && typeof v === 'number') { a = num(v); b = num(raw); }
    else if (/^\d{4}-\d\d-\d\dT/.test(String(raw)) && v) { a = Date.parse(v); b = Date.parse(raw); }
    else { a = String(v); b = String(raw); }
    switch (op) { case 'eq': return a === b; case 'neq': return a !== b; case 'gt': return a > b; case 'gte': return a >= b; case 'lt': return a < b; case 'lte': return a <= b; default: return true; }
  }
  function filterRows(rows, params) {
    const keys = [...params.keys()].filter((k) => !['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k));
    return rows.filter((r) => keys.every((k) => params.getAll(k).every((spec) => match(r, k, spec))));
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const apikey = req.headers.apikey;
    if (url.pathname === '/__tables') return json(res, 200, tables);   // dev/test inspection only
    // ---------------- Auth ----------------
    if (url.pathname === '/auth/v1/token') {
      stats.authCalls++;
      if (apikey !== anonKey) return json(res, 401, { message: 'invalid api key' });
      const b = await readBody(req); const grant = url.searchParams.get('grant_type');
      if (grant === 'password') { const u = accounts.find((a) => a.email === String(b.email).toLowerCase() && a.password === b.password); return u ? json(res, 200, newSession(u)) : json(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' }); }
      if (grant === 'refresh_token') { const u = refresh.get(b.refresh_token); return u ? json(res, 200, newSession(u)) : json(res, 400, { error: 'invalid_grant' }); }
      return json(res, 400, { error: 'unsupported_grant_type' });
    }
    if (url.pathname === '/auth/v1/user') {
      if (apikey !== anonKey) return json(res, 401, { message: 'invalid api key' });
      const t = tokens.get(String(req.headers.authorization || '').replace(/^Bearer /, ''));
      if (!t || t.exp < Date.now()) return json(res, 401, { message: 'invalid JWT' });
      return json(res, 200, { id: t.user.id, email: t.user.email });
    }
    if (url.pathname === '/auth/v1/logout') { tokens.delete(String(req.headers.authorization || '').replace(/^Bearer /, '')); res.writeHead(204); return res.end(); }
    // ---------------- REST ----------------
    const m = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname);
    if (!m || !tables[m[1]]) return json(res, 404, { message: 'not found' });
    stats.restCalls++;
    if (apikey !== serviceKey || req.headers.authorization !== `Bearer ${serviceKey}`) { stats.anonRestDenied++; return json(res, 401, { message: 'permission denied (row level security)' }); }
    const name = m[1], rows = tables[name], pk = PKS[name];
    if (req.method === 'GET') {
      let out = filterRows(rows, url.searchParams);
      const order = url.searchParams.get('order');
      if (order) { const [col, dir] = order.split('.'); out = [...out].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === 'desc' ? -1 : 1)); }
      let from = 0, to = out.length - 1;
      const rg = /^(\d+)-(\d+)$/.exec(String(req.headers.range || '')); if (rg) { from = +rg[1]; to = +rg[2]; }
      if (url.searchParams.get('limit')) to = Math.min(to, from + +url.searchParams.get('limit') - 1);
      return json(res, 200, out.slice(from, to + 1).map((r) => ({ ...r })));
    }
    if (req.method === 'POST') {
      const body = await readBody(req); const list = Array.isArray(body) ? body : [body];
      const prefer = String(req.headers.prefer || '');
      for (const row of list) {
        const r = { ...row }; if (name === 'analytics_events' || name === 'analytics_conversions') r.id = r.id || randomUUID();
        if (name !== 'admin_users') r.created_at = r.created_at || new Date().toISOString();  // column default now()
        const dup = rows.find((x) => pk.every((k) => x[k] === r[k]));
        if (dup) { if (/ignore-duplicates/.test(prefer)) continue; if (/merge-duplicates/.test(prefer)) { Object.assign(dup, r); continue; } return json(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint' }); }
        if (name === 'analytics_pageviews' && !tables.analytics_sessions.find((s) => s.id === r.session_id)) return json(res, 409, { code: '23503', message: 'foreign key violation' });
        rows.push(r);
      }
      res.writeHead(201); return res.end();
    }
    if (req.method === 'PATCH') {
      const body = await readBody(req); for (const r of filterRows(rows, url.searchParams)) Object.assign(r, body);
      res.writeHead(204); return res.end();
    }
    return json(res, 405, { message: 'method not allowed' });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({
    url: `http://127.0.0.1:${server.address().port}`, tables, accounts, stats, anonKey, serviceKey,
    addAdmin: (email, role) => { const a = accounts.find((x) => x.email === email.toLowerCase()); tables.admin_users.push({ user_id: a.id, email: a.email, role }); },
    close: () => new Promise((r) => server.close(r)),
  })));
}
