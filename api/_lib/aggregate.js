// Turns raw rows into the numbers shown on the dashboard. Pure functions: no network, easy to test.
// IMPORTANT: every figure only covers visitors who accepted analytics. Enquiries are counted for everyone.

const DAY = 86400000;
export const SERVICE_PAGES = {
  '/google-business-profile.html': 'Google Business Profile', '/google-merchant-center.html': 'Google Merchant Center',
  '/google-ads.html': 'Google Ads', '/google-analytics-4.html': 'Google Analytics 4',
};
export function serviceOfPath(p) {
  if (SERVICE_PAGES[p]) return SERVICE_PAGES[p];
  if (/^\/blog-/.test(p)) { if (/business-profile|local-seo/.test(p)) return 'Google Business Profile'; if (/merchant-center/.test(p)) return 'Google Merchant Center'; if (/google-ads/.test(p)) return 'Google Ads'; if (/ga4/.test(p)) return 'Google Analytics 4'; }
  return null;
}
export function serviceOfEnquiry(s) {
  if (!s) return 'Not specified';
  if (/^Google Business Profile/.test(s)) return 'Google Business Profile';
  if (/^Google Merchant Center/.test(s)) return 'Google Merchant Center';
  if (s === 'Google Ads & Analytics') return 'Google Ads & Analytics (combined option)';
  if (s === 'Google Ads') return 'Google Ads';
  if (s === 'Google Analytics 4') return 'Google Analytics 4';
  return 'Other';
}
export const PAGE_NAMES = { '/': 'Home', '/about.html': 'About', '/google-services.html': 'Services', '/portfolio.html': 'Portfolio', '/blog.html': 'Blog', '/contact.html': 'Contact', '/pricing.html': 'Pricing', '/faq.html': 'FAQ', '/reviews.html': 'Testimonials', '/privacy.html': 'Privacy' };

const ts = (v) => Date.parse(v);
const round = (n, d = 1) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : 0);
const pct = (a, b) => (b > 0 ? round((a / b) * 100, 1) : 0);
const median = (arr) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quantile = (arr, q) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

export function rangeFromParams(from, to, tzMin) {
  const ok = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && !Number.isNaN(Date.parse(d + 'T00:00:00Z'));
  if (!ok(from) || !ok(to)) return null;
  const tz = Math.max(-840, Math.min(840, parseInt(tzMin, 10) || 0));
  const start = Date.parse(from + 'T00:00:00Z') - tz * 60000;
  const end = Date.parse(to + 'T00:00:00Z') + DAY - tz * 60000;
  if (end <= start || (end - start) / DAY > 400) return null;
  return { start, end, tz };
}
export const dayKey = (t, tz) => new Date(t + tz * 60000).toISOString().slice(0, 10);
function bucketKey(t, tz, bucket) {
  const d = new Date(t + tz * 60000);
  if (bucket === 'month') return d.toISOString().slice(0, 7);
  if (bucket === 'week') { const day = (d.getUTCDay() + 6) % 7; const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)); return m.toISOString().slice(0, 10); }
  return d.toISOString().slice(0, 10);
}

/** Core summary numbers for one period. */
export function summarise({ sessions, pageviews, events, conversions }) {
  const pvBySession = new Map(); const engBySession = new Map(); const evBySession = new Map();
  for (const p of pageviews) { pvBySession.set(p.session_id, (pvBySession.get(p.session_id) || 0) + 1); engBySession.set(p.session_id, (engBySession.get(p.session_id) || 0) + (p.engaged_ms || 0)); }
  for (const e of events) evBySession.set(e.session_id, (evBySession.get(e.session_id) || 0) + 1);
  const visitors = new Set(sessions.map((s) => s.visitor_id));
  const newV = new Set(sessions.filter((s) => s.is_new_visitor).map((s) => s.visitor_id));
  const bounces = sessions.filter((s) => (pvBySession.get(s.id) || 0) <= 1 && !(evBySession.get(s.id) || 0)).length;
  const engTotal = [...engBySession.values()].reduce((a, b) => a + b, 0);
  const convSessions = new Set(conversions.filter((c) => c.session_id).map((c) => c.session_id));
  const withEnq = sessions.filter((s) => convSessions.has(s.id)).length;
  return {
    visitors: visitors.size, newVisitors: newV.size, returningVisitors: visitors.size - newV.size, sessions: sessions.length, pageviews: pageviews.length,
    avgSessionSeconds: sessions.length ? round(engTotal / 1000 / sessions.length, 0) : 0, avgPagesPerSession: sessions.length ? round(pageviews.length / sessions.length, 2) : 0,
    bounceRate: pct(bounces, sessions.length), engagedSecondsTotal: round(engTotal / 1000, 0),
    enquiries: conversions.length, enquiriesAttributed: conversions.filter((c) => c.session_id).length, enquiriesUnattributed: conversions.filter((c) => !c.session_id).length,
    conversionRate: pct(withEnq, sessions.length),
  };
}

