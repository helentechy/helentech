// Small shared helpers for the API functions.
export function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  return (typeof xf === 'string' && xf.split(',')[0].trim()) || (req.socket && req.socket.remoteAddress) || 'unknown';
}
/** In-memory sliding-window limiter (per server instance). Returns true when the caller is over the limit. */
export function makeLimiter(max, windowMs) {
  const hits = new Map();
  return {
    over(key, now = Date.now()) {
      const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
      if (list.length >= max) { hits.set(key, list); return true; }
      list.push(now); hits.set(key, list);
      if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
      return false;
    },
    reset() { hits.clear(); },
  };
}
export function parseBody(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  return b && typeof b === 'object' ? b : {};
}
export function parseCookies(req) {
  const out = {}; const h = req.headers.cookie || '';
  h.split(/;\s*/).forEach((p) => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); });
  return out;
}
export function cookie(name, value, { maxAge, path = '/', secure = true } = {}) {
  return `${name}=${encodeURIComponent(value)}; Path=${path}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}${maxAge != null ? `; Max-Age=${maxAge}` : ''}`;
}
/** Same-origin check for browser requests. Allows SITE_ORIGINS (comma separated hosts) and the request's own host. */
export function originAllowed(req) {
  const origin = req.headers.origin || req.headers.referer || '';
  if (!origin) return false;
  let host; try { host = new URL(origin).host.toLowerCase(); } catch (e) { return false; }
  const own = String(req.headers.host || '').toLowerCase();
  const extra = String(process.env.SITE_ORIGINS || '').split(',').map((s) => s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')).filter(Boolean);
  return host === own || extra.includes(host);
}
