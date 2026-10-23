// Minimal Supabase client (REST + Auth) using fetch. Server-side only: it reads secret keys from environment variables.
//   SUPABASE_URL, SUPABASE_ANON_KEY (login only), SUPABASE_SERVICE_ROLE_KEY (database access)
const trim = (s) => String(s || '').replace(/\/+$/, '');
export const configured = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
export const authConfigured = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);

async function call(url, opts, timeoutMs = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try { return await fetch(url, { ...opts, signal: ctl.signal }); } finally { clearTimeout(t); }
}
const svcHeaders = (extra = {}) => ({ apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, ...extra });

/** Insert rows. opts: { ignoreDuplicates, onConflict, merge } */
export async function insert(table, rows, opts = {}) {
  const prefer = ['return=minimal'];
  if (opts.ignoreDuplicates) prefer.push('resolution=ignore-duplicates');
  if (opts.merge) prefer.push('resolution=merge-duplicates');
  const q = opts.onConflict ? `?on_conflict=${encodeURIComponent(opts.onConflict)}` : '';
  const r = await call(`${trim(process.env.SUPABASE_URL)}/rest/v1/${table}${q}`, { method: 'POST', headers: svcHeaders({ 'Content-Type': 'application/json', Prefer: prefer.join(',') }), body: JSON.stringify(rows) });
  if (!r.ok) throw new Error(`insert ${table} failed: ${r.status} ${await r.text().catch(() => '')}`);
}
/** Update rows matching PostgREST filters, e.g. patch('t', ['id=eq.5','n=lt.9'], {n: 9}) */
export async function patch(table, filters, values) {
  const r = await call(`${trim(process.env.SUPABASE_URL)}/rest/v1/${table}?${filters.join('&')}`, { method: 'PATCH', headers: svcHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(values) });
  if (!r.ok) throw new Error(`patch ${table} failed: ${r.status} ${await r.text().catch(() => '')}`);
}
/** Read rows (paged, 1000 per request) up to `max` rows. Returns { rows, truncated }. */
export async function selectAll(table, { select = '*', filters = [], order, max = 100000 } = {}) {
  const rows = []; const page = 1000;
  for (let from = 0; from < max; from += page) {
    const qs = [`select=${encodeURIComponent(select)}`, ...filters, order ? `order=${order}` : ''].filter(Boolean).join('&');
    const r = await call(`${trim(process.env.SUPABASE_URL)}/rest/v1/${table}?${qs}`, { headers: svcHeaders({ Range: `${from}-${from + page - 1}`, 'Range-Unit': 'items' }) }, 15000);
    if (!r.ok) throw new Error(`select ${table} failed: ${r.status} ${await r.text().catch(() => '')}`);
    const chunk = await r.json();
    rows.push(...chunk);
    if (chunk.length < page) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

/* ---------------- Supabase Auth ---------------- */
const anonHeaders = (extra = {}) => ({ apikey: process.env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json', ...extra });
export async function passwordLogin(email, password) {
  const r = await call(`${trim(process.env.SUPABASE_URL)}/auth/v1/token?grant_type=password`, { method: 'POST', headers: anonHeaders(), body: JSON.stringify({ email, password }) });
  if (!r.ok) return null;
  return r.json();
}
export async function refreshSession(refreshToken) {
  const r = await call(`${trim(process.env.SUPABASE_URL)}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: anonHeaders(), body: JSON.stringify({ refresh_token: refreshToken }) });
  if (!r.ok) return null;
  return r.json();
}
export async function getUser(accessToken) {
  const r = await call(`${trim(process.env.SUPABASE_URL)}/auth/v1/user`, { headers: anonHeaders({ Authorization: `Bearer ${accessToken}` }) });
  if (!r.ok) return null;
  return r.json();
}
export async function signOut(accessToken) {
  try { await call(`${trim(process.env.SUPABASE_URL)}/auth/v1/logout`, { method: 'POST', headers: anonHeaders({ Authorization: `Bearer ${accessToken}` }) }, 4000); } catch (e) { /* best effort */ }
}
export async function adminRole(userId) {
  const { rows } = await selectAll('admin_users', { select: 'role', filters: [`user_id=eq.${encodeURIComponent(userId)}`], max: 1 });
  return rows[0] ? rows[0].role : null;
}