export function buildReport({ sessions, pageviews, events, conversions, range, bucket = 'day', previous = null, truncated = false, now = Date.now() }) {
  const tz = range.tz;
  const sessById = new Map(sessions.map((s) => [s.id, s]));
  const summary = summarise({ sessions, pageviews, events, conversions });
  const prev = previous ? summarise(previous) : null;

  // ---- trend (bucketed) ----
  const series = new Map();
  const add = (k, f, v = 1) => { if (!series.has(k)) series.set(k, { date: k, visitors: new Set(), sessions: 0, pageviews: 0, enquiries: 0 }); const o = series.get(k); if (f === 'visitors') o.visitors.add(v); else o[f] += v; };
  // seed empty buckets so charts show gaps as zero
  for (let t = range.start; t < range.end; t += DAY) { const k = bucketKey(t, tz, bucket); if (!series.has(k)) series.set(k, { date: k, visitors: new Set(), sessions: 0, pageviews: 0, enquiries: 0 }); }
  for (const s of sessions) { const k = bucketKey(ts(s.started_at), tz, bucket); add(k, 'sessions'); add(k, 'visitors', s.visitor_id); }
  for (const p of pageviews) add(bucketKey(ts(p.created_at), tz, bucket), 'pageviews');
  for (const c of conversions) add(bucketKey(ts(c.created_at), tz, bucket), 'enquiries');
  const seriesOut = [...series.values()].sort((a, b) => (a.date < b.date ? -1 : 1)).map((o) => ({ date: o.date, visitors: o.visitors.size, sessions: o.sessions, pageviews: o.pageviews, enquiries: o.enquiries }));

  // ---- pages ----
  const bySession = new Map();
  for (const p of pageviews) { if (!bySession.has(p.session_id)) bySession.set(p.session_id, []); bySession.get(p.session_id).push(p); }
  const evCountBySession = new Map(); for (const e of events) evCountBySession.set(e.session_id, (evCountBySession.get(e.session_id) || 0) + 1);
  const pages = new Map();
  const page = (path) => { if (!pages.has(path)) pages.set(path, { path, title: '', titleAt: 0, views: 0, visitors: new Set(), engagedMs: 0, entrances: 0, bounces: 0, exits: 0 }); return pages.get(path); };
  for (const p of pageviews) { const o = page(p.path); o.views++; o.visitors.add(p.visitor_id); o.engagedMs += p.engaged_ms || 0; const at = ts(p.created_at); if (p.title && at >= o.titleAt) { o.title = p.title; o.titleAt = at; } }
  for (const [sid, list] of bySession) {
    list.sort((a, b) => ts(a.created_at) - ts(b.created_at));
    const first = list[0], last = list[list.length - 1];
    page(first.path).entrances++;
    if (list.length === 1 && !(evCountBySession.get(sid) || 0)) page(first.path).bounces++;
    page(last.path).exits++;
  }
  const rows = [...pages.values()].map((o) => ({
    path: o.path, name: PAGE_NAMES[o.path] || '', title: o.title, views: o.views, visitors: o.visitors.size,
    avgSeconds: o.views ? round(o.engagedMs / 1000 / o.views, 1) : 0, totalSeconds: round(o.engagedMs / 1000, 0),
    entrances: o.entrances, bounceRate: o.entrances ? pct(o.bounces, o.entrances) : null, exits: o.exits, exitRate: pct(o.exits, o.views),
  }));
  const eligible = rows.filter((r) => r.views >= 3);
  const viewCut = median(eligible.map((r) => r.views)), avgCut = quantile(eligible.map((r) => r.avgSeconds), 0.25);
  const topEng = quantile(eligible.map((r) => r.avgSeconds), 0.75);
  for (const r of rows) { r.flag = eligible.includes(r) ? (r.views >= viewCut && r.avgSeconds <= avgCut ? 'high-traffic-low-engagement' : (r.avgSeconds >= topEng && r.avgSeconds > 0 ? 'high-engagement' : '')) : ''; }
  rows.sort((a, b) => b.views - a.views);

  // ---- sources / devices / geography ----
  const convBySession = new Map(); for (const c of conversions) if (c.session_id) convBySession.set(c.session_id, (convBySession.get(c.session_id) || 0) + 1);
  const group = (key, fn) => {
    const m = new Map();
    for (const s of sessions) { const k = fn(s) || 'Unknown'; if (!m.has(k)) m.set(k, { key: k, sessions: 0, visitors: new Set(), enquiries: 0, sessionsWithEnquiry: 0 }); const o = m.get(k); o.sessions++; o.visitors.add(s.visitor_id); const n = convBySession.get(s.id) || 0; o.enquiries += n; if (n) o.sessionsWithEnquiry++; }
    return [...m.values()].map((o) => ({ [key]: o.key, sessions: o.sessions, visitors: o.visitors.size, enquiries: o.enquiries, conversionRate: pct(o.sessionsWithEnquiry, o.sessions), share: pct(o.sessions, sessions.length) })).sort((a, b) => b.sessions - a.sessions);
  };
  const sources = group('source', (s) => s.source);
  const referrers = group('host', (s) => s.referrer_host).filter((r) => r.host !== 'Unknown').slice(0, 15);
  const campaigns = group('campaign', (s) => s.utm_campaign).filter((r) => r.campaign !== 'Unknown').slice(0, 15);
  const devices = group('device', (s) => s.device);
  const countries = group('country', (s) => s.country).slice(0, 20);
  const cities = group('city', (s) => (s.city ? `${s.city}${s.country ? ', ' + s.country : ''}` : '')).filter((r) => r.city !== 'Unknown').slice(0, 20);
  const browsers = group('browser', (s) => s.browser).slice(0, 8);

  // ---- events ----
  const evm = new Map();
  for (const e of events) { if (!evm.has(e.name)) evm.set(e.name, { name: e.name, count: 0, sessions: new Set() }); const o = evm.get(e.name); o.count++; o.sessions.add(e.session_id); }
  const eventRows = [...evm.values()].map((o) => ({ name: o.name, count: o.count, sessions: o.sessions.size })).sort((a, b) => b.count - a.count);
  const evPath = new Map(); // cta-type clicks by page
  for (const e of events) if (['cta_click', 'email_click', 'whatsapp_click', 'call_click'].includes(e.name)) evPath.set(e.path, (evPath.get(e.path) || 0) + 1);
  const topButtons = new Map(); for (const e of events) if (e.name === 'cta_click' && e.props && e.props.label) topButtons.set(e.props.label, (topButtons.get(e.props.label) || 0) + 1);
  const ctaLabels = [...topButtons.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 15);
  const projects = new Map(); for (const e of events) if (e.name === 'portfolio_click' && e.props && e.props.label) projects.set(e.props.label, (projects.get(e.props.label) || 0) + 1);
  const portfolio = [...projects.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 15);

  // ---- services ----
  const sv = new Map();
  const svc = (n) => { if (!sv.has(n)) sv.set(n, { service: n, pageViews: 0, articleViews: 0, visitors: new Set(), engagedMs: 0, ctaClicks: 0, enquiries: 0 }); return sv.get(n); };
  for (const n of ['Google Business Profile', 'Google Merchant Center', 'Google Ads', 'Google Analytics 4']) svc(n);
  for (const p of pageviews) { const n = serviceOfPath(p.path); if (!n) continue; const o = svc(n); if (SERVICE_PAGES[p.path]) { o.pageViews++; o.engagedMs += p.engaged_ms || 0; } else o.articleViews++; o.visitors.add(p.visitor_id); }
  for (const e of events) { if (!['cta_click', 'email_click', 'whatsapp_click', 'call_click'].includes(e.name)) continue; const n = serviceOfPath(e.path); if (n) svc(n).ctaClicks++; }
  for (const c of conversions) svc(serviceOfEnquiry(c.service)).enquiries++;
  const services = [...sv.values()].map((o) => ({ service: o.service, pageViews: o.pageViews, articleViews: o.articleViews, visitors: o.visitors.size, avgSeconds: o.pageViews ? round(o.engagedMs / 1000 / o.pageViews, 1) : 0, ctaClicks: o.ctaClicks, enquiries: o.enquiries }))
    .filter((o) => o.pageViews || o.articleViews || o.ctaClicks || o.enquiries).sort((a, b) => (b.pageViews + b.articleViews + b.enquiries * 5) - (a.pageViews + a.articleViews + a.enquiries * 5));

  // ---- leads ----
  const tally = (fn) => { const m = new Map(); for (const c of conversions) { const k = fn(c) || 'Unknown'; m.set(k, (m.get(k) || 0) + 1); } return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count); };
  const pageEnq = new Map(); for (const c of conversions) pageEnq.set(c.path || 'Unknown', (pageEnq.get(c.path || 'Unknown') || 0) + 1);
  const landing = tally((c) => { const s = sessById.get(c.session_id); return s ? s.entry_path : 'Unknown (visitor did not accept analytics)'; });
  const bySource = tally((c) => { const s = sessById.get(c.session_id); return s ? s.source : 'Unknown (visitor did not accept analytics)'; });
  const viewsByPage = new Map(rows.map((r) => [r.path, r.views]));
  const leadPages = [...pageEnq.entries()].map(([path, enquiries]) => ({ path, enquiries, views: viewsByPage.get(path) || 0, rate: viewsByPage.get(path) ? pct(enquiries, viewsByPage.get(path)) : null })).sort((a, b) => b.enquiries - a.enquiries);
  const recentLeads = [...conversions].sort((a, b) => ts(b.created_at) - ts(a.created_at)).slice(0, 25).map((c) => { const s = sessById.get(c.session_id) || {}; return { at: c.created_at, page: c.path, service: c.service, type: c.enquiry_type, form: c.form_source, source: s.source || null, landing: s.entry_path || null, device: s.device || null, country: s.country || null }; });

  // ---- funnel (sessions) ----
  const sessSvc = new Set(), sessCta = new Set();
  for (const p of pageviews) if (SERVICE_PAGES[p.path]) sessSvc.add(p.session_id);
  for (const e of events) if (['cta_click', 'whatsapp_click', 'email_click', 'call_click', 'popup_open'].includes(e.name)) sessCta.add(e.session_id);
  const sessEnq = new Set(conversions.filter((c) => c.session_id).map((c) => c.session_id));
  const funnel = [
    { step: 'Sessions', value: sessions.length }, { step: 'Viewed a service page', value: sessions.filter((s) => sessSvc.has(s.id)).length },
    { step: 'Clicked a contact button', value: sessions.filter((s) => sessCta.has(s.id)).length }, { step: 'Sent an enquiry', value: sessions.filter((s) => sessEnq.has(s.id)).length },
  ];

  return {
    meta: { basis: 'Visitors who accepted analytics. Enquiries are counted for all visitors.', generatedAt: new Date(now).toISOString(), truncated, bucket,
      sessionTimeNote: 'Time on page is visible, active time reported by the visitor\'s browser, so it is an estimate.', bounceNote: 'Bounce = a session with one page view and no tracked clicks.', onlineWindowMinutes: 5 },
    summary, previous: prev, series: seriesOut, pages: rows, sources, referrers, campaigns, devices, countries, cities, browsers, events: eventRows, ctaLabels, portfolio, services,
    leads: { total: conversions.length, byPage: leadPages, byLanding: landing, bySource, byService: tally((c) => serviceOfEnquiry(c.service)), byType: tally((c) => c.enquiry_type), byForm: tally((c) => c.form_source), recent: recentLeads }, funnel,
  };
}

