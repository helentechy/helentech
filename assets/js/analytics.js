/* HelenTech privacy-friendly analytics + consent.
   - Does NOTHING until the visitor presses "Accept analytics". Declining (or a Global Privacy Control / Do Not Track
     signal) means no ID is created and nothing is sent.
   - Sends: page URL (no query string), page title, referrer source, visible time on page, and clicks on key buttons.
   - Never sends: names, emails, phone numbers, message text, form contents or anything typed into a field. */
(function () {
  'use strict';
  var CFG = window.HELENTECH_CONFIG || {};
  var KEY = 'ht_consent', VID = 'ht_vid', SESS = 'ht_sess', IDLE_MS = 60000, SESSION_MS = 30 * 60000;
  var ENDPOINT = CFG.analyticsEndpoint || '/api/collect';
  var isAdmin = /^\/admin(\/|$)/.test(location.pathname);
  var started = false, ids = null, pid = null, activeMs = 0, lastSent = 0, lastAct = Date.now(), timer = null;

  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function uuid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12); }
  function readConsent() { try { var c = JSON.parse(ls(KEY)); return c && typeof c.analytics === 'boolean' ? c : null; } catch (e) { return null; } }
  var signalOptOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  function granted() { var c = readConsent(); return !signalOptOut && !!(c && c.analytics); }

  /* ---------------- sending ---------------- */
  function send(obj, beacon) {
    if (!ids) return;
    var body = JSON.stringify(obj);
    try {
      if (beacon && navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))) return;
      fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true, credentials: 'omit' }).catch(function () {});
    } catch (e) { /* analytics must never break the page */ }
  }
  function sessionIds() {
    var vid = ls(VID), nv = false;
    if (!vid) { vid = uuid(); ls(VID, vid); nv = true; }
    var s = null; try { s = JSON.parse(ls(SESS)); } catch (e) { s = null; }
    var now = Date.now(), fresh = !s || !s.id || now - (s.last || 0) > SESSION_MS;
    if (fresh) s = { id: uuid(), last: now };
    s.last = now; ls(SESS, JSON.stringify(s));
    return { sid: s.id, vid: vid, nv: nv && fresh, fresh: fresh };
  }
  function touchSession() { try { var s = JSON.parse(ls(SESS)); if (s && s.id === ids.sid) { s.last = Date.now(); ls(SESS, JSON.stringify(s)); } } catch (e) {} }

  function pageview() {
    var q = new URLSearchParams(location.search);
    var ref = ''; try { if (document.referrer && new URL(document.referrer).host !== location.host) ref = document.referrer; } catch (e) {}
    send({ t: 'pv', sid: ids.sid, vid: ids.vid, pid: pid, path: location.pathname, title: document.title, ref: ref, nv: ids.nv, us: q.get('utm_source') || '', um: q.get('utm_medium') || '', uc: q.get('utm_campaign') || '', gc: q.has('gclid') });
  }
  function tick() {
    if (document.visibilityState === 'visible' && Date.now() - lastAct < IDLE_MS) activeMs += 1000;
    if (activeMs && activeMs - lastSent >= 15000) { lastSent = activeMs; send({ t: 'ping', sid: ids.sid, vid: ids.vid, pid: pid, path: location.pathname, ms: activeMs }); touchSession(); }
  }
  function flush() { if (activeMs > lastSent) { lastSent = activeMs; send({ t: 'eng', sid: ids.sid, vid: ids.vid, pid: pid, path: location.pathname, ms: activeMs }, true); } touchSession(); }
  function event(name, props) {
    if (!started) return;
    var clean = {}; if (props) Object.keys(props).slice(0, 8).forEach(function (k) { var v = props[k]; if (typeof v === 'string') clean[k] = v.slice(0, 100); else if (typeof v === 'number' || typeof v === 'boolean') clean[k] = v; });
    send({ t: 'ev', sid: ids.sid, vid: ids.vid, path: location.pathname, name: name, props: clean });
    touchSession();
  }

  /* ---------------- click tracking (labels only, never field contents) ---------------- */
  function label(el) { return (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80); }
  function onClick(e) {
    var a = e.target.closest && e.target.closest('a,button'); if (!a || (a.closest && a.closest('#enquiry form'))) return;
    var href = a.getAttribute('href') || '';
    if (/^mailto:/i.test(href)) return event('email_click', { label: label(a) });
    if (/^tel:/i.test(href)) return event('call_click', { label: label(a) });
    if (/wa\.me|whatsapp\.com/i.test(href)) return event('whatsapp_click', { label: label(a) });
    if (/\.(pdf|docx?|xlsx?|zip|csv)(\?|#|$)/i.test(href) || a.hasAttribute('download')) return event('download', { label: label(a), file: href.split('/').pop().slice(0, 80) });
    if (a.closest('.proj, .proj-rail')) { var card = a.closest('.proj'); var t = card && card.querySelector('h3,h4'); return event('portfolio_click', { label: (t ? t.textContent : label(a)).replace(/\s+/g, ' ').trim().slice(0, 80) }); }
    if (a.classList.contains('filter') && a.closest('[data-sub-bar],[data-group-bar]')) return event('portfolio_filter', { label: label(a) });
    if (a.matches('.btn, .nav-cta, .svc4-more, [data-open-enquiry]')) return event('cta_click', { label: label(a), to: href.split('?')[0].slice(0, 80) });
    if (/^https?:\/\//i.test(href)) { try { if (new URL(href).host !== location.host) return event('outbound_click', { label: href.replace(/^https?:\/\//, '').split(/[/?#]/)[0].slice(0, 60) }); } catch (er) {} }
  }

  function start() {
    if (started || isAdmin || CFG.customAnalyticsEnabled === false || !granted()) return;
    started = true; ids = sessionIds(); pid = uuid(); pageview();
    ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'].forEach(function (ev) { window.addEventListener(ev, function () { lastAct = Date.now(); }, { passive: true }); });
    document.addEventListener('click', onClick, true);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', flush);
    window.addEventListener('ht:event', function (e) { if (e.detail && e.detail.name) event(e.detail.name, e.detail.props); });
    timer = setInterval(tick, 1000);
  }
  function stop() {
    started = false; ids = null; if (timer) clearInterval(timer); timer = null;
    ls(VID, null); ls(SESS, null);   // forget the anonymous ID as soon as consent is withdrawn
  }

  /* ---------------- consent banner ---------------- */
  var banner = null;
  function setConsent(yes) {
    ls(KEY, JSON.stringify({ analytics: !!yes, ts: Date.now(), v: 1 }));
    window.dispatchEvent(new CustomEvent('ht-consent', { detail: { analytics: !!yes } }));
    if (yes) start(); else stop();
    closeBanner();
  }
  function closeBanner() { if (banner) { banner.remove(); banner = null; } }
  function openBanner(manual) {
    if (banner || isAdmin) return;
    var c = readConsent();
    banner = document.createElement('div');
    banner.className = 'ht-consent'; banner.setAttribute('role', 'dialog'); banner.setAttribute('aria-labelledby', 'ht-consent-t'); banner.setAttribute('aria-describedby', 'ht-consent-d');
    banner.innerHTML =
      '<div class="ht-consent-body"><h2 id="ht-consent-t">Help us improve this website</h2>' +
      '<p id="ht-consent-d">With your permission we use privacy-friendly analytics to see which pages are useful. It stores a random anonymous ID in your browser and never your name, email or what you type. ' +
      (signalOptOut ? 'Your browser is sending a privacy signal, so analytics stays off. ' : '') + '<a href="privacy.html">Read our privacy notice</a>.' + (manual && c ? ' Currently: <strong>' + (granted() ? 'accepted' : 'declined') + '</strong>.' : '') + '</p></div>' +
      '<div class="ht-consent-actions"><button type="button" class="btn btn-primary" data-ht-yes' + (signalOptOut ? ' disabled' : '') + '>Accept analytics</button><button type="button" class="btn btn-outline" data-ht-no>Decline</button></div>';
    banner.querySelector('[data-ht-yes]').addEventListener('click', function () { setConsent(true); });
    banner.querySelector('[data-ht-no]').addEventListener('click', function () { setConsent(false); });
    banner.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeBanner(); });
    document.body.appendChild(banner);
    if (manual) banner.querySelector('button:not([disabled])').focus();
  }
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-ht-consent-open]')) { e.preventDefault(); openBanner(true); } });

  window.HTAnalytics = { event: event, ids: function () { return started && ids ? { sid: ids.sid, vid: ids.vid } : null; }, consent: function () { return readConsent(); }, openSettings: function () { openBanner(true); } };

  if (isAdmin) return;
  if (granted()) start();
  else if (!readConsent() && !signalOptOut) setTimeout(function () { if (!readConsent()) openBanner(false); }, 1200);
})();
