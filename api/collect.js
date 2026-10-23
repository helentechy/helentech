// /api/collect: receives analytics from assets/js/analytics.js. It only runs for visitors who accepted analytics.
// Stores: page views, time on page, a small set of click events, and anonymous session info. No IP address,
// no names/emails/phone numbers/message text, and no raw user agent is stored.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, optional SITE_ORIGINS (extra allowed hosts, comma separated).
import { configured, insert, patch } from './_lib/supabase.js';
import * as C from './_lib/classify.js';
import { clientIp, makeLimiter, parseBody, originAllowed } from './_lib/http.js';

export const EVENT_NAMES = ['cta_click', 'email_click', 'whatsapp_click', 'call_click', 'portfolio_click', 'portfolio_filter', 'popup_open', 'form_submit', 'download', 'outbound_click', 'faq_open'];
const ID = /^[A-Za-z0-9-]{8,64}$/;
const limiter = makeLimiter(240, 60 * 1000);
export const __limiter = limiter;
let warned = false;

const str = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, n) : '');
export function cleanPath(p) {
  let s = str(p, 300).split('#')[0].split('?')[0];
  if (!s.startsWith('/')) return '';
  s = s.replace(/\/index\.html$/, '/') || '/';
  return s.slice(0, 200);
}
function cleanProps(o) {
  const out = {}; if (!o || typeof o !== 'object') return out;
  for (const k of Object.keys(o).slice(0, 8)) { if (!/^[a-z_]{1,30}$/.test(k)) continue; const v = o[k]; if (typeof v === 'string') out[k] = str(v, 100); else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v; else if (typeof v === 'boolean') out[k] = v; }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).end(); }
  if (!originAllowed(req)) return res.status(403).end();
  const ua = String(req.headers['user-agent'] || '');
  if (C.isBot(ua)) return res.status(204).end();
  if (limiter.over(clientIp(req))) return res.status(429).end();
  if (!configured()) { if (!warned) { warned = true; console.error('analytics: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set, events are being dropped'); } return res.status(204).end(); }

  const b = parseBody(req);
  const t = b.t;
  if (!['pv', 'ping', 'eng', 'ev'].includes(t) || JSON.stringify(b).length > 4000) return res.status(400).json({ error: 'bad request' });
  if (!ID.test(b.sid || '') || !ID.test(b.vid || '')) return res.status(400).json({ error: 'bad ids' });
  const path = cleanPath(b.path);
  if (!path || path.startsWith('/admin')) return res.status(204).end();
  const now = new Date().toISOString();

  try {
    if (t === 'pv') {
      if (!ID.test(b.pid || '')) return res.status(400).json({ error: 'bad ids' });
      const selfHost = String(req.headers.host || '').split(':')[0];
      const src = C.source(str(b.ref, 300), { source: str(b.us, 60), medium: str(b.um, 60), gclid: b.gc === true }, selfHost);
      const country = str(req.headers['x-vercel-ip-country'], 2).toUpperCase();
      let city = ''; try { city = decodeURIComponent(str(req.headers['x-vercel-ip-city'], 80)); } catch (e) { city = str(req.headers['x-vercel-ip-city'], 80); }
      await insert('analytics_sessions', [{
        id: b.sid, visitor_id: b.vid, started_at: now, last_seen_at: now, is_new_visitor: b.nv === true, entry_path: path,
        referrer_host: src.referrerHost || null, source: src.source, utm_source: str(b.us, 60) || null, utm_medium: str(b.um, 60) || null, utm_campaign: str(b.uc, 80) || null,
        device: C.device(ua), browser: C.browser(ua), os: C.os(ua), country: /^[A-Z]{2}$/.test(country) ? country : null, city: city || null,
      }], { ignoreDuplicates: true, onConflict: 'id' });
      await insert('analytics_pageviews', [{ id: b.pid, session_id: b.sid, visitor_id: b.vid, path, title: str(b.title, 150) || null, created_at: now, engaged_ms: 0 }], { ignoreDuplicates: true, onConflict: 'id' });
      await patch('analytics_sessions', [`id=eq.${b.sid}`], { last_seen_at: now });
    } else if (t === 'ping' || t === 'eng') {
      const ms = Math.max(0, Math.min(1800000, Math.round(Number(b.ms) || 0)));
      if (ID.test(b.pid || '') && ms > 0) await patch('analytics_pageviews', [`id=eq.${b.pid}`, `engaged_ms=lt.${ms}`], { engaged_ms: ms });
      await patch('analytics_sessions', [`id=eq.${b.sid}`], { last_seen_at: now });
    } else if (t === 'ev') {
      if (!EVENT_NAMES.includes(b.name)) return res.status(400).json({ error: 'unknown event' });
      await insert('analytics_events', [{ session_id: b.sid, visitor_id: b.vid, name: b.name, path, props: cleanProps(b.props), created_at: now }]);
      await patch('analytics_sessions', [`id=eq.${b.sid}`], { last_seen_at: now });
    }
  } catch (e) {
    console.error('analytics write failed:', e && e.message);   // never break the visitor's page
  }
  return res.status(204).end();
}