/** Real-time view: who is active in the last `windowMin` minutes and what just happened. */
export function buildRealtime({ sessions, pageviews, events, conversions, now = Date.now(), windowMin = 5, feedMin = 60 }) {
  const cutoff = now - windowMin * 60000, feedCut = now - feedMin * 60000;
  const active = sessions.filter((s) => ts(s.last_seen_at) >= cutoff);
  const lastPage = new Map(); for (const p of pageviews) { const cur = lastPage.get(p.session_id); if (!cur || ts(p.created_at) > ts(cur.created_at)) lastPage.set(p.session_id, p); }
  const onPage = new Map(); for (const s of active) { const p = lastPage.get(s.id); if (p) onPage.set(p.path, (onPage.get(p.path) || 0) + 1); }
  const countries = new Map(); for (const s of active) { const c = s.country || 'Unknown'; countries.set(c, (countries.get(c) || 0) + 1); }
  const sessById = new Map(sessions.map((s) => [s.id, s]));
  const feed = [];
  for (const p of pageviews) if (ts(p.created_at) >= feedCut) feed.push({ at: p.created_at, type: 'pageview', label: p.title || p.path, path: p.path, device: (sessById.get(p.session_id) || {}).device || null, country: (sessById.get(p.session_id) || {}).country || null });
  for (const e of events) if (ts(e.created_at) >= feedCut) feed.push({ at: e.created_at, type: 'event', label: e.name, detail: e.props && e.props.label ? e.props.label : '', path: e.path, device: (sessById.get(e.session_id) || {}).device || null, country: (sessById.get(e.session_id) || {}).country || null });
  for (const c of conversions) if (ts(c.created_at) >= feedCut) feed.push({ at: c.created_at, type: 'enquiry', label: 'Enquiry sent', detail: [c.enquiry_type, c.service].filter(Boolean).join(' · '), path: c.path });
  feed.sort((a, b) => ts(b.at) - ts(a.at));
  return { online: active.length, windowMinutes: windowMin, pages: [...onPage.entries()].map(([path, visitors]) => ({ path, visitors })).sort((a, b) => b.visitors - a.visitors), countries: [...countries.entries()].map(([country, visitors]) => ({ country, visitors })).sort((a, b) => b.visitors - a.visitors), feed: feed.slice(0, 40), generatedAt: new Date(now).toISOString() };
}

/** CSV with protection against spreadsheet formula injection. */
export function toCsv(headers, rows) {
  const cell = (v) => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [headers.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))].join('\r\n') + '\r\n';
}
