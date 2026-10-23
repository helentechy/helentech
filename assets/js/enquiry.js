/* HelenTech enquiry pop-up.
   - Opens by itself once per browsing session after ~10 seconds (settings in config.js).
   - Opens from the floating "Have a Question?" button and from Contact / audit / quote buttons.
   - Posts to /api/contact (the server holds the email keys; nothing secret is in this file). */
(function () {
  'use strict';
  var root = document.getElementById('enquiry');
  if (!root) return;
  var cfg = window.HELENTECH_CONFIG || {};
  var dialog = root.querySelector('.enq-dialog');
  var form = document.getElementById('enqForm');
  var alertBox = document.getElementById('enqAlert');
  var submitBtn = document.getElementById('enqSubmit');
  var successBox = document.getElementById('enqSuccess');
  var formView = root.querySelector('.enq-form-view');
  var fab = document.querySelector('.enq-fab');
  var onContactPage = /(^|\/)contact(\.html)?$/.test(location.pathname) || document.body.getAttribute('data-nav') === 'contact';
  var KEY_SHOWN = 'ht_enq_shown', KEY_START = 'ht_enq_start';
  var lastFocus = null, openedAt = 0, sending = false, idemKey = newKey(), timer = null, tries = 0;
  var SERVICE_MAP = {
    'Google Business Profile': 'Google Business Profile Optimization',
    'Google Merchant Center': 'Google Merchant Center Setup & Suspension Fixes',
    'Google Ads': 'Google Ads & Analytics',
    'Google Analytics 4': 'Google Ads & Analytics'
  };

  function newKey() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'k' + Date.now() + Math.random().toString(36).slice(2); }
  function store(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function track(n, p) { if (typeof window.HelenTechTrack === 'function') window.HelenTechTrack(n, p || {}); }
  function field(n) { return form.elements[n]; }
  function focusables() { return Array.prototype.filter.call(dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([tabindex="-1"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'), function (el) { return el.offsetParent !== null || el === document.activeElement; }); }
  function isOpen() { return !root.hidden; }

  /* ---------- contact links that follow the config ---------- */
  (function links() {
    var wa = root.querySelector('[data-enq-wa]'), em = root.querySelector('[data-enq-email]');
    if (wa && cfg.whatsappNumber) wa.href = 'https://wa.me/' + String(cfg.whatsappNumber).replace(/\D/g, '') + '?text=' + encodeURIComponent("Hi HelenTech, I have a question.");
    if (em && cfg.contactEmail) em.href = 'mailto:' + cfg.contactEmail;
  })();

  /* ---------- open / close ---------- */
  function open(opts) {
    opts = opts || {};
    if (isOpen()) return;
    lastFocus = document.activeElement;
    if (opts.service && SERVICE_MAP[opts.service]) field('service').value = SERVICE_MAP[opts.service];
    else if (opts.service) { var sv = Array.prototype.filter.call(field('service').options, function (o) { return o.value === opts.service; })[0]; if (sv) field('service').value = opts.service; }
    if (opts.type) { var ok = Array.prototype.some.call(field('enquiryType').options, function (o) { return o.value === opts.type; }); if (ok) field('enquiryType').value = opts.type; }
    root.hidden = false;
    document.documentElement.classList.add('enq-open');
    requestAnimationFrame(function () { root.classList.add('is-open'); });
    openedAt = Date.now();
    store(KEY_SHOWN, '1');
    track('enquiry_popup_open', { source: opts.source || 'manual' });
    window.dispatchEvent(new CustomEvent('ht:event', { detail: { name: 'popup_open', props: { source: opts.source || 'manual' } } }));
    setTimeout(function () { var f = successBox.hidden ? field('name') : successBox; if (f) f.focus(); }, 60);
  }
  function close() {
    if (!isOpen()) return;
    root.classList.remove('is-open');
    document.documentElement.classList.remove('enq-open');
    var done = function () { root.hidden = true; };
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) done(); else setTimeout(done, 220);
    if (lastFocus && typeof lastFocus.focus === 'function') { try { lastFocus.focus(); } catch (e) {} }
    if (!successBox.hidden) resetView();
  }
  function resetView() { successBox.hidden = true; formView.hidden = false; }

  root.addEventListener('click', function (e) { if (e.target.closest('[data-enq-close]')) close(); });
  document.addEventListener('keydown', function (e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    var f = focusables(); if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- triggers ---------- */
  function typeFor(el) {
    var d = el.getAttribute('data-enquiry-type'); if (d) return d;
    var t = (el.textContent || '').toLowerCase();
    if (/audit/.test(t)) return 'Request a Website Audit';
    if (/quote/.test(t)) return 'Request a Quote';
    if (/question/.test(t)) return 'Ask a Question';
    return 'General Enquiry';
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var el = e.target.closest('[data-open-enquiry], a.btn[href^="contact.html"], a.nav-cta[href^="contact.html"]');
    if (!el || root.contains(el)) return;
    if (el.tagName === 'A' && (onContactPage || el.target === '_blank')) return;   // on the Contact page the full form is right there
    if (onContactPage && el.hasAttribute('data-open-enquiry')) return;
    e.preventDefault();
    var service = el.getAttribute('data-enquiry-service') || '';
    if (!service && el.tagName === 'A') { try { service = new URL(el.getAttribute('href'), location.href).searchParams.get('service') || ''; } catch (err) {} }
    // close the mobile menu if it is open
    var burger = document.getElementById('hamburger'); if (document.body.classList.contains('menu-open') && burger) burger.click();
    open({ service: service, type: typeFor(el), source: el.classList.contains('enq-fab') ? 'floating_button' : 'cta' });
  });

  /* ---------- automatic pop-up: once per session, about 10 s after the visit began ---------- */
  function autoCheck() {
    timer = null;
    if (store(KEY_SHOWN) || isOpen() || onContactPage) return;
    var busy = document.body.classList.contains('menu-open') || document.hidden || !!document.querySelector('.ht-consent');   // wait for the consent banner to be answered
    var a = document.activeElement, typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !root.contains(a);
    if (busy || typing) { if (++tries < 15) timer = setTimeout(autoCheck, 4000); return; }
    open({ source: 'auto' });
  }
  if (cfg.enquiryPopupEnabled !== false && !onContactPage && !store(KEY_SHOWN)) {
    var start = parseInt(store(KEY_START), 10);
    if (!start) { start = Date.now(); store(KEY_START, String(start)); }
    var delay = Math.max(0, (cfg.enquiryPopupDelayMs || 10000) - (Date.now() - start));
    timer = setTimeout(autoCheck, delay);
  }
  if (onContactPage && fab) fab.hidden = true;

  /* ---------- validation ---------- */
  function setErr(name, msg) {
    var input = field(name), p = document.getElementById('enq-' + name + '-err'); if (!input || !p) return !msg;
    if (msg) { p.textContent = msg; p.hidden = false; input.setAttribute('aria-invalid', 'true'); } else { p.hidden = true; input.removeAttribute('aria-invalid'); }
    return !msg;
  }
  var rules = {
    name: function (v) { return v.length >= 2 ? '' : 'Please enter your full name.'; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Please enter a valid email address.'; },
    phone: function (v) { if (!v) return ''; var d = v.replace(/\D/g, ''); return (/^[+\d][\d\s().-]{5,}$/.test(v) && d.length >= 7 && d.length <= 15) ? '' : 'Please enter a valid number, or leave this empty.'; },
    message: function (v) { return v.length >= 10 ? '' : 'Please write a short message so we know how to help.'; }
  };
  function validate(name) { return setErr(name, rules[name](field(name).value.trim())); }
  Object.keys(rules).forEach(function (n) {
    var el = field(n);
    el.addEventListener('blur', function () { if (el.value || el.hasAttribute('aria-invalid')) validate(n); });
    el.addEventListener('input', function () { if (el.hasAttribute('aria-invalid')) validate(n); });
  });

  function showAlert(headline, withFallback) {
    clear(alertBox);
    var strong = document.createElement('strong'); strong.textContent = headline; alertBox.appendChild(strong);
    if (withFallback) {
      var email = cfg.contactEmail || 'helentech776@gmail.com';
      var body = 'Hi HelenTech,\n\n' + field('message').value.trim() + '\n\n' + field('name').value.trim() + (field('phone').value ? '\n' + field('phone').value.trim() : '');
      var p = document.createElement('p'); p.className = 'enq-alert-alt'; p.appendChild(document.createTextNode('You can still reach us right now: email '));
      var m = document.createElement('a'); m.textContent = email; m.href = 'mailto:' + email + '?subject=' + encodeURIComponent('Website enquiry: ' + field('enquiryType').value) + '&body=' + encodeURIComponent(body); p.appendChild(m);
      if (cfg.whatsappNumber) { p.appendChild(document.createTextNode(' or ')); var w = document.createElement('a'); w.textContent = 'message us on WhatsApp'; w.target = '_blank'; w.rel = 'noopener'; w.href = 'https://wa.me/' + String(cfg.whatsappNumber).replace(/\D/g, '') + '?text=' + encodeURIComponent('Hi HelenTech, ' + field('message').value.trim()); p.appendChild(w); }
      p.appendChild(document.createTextNode('. Your message is still in the form.')); alertBox.appendChild(p);
    }
    alertBox.hidden = false; alertBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    alertBox.hidden = true;
    var firstBad = null;
    Object.keys(rules).forEach(function (n) { if (!validate(n) && !firstBad) firstBad = field(n); });
    if (firstBad) { firstBad.focus(); return; }
    if (field('botcheck').value) { showSuccess(); return; }   // bots: look successful, send nothing

    var payload = {
      name: field('name').value.trim(), email: field('email').value.trim(), phone: field('phone').value.trim(), company: field('company').value.trim(),
      service: field('service').value, enquiryType: field('enquiryType').value, budget: field('budget').value, message: field('message').value.trim(),
      botcheck: field('botcheck').value, fillMs: Date.now() - openedAt, page: location.pathname, formSource: 'popup',
      sid: (window.HTAnalytics && HTAnalytics.ids() || {}).sid || '', vid: (window.HTAnalytics && HTAnalytics.ids() || {}).vid || ''
    };
    sending = true; submitBtn.disabled = true; submitBtn.setAttribute('aria-busy', 'true'); submitBtn.classList.add('is-loading');
    var label = submitBtn.querySelector('.enq-submit-label'); label.textContent = 'Sending\u2026';

    fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': idemKey }, body: JSON.stringify(payload) })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (data) { if (!res.ok) { var err = new Error(data.error || 'Something went wrong.'); err.status = res.status; err.data = data; throw err; } return data; }); })
      .then(function () {
        track('enquiry_form_submission', { enquiry_type: payload.enquiryType, service: payload.service || 'not_specified', source: 'popup' });
        window.dispatchEvent(new CustomEvent('ht:event', { detail: { name: 'form_submit', props: { source: 'popup' } } }));
        showSuccess(payload);
      })
      .catch(function (err) {
        if (err instanceof TypeError) showAlert('We could not reach the server. Please check your connection and try again.', true);
        else if (err.status === 400 || err.status === 429) showAlert(err.message, false);
        else showAlert("Sorry, we couldn't send your enquiry just now.", true);
      })
      .then(function () { sending = false; submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy'); submitBtn.classList.remove('is-loading'); label.textContent = 'Send My Enquiry'; });
  });

  function showSuccess(p) {
    p = p || {};
    var first = (p.name || field('name').value || 'there').trim().split(/\s+/)[0];
    successBox.querySelector('[data-enq-first]').textContent = first;
    successBox.querySelector('[data-enq-sent-to]').textContent = p.email || field('email').value || 'your email';
    formView.hidden = true; successBox.hidden = false; successBox.focus();
    form.reset(); field('enquiryType').value = 'General Enquiry';
    Object.keys(rules).forEach(function (n) { setErr(n, ''); });
    idemKey = newKey();
  }
})();
