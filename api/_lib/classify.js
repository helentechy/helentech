// Turns raw request details into the small, non-identifying labels we store.
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|monitor|uptime|curl|wget|python-requests|httpclient|axios|node-fetch|go-http|java\//i;
export const isBot = (ua) => !ua || BOT.test(ua);

export function device(ua) {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) return 'mobile';
  return 'desktop';
}
export function browser(ua) {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua) || /CriOS/.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
}
export function os(ua) {
  if (/Windows/.test(ua)) return 'Windows';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/Linux|X11/.test(ua)) return 'Linux';
  return 'Other';
}
const SOCIAL = /(^|\.)(facebook|fb|instagram|twitter|x|t|linkedin|lnkd|tiktok|youtube|youtu|pinterest|reddit|snapchat|whatsapp|wa|telegram|threads)\.(com|me|co|be|in|net|it)$/i;
const SEARCH = /(^|\.)(bing|duckduckgo|yahoo|ecosia|baidu|yandex|brave|startpage|ask)\./i;
export function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase().slice(0, 120); } catch (e) { return ''; } }

/** Returns { source, referrerHost } for a session. selfHost is this site's hostname. */
export function source(refUrl, utm, selfHost) {
  const host = hostOf(refUrl);
  const self = String(selfHost || '').replace(/^www\./, '').toLowerCase();
  const m = String(utm.medium || '').toLowerCase(), s = String(utm.source || '').toLowerCase();
  if (utm.gclid || /^(cpc|ppc|paid|paidsearch|paid_search)$/.test(m)) return { source: 'Paid (Google Ads)', referrerHost: host && host !== self ? host : '' };
  if (host && host !== self) {
    if (/(^|\.)google\.[a-z.]+$/.test(host)) return { source: 'Google (organic)', referrerHost: host };
    if (SEARCH.test(host + '.')) return { source: 'Other search', referrerHost: host };
    if (SOCIAL.test(host)) return { source: 'Social', referrerHost: host };
    return { source: 'Referral', referrerHost: host };
  }
  if (s) {
    if (SOCIAL.test(s + '.com')) return { source: 'Social', referrerHost: '' };
    if (m === 'email') return { source: 'Email', referrerHost: '' };
    return { source: 'Referral', referrerHost: s.slice(0, 60) };
  }
  return { source: 'Direct', referrerHost: '' };
}
