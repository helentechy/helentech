/* HelenTech shared site script. Plain JavaScript, no dependencies. */
(function () {
  'use strict';

  var CFG = window.HELENTECH_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.documentElement.classList.remove('no-js');

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ------------------------------------------------------------------
     Analytics (Google Analytics 4). Loads only with a real Measurement ID.
     No names, emails, phone numbers or message text are ever sent.
     ------------------------------------------------------------------ */
  var gaReady = false;
  function consentGiven() { try { var c = JSON.parse(localStorage.getItem('ht_consent')); return !!(c && c.analytics) && navigator.globalPrivacyControl !== true && navigator.doNotTrack !== '1'; } catch (e) { return false; } }
  function loadGA() {
    if (gaReady) return;
    var id = CFG.gaMeasurementId || '';
    if (!/^G-[A-Z0-9]{6,14}$/.test(id) || id === 'G-XXXXXXXXXX') return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', id, { anonymize_ip: true });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
    gaReady = true;
  }
  // Google Analytics only loads after the visitor accepts analytics in the consent banner.
  if (consentGiven()) loadGA();
  window.addEventListener('ht-consent', function (e) { if (e.detail && e.detail.analytics) loadGA(); });

  function track(name, params) {
    if (gaReady && typeof window.gtag === 'function') window.gtag('event', name, params || {});
  }
  window.HelenTechTrack = track;
  window.HT = { track: track, esc: esc };

  // Page-level events driven by <body data-page="...">
  (function pageEvents() {
    var type = document.body.getAttribute('data-page');
    if (type === 'pricing') track('pricing_view');
    if (type === 'portfolio') track('portfolio_view');
    if (type === 'service') track('service_view', { service_name: document.body.getAttribute('data-service') || document.title });
  })();

  // Click events: whatsapp_click and cta_click
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var where = a.closest('nav, .mobile-menu') ? 'header' : a.closest('footer') ? 'footer' : (a.closest('section[id]') || {}).id || 'page';
    if (/wa\.me|whatsapp\.com/i.test(href)) {
      track('whatsapp_click', { link_location: where });
    } else if (a.classList.contains('btn') || a.hasAttribute('data-cta')) {
      track('cta_click', { cta_text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60), cta_location: where, link_url: href.slice(0, 100) });
    }
  });

  /* ------------------------------------------------------------------
     Navigation
     ------------------------------------------------------------------ */
  var nav = $('#nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  var burger = $('#hamburger');
  var menu = $('#mobileMenu');
  var lastFocus = null;

  function menuFocusables() {
    var list = [burger].concat($$('a, button', menu));
    return list.filter(function (el) { return el && getComputedStyle(el).visibility !== 'hidden' && !el.disabled; });
  }
  function openMenu() {
    lastFocus = document.activeElement;
    menu.classList.add('open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    document.body.classList.add('menu-open');
    menu.removeAttribute('inert');
  }
  function closeMenu(returnFocus) {
    menu.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    document.body.classList.remove('menu-open');
    menu.setAttribute('inert', '');
    $$('.mm-toggle', menu).forEach(function (t) { setToggle(t, false); });
    if (returnFocus && lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function setToggle(btn, open) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (panel) panel.classList.toggle('open', open);
  }

  if (burger && menu) {
    menu.setAttribute('inert', '');
    burger.addEventListener('click', function () {
      menu.classList.contains('open') ? closeMenu(true) : openMenu();
    });
    $$('a', menu).forEach(function (a) {
      a.addEventListener('click', function () { closeMenu(false); });
    });
    $$('.mm-toggle', menu).forEach(function (t) {
      t.addEventListener('click', function () { setToggle(t, t.getAttribute('aria-expanded') !== 'true'); });
    });
    document.addEventListener('keydown', function (e) {
      if (!menu.classList.contains('open')) return;
      if (e.key === 'Escape') { closeMenu(true); burger.focus(); return; }
      if (e.key === 'Tab') {
        var f = menuFocusables();
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1100 && menu.classList.contains('open')) closeMenu(false);
    });
  }

  /* ------------------------------------------------------------------
     FAQ accordion: one open at a time per list
     ------------------------------------------------------------------ */
  $$('.faq-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      var list = btn.closest('.faq-list');
      if (open && list) {
        $$('.faq-btn[aria-expanded="true"]', list).forEach(function (other) {
          if (other !== btn) toggleFaq(other, false);
        });
      }
      toggleFaq(btn, open);
      if (open) track('faq_open', { faq_question: (btn.textContent || '').trim().slice(0, 80) });
    });
  });
  function toggleFaq(btn, open) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (panel) panel.classList.toggle('open', open);
  }
  // Open an FAQ item directly when linked with a hash
  if (location.hash) {
    var target = document.getElementById(location.hash.slice(1));
    var tb = target && target.querySelector ? target.querySelector('.faq-btn') : null;
    if (tb) toggleFaq(tb, true);
  }

  /* ------------------------------------------------------------------
     Scroll reveal (respects reduced motion)
     ------------------------------------------------------------------ */
  (function reveal() {
    var els = $$('.reveal');
    if (!els.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* ------------------------------------------------------------------
     Services carousel dots (the cards scroll-snap sideways on phones; CSS hides the dots elsewhere)
     ------------------------------------------------------------------ */
  (function svcCarousel() {
    var track = $('.svc5-grid');
    if (!track) return;
    var cards = $$('.svc5', track);
    if (cards.length < 2) return;
    var dots = document.createElement('div');
    dots.className = 'svc5-dots';
    dots.setAttribute('role', 'group');
    dots.setAttribute('aria-label', 'Choose a service');
    cards.forEach(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Show service ' + (i + 1) + ' of ' + cards.length);
      b.addEventListener('click', function () {
        track.scrollTo({ left: c.offsetLeft - track.offsetLeft - (parseFloat(getComputedStyle(track).paddingLeft) || 0), behavior: reduceMotion ? 'auto' : 'smooth' });
      });
      dots.appendChild(b);
    });
    track.parentNode.insertBefore(dots, track.nextSibling);
    var raf = 0;
    function sync() {
      raf = 0;
      var center = track.scrollLeft + track.clientWidth / 2, best = 0, bestD = 1e9;
      cards.forEach(function (c, i) {
        var d = Math.abs(c.offsetLeft - track.offsetLeft + c.offsetWidth / 2 - center);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 4) best = cards.length - 1;
      $$('button', dots).forEach(function (b, i) { b.setAttribute('aria-current', i === best ? 'true' : 'false'); });
    }
    track.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(sync); }, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  })();

  /* ------------------------------------------------------------------
     Hero video: respect reduced motion, provide a pause/play control
     ------------------------------------------------------------------ */
  (function heroVideo() {
    var v = $('#heroVideo'), btn = $('#videoToggle');
    if (!v || !btn) return;
    var playIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
    var pauseIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
    function sync() {
      var playing = !v.paused;
      btn.innerHTML = playing ? pauseIcon : playIcon;
      btn.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
    }
    if (reduceMotion || (navigator.connection && navigator.connection.saveData)) { v.removeAttribute('autoplay'); v.pause(); }
    btn.addEventListener('click', function () { v.paused ? v.play() : v.pause(); });
    v.addEventListener('play', sync); v.addEventListener('pause', sync);
    sync();
  })();

  /* ------------------------------------------------------------------
     Portfolio (rendered from assets/js/content.js)
     ------------------------------------------------------------------ */
  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M7 17L17 7M17 7H8M17 7V16"/></svg>';

  function projectCard(p) {
    var viewHref = p.url || p.image;
    var meta = '<dl class="proj-meta">' +
      (p.service ? '<div><dt>Service:</dt> <dd>' + esc(p.service) + '</dd></div>' : '') +
      (p.platform ? '<div><dt>Platform:</dt> <dd>' + esc(p.platform) + '</dd></div>' : '') + '</dl>';
    var result = p.result ? '<span class="proj-result">' + esc(p.result) + '</span>' : '';
    var actions = '<a class="text-link" href="' + esc(viewHref) + '" target="_blank" rel="noopener" data-cta="view_project">View Project ' + ARROW + '</a>' +
      (p.caseStudyUrl ? '<a class="text-link" href="' + esc(p.caseStudyUrl) + '" data-cta="case_study">Case Study ' + ARROW + '</a>' : '');
    return '<article class="proj" data-cat="' + esc(p.sub || (p.filters || [])[0] || '') + '" data-group="' + esc(p.group || '') + '" data-sub="' + esc(p.sub || '') + '" data-filters="' + esc((p.filters || []).join(' ')) + '">' +
      '<div class="proj-media' + (p.image ? '' : ' no-img') + '">' +
      (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.alt || p.title) + '" loading="lazy" decoding="async" width="1200" height="750">' : '') +
      '<span class="proj-fallback"><span class="proj-initial" aria-hidden="true">' + esc((p.title || '?').charAt(0).toUpperCase()) + '</span><span class="proj-host">' + esc(p.title) + '</span></span></div>' +
      '<div class="proj-body"><span class="proj-tag label">' + esc(p.category) + '</span>' +
      '<h3>' + esc(p.title) + '</h3>' + (p.description ? '<p>' + esc(p.description) + '</p>' : '') + (p.service || p.platform ? meta : '') + result +
      '<div class="proj-actions">' + actions + '</div></div></article>';
  }

  $$('[data-projects]').forEach(function (box) {
    var all = window.HELENTECH_PROJECTS || [];
    var list = box.getAttribute('data-projects') === 'featured' ? all.filter(function (p) { return p.featured; }) : all;
    box.innerHTML = list.map(projectCard).join('');
    $$('img', box).forEach(function (img) {
      img.addEventListener('error', function () { img.parentNode.classList.add('no-img'); });
    });
    var empty = $('[data-projects-empty]');
    var groupBar = $('[data-group-bar]');
    var subBar = $('[data-sub-bar]');
    var more = $('[data-load-more]');
    var SUBS = {
      google: [['gmb', 'Google Business Profile (GBP)'], ['gmc', 'Google Merchant Center (GMC)'], ['ads', 'Google Ads']]
    };
    var PAGE = 12, limit = PAGE, group = 'google', sub = 'all';
    function count(g, sb) {
      return $$('.proj', box).filter(function (c) {
        return (g === 'all' || c.getAttribute('data-group') === g) && (sb === 'all' || c.getAttribute('data-sub') === sb);
      }).length;
    }
    function buildSub() {
      if (!subBar) return;
            var items = [['all', 'All Google Services']].concat(SUBS[group].filter(function (x) { return group === 'google' || count(group, x[0]) > 0; }));
      subBar.innerHTML = items.map(function (x) {
        return '<button type="button" class="filter" data-sub="' + x[0] + '" aria-pressed="' + (x[0] === sub ? 'true' : 'false') + '">' + esc(x[1]) + '<span class="count">' + count(group, x[0]) + '</span></button>';
      }).join('');
      subBar.hidden = false;
    }
    function apply() {
      var matched = 0, shown = 0;
      $$('.proj', box).forEach(function (card) {
        var match = (group === 'all' || card.getAttribute('data-group') === group) && (sub === 'all' || card.getAttribute('data-sub') === sub);
        if (match) matched++;
        var visible = match && (!groupBar || matched <= limit);
        card.hidden = !visible;
        if (visible) shown++;
      });
      if (empty) empty.hidden = matched !== 0;
      if (more) {
        more.hidden = matched <= shown;
        more.textContent = 'Show more projects (' + (matched - shown) + ' remaining)';
      }
      var status = $('[data-filter-status]');
      if (status) status.textContent = shown + ' of ' + matched + (matched === 1 ? ' project shown' : ' projects shown');
    }
    if (groupBar) {
      $$('.filter', groupBar).forEach(function (b) {
        var g = b.getAttribute('data-group');
        var n = count(g, 'all');
        b.insertAdjacentHTML('beforeend', '<span class="count">' + n + '</span>');
      });
      buildSub();
      apply();
      if (more) more.addEventListener('click', function () { limit += PAGE; apply(); });
      groupBar.addEventListener('click', function (e) {
        var b = e.target.closest('.filter');
        if (!b) return;
        group = b.getAttribute('data-group'); sub = 'all'; limit = PAGE;
        $$('.filter', groupBar).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        buildSub(); apply();
        track('portfolio_filter', { filter: group });
      });
      if (subBar) subBar.addEventListener('click', function (e) {
        var b = e.target.closest('.filter');
        if (!b) return;
        sub = b.getAttribute('data-sub'); limit = PAGE;
        $$('.filter', subBar).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        apply();
        track('portfolio_filter', { filter: group + ':' + sub });
      });
    }
  });

  /* ------------------------------------------------------------------
     Testimonials (rendered from assets/js/content.js)
     ------------------------------------------------------------------ */
  var STAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.6L22 9.3l-5 4.8 1.3 7L12 17.8 5.7 21l1.3-7-5-4.8 7.1-.7L12 2z"/></svg>';
  function initials(name) { return String(name).split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase(); }

  function testimonialCard(t, placeholder) {
    var draft = !!t.draft;
    t = { name: t.name, role: t.role, company: t.company, service: t.service, quote: t.quote || t.review, rating: t.rating, photo: t.photo || t.image };
    var rating = !placeholder && t.rating ? Math.max(0, Math.min(5, Math.round(t.rating))) : 0;
    var stars = '';
    if (rating) {
      stars = '<div class="testi-stars" role="img" aria-label="Rated ' + rating + ' out of 5">';
      for (var i = 1; i <= 5; i++) stars += i <= rating ? STAR : STAR.replace('<svg ', '<svg class="off" ');
      stars += '</div>';
    }
    var avatar = t.photo ? '<img src="' + esc(t.photo) + '" alt="" loading="lazy">' : (t.name ? esc(initials(t.name)) : '');
    var role = [t.role, t.company].filter(Boolean).join(', ');
    var showAvatar = !!(t.photo || t.name);
    return '<figure class="testi' + (placeholder ? ' is-placeholder' : '') + '' + '">' +
      (placeholder ? '' : '<span class="testi-qm" aria-hidden="true">&ldquo;</span>') +
      stars + '<blockquote>' + esc(t.quote) + '</blockquote>' +
      '<figcaption class="testi-person">' + (showAvatar ? '<span class="testi-avatar" aria-hidden="true">' + avatar + '</span>' : '') + '<span>' +
      (t.name ? '<span class="testi-name">' + esc(t.name) + '</span><br>' : '') + (role ? '<span class="testi-role">' + esc(role) + '</span><br>' : '') +
      (t.service ? '<span class="testi-service">' + esc(t.service) + '</span>' : '') + '</span></figcaption></figure>';
  }

  $$('[data-testimonials]').forEach(function (box) {
    var real = window.HELENTECH_TESTIMONIALS || [];
    var limit = parseInt(box.getAttribute('data-limit') || '0', 10);
    var section = box.closest('[data-testimonial-section]');
    var notice = section && $('[data-testimonial-notice]', section);
    if (real.length) {
      box.innerHTML = (limit ? real.slice(0, limit) : real).map(function (t) { return testimonialCard(t, false); }).join('');
      var hasDraft = real.some(function (t) { return t.draft; });
      if (notice) {
        notice.hidden = true;
      }
    } else if (CFG.showTestimonialPlaceholders !== false) {
      var ph = [
        { name: 'Client Name', role: 'Client role', company: 'Business name', service: 'Service received', quote: 'A short quote from a real HelenTech client will appear here, in their own words.' },
        { name: 'Client Name', role: 'Client role', company: 'Business name', service: 'Service received', quote: 'Each testimonial shows the client name, business and the service they received.' },
        { name: 'Client Name', role: 'Client role', company: 'Business name', service: 'Service received', quote: 'Star ratings are only shown when a client has given a genuine rating.' }
      ];
      box.innerHTML = ph.slice(0, limit || 3).map(function (t) { return testimonialCard(t, true); }).join('');
    } else {
      box.innerHTML = '<div class="empty-state">Client testimonials are coming soon. In the meantime, see our <a class="text-link" href="portfolio.html">portfolio</a>.</div>';
      if (section && section.hasAttribute('data-hide-when-empty')) section.hidden = true;
    }
  });

  /* ------------------------------------------------------------------
     Testimonial carousel (homepage): featured card + arrows + dots
     ------------------------------------------------------------------ */
  $$('.testi-carousel').forEach(function (car) {
    var track = $('[data-testimonials]', car);
    var cards = $$('.testi', track);
    var controls = $('.testi-controls', car);
    var dotsBox = $('.testi-dots', car);
    if (cards.length < 2) { if (controls) controls.hidden = true; return; }
    var wide = window.matchMedia('(min-width:1000px)');
    var cur = wide.matches ? Math.min(1, cards.length - 1) : 0;
    dotsBox.innerHTML = cards.map(function (_, i) { return '<button type="button" aria-label="Show testimonial ' + (i + 1) + '"></button>'; }).join('');
    var dots = $$('button', dotsBox);
    function set(i, scroll) {
      cur = (i + cards.length) % cards.length;
      cards.forEach(function (c, j) { c.classList.toggle('is-active', j === cur); });
      dots.forEach(function (d, j) { d.setAttribute('aria-current', j === cur ? 'true' : 'false'); });
      if (scroll && !wide.matches) {
        var c = cards[cur];
        track.scrollTo({ left: c.offsetLeft - (track.clientWidth - c.offsetWidth) / 2, behavior: 'smooth' });
      }
    }
    $('[data-prev]', car).addEventListener('click', function () { set(cur - 1, true); });
    $('[data-next]', car).addEventListener('click', function () { set(cur + 1, true); });
    dots.forEach(function (d, i) { d.addEventListener('click', function () { set(i, true); }); });
    cards.forEach(function (c, i) { c.addEventListener('click', function () { set(i, true); }); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); set(cur + 1, true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); set(cur - 1, true); }
    });
    var t;
    track.addEventListener('scroll', function () {
      if (wide.matches) return;
      clearTimeout(t);
      t = setTimeout(function () {
        var mid = track.scrollLeft + track.clientWidth / 2, best = 0, bd = 1e9;
        cards.forEach(function (c, j) { var d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = j; } });
        if (best !== cur) set(best, false);
      }, 80);
    }, { passive: true });
    set(cur, false);
  });

  /* ------------------------------------------------------------------
     Mobile swipe carousels: dots + start on the recommended card
     ------------------------------------------------------------------ */
  (function mobileCarousels() {
    var mq = window.matchMedia('(max-width:759px)');
    $$('[data-mcarousel]').forEach(function (box) {
      var dots = document.createElement('div');
      dots.className = 'mcar-dots';
      dots.setAttribute('role', 'group');
      dots.setAttribute('aria-label', (box.getAttribute('data-mcarousel') || 'Slides') + ' navigation');
      box.parentNode.insertBefore(dots, box.nextSibling);
      var cards = [], buttons = [];
      function build() {
        cards = Array.prototype.slice.call(box.children).filter(function (c) { return c.offsetParent !== null; });
        dots.innerHTML = cards.map(function (_, i) { return '<button type="button" aria-label="Go to item ' + (i + 1) + '"></button>'; }).join('');
        buttons = $$('button', dots);
        buttons.forEach(function (b, i) {
          b.addEventListener('click', function () { go(i); });
        });
        mark();
      }
      function go(i) {
        var c = cards[i]; if (!c) return;
        box.scrollTo({ left: c.offsetLeft - parseFloat(getComputedStyle(box).paddingLeft || 0), behavior: 'smooth' });
      }
      function nearest() {
        var best = 0, bd = 1e9, left = box.scrollLeft + parseFloat(getComputedStyle(box).paddingLeft || 0);
        cards.forEach(function (c, i) { var d = Math.abs(c.offsetLeft - left); if (d < bd) { bd = d; best = i; } });
        return best;
      }
      function mark() {
        var n = nearest();
        buttons.forEach(function (b, i) { b.setAttribute('aria-current', i === n ? 'true' : 'false'); });
      }
      var t;
      box.addEventListener('scroll', function () { clearTimeout(t); t = setTimeout(mark, 60); }, { passive: true });
      function init() {
        build();
        if (mq.matches) {
          var f = box.querySelector('.is-featured');
          if (f) box.scrollLeft = f.offsetLeft - parseFloat(getComputedStyle(box).paddingLeft || 0);
          mark();
        }
      }
      if (mq.addEventListener) mq.addEventListener('change', init);
      window.addEventListener('load', init);
      init();
    });
  })();

  /* Video card (About page): click the play button to play inline */
  $$('[data-video-card]').forEach(function (card) {
    var v = $('video', card), b = $('.play-btn', card);
    if (!v || !b) return;
    b.addEventListener('click', function () {
      v.muted = true; v.controls = true;
      var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
      card.classList.add('is-playing');
    });
  });

  /* ------------------------------------------------------------------
     Lead form
     ------------------------------------------------------------------ */
  var form = $('#leadForm');
  if (form) {
    var submitBtn = $('#submitBtn');
    var statusBox = $('#formStatus');
    var successBox = $('#formSuccess');
    var sending = false;
    var idemKey = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);

    var rules = {
      name: function (v) { return v.length >= 2 ? '' : 'Please enter your full name.'; },
      email: function (v) {
        if (!v) return 'Please enter your email address.';
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Please enter a valid email address, like name@company.com.';
      },
      phone: function (v) {
        if (!v) return 'Please enter a phone or WhatsApp number.';
        var digits = v.replace(/\D/g, '');
        return /^[+\d][\d\s().-]{5,}$/.test(v) && digits.length >= 7 && digits.length <= 15 ? '' : 'Please enter a valid number with country code, like +234 901 234 5678.';
      },
      company: function (v) { return v.length >= 2 ? '' : 'Please enter your business name.'; },
      website: function (v) {
        if (!v) return 'Please enter your website address, or type "none" if you do not have one yet.';
        if (/^(none|no|n\/a|na|not yet)$/i.test(v)) return '';
        var candidate = /^https?:\/\//i.test(v) ? v : 'https://' + v;
        try { var u = new URL(candidate); return u.hostname.indexOf('.') > 0 ? '' : 'Please enter a valid website address, like example.com.'; }
        catch (err) { return 'Please enter a valid website address, like example.com.'; }
      },
      service: function (v) { return v ? '' : 'Please choose the service you need.'; },
      details: function (v) { return v.length >= 15 ? '' : 'Please tell us a little about your project (at least a sentence).'; }
    };

    function field(name) { return form.elements[name]; }
    function showError(name, msg) {
      var input = field(name);
      var wrap = input.closest('.field');
      var err = $('.err', wrap);
      wrap.classList.toggle('invalid', !!msg);
      if (msg) { input.setAttribute('aria-invalid', 'true'); if (err) err.textContent = msg; }
      else { input.removeAttribute('aria-invalid'); if (err) err.textContent = ''; }
    }
    function validateField(name) {
      var input = field(name);
      var msg = rules[name](String(input.value || '').trim());
      showError(name, msg);
      return !msg;
    }
    Object.keys(rules).forEach(function (n) {
      var input = field(n);
      input.addEventListener('blur', function () { if (String(input.value).trim() !== '' || input.closest('.field').classList.contains('invalid')) validateField(n); });
      input.addEventListener('input', function () { if (input.closest('.field').classList.contains('invalid')) validateField(n); });
    });

    function showStatus(msg) { statusBox.textContent = msg; statusBox.hidden = false; }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;
      statusBox.hidden = true;
      var firstBad = null;
      Object.keys(rules).forEach(function (n) { if (!validateField(n) && !firstBad) firstBad = field(n); });
      if (firstBad) { firstBad.focus(); showStatus('Please fix the highlighted fields and try again.'); return; }
      if (field('botcheck').value) return; // honeypot: silently ignore bots

      var payload = {
        name: field('name').value.trim(),
        email: field('email').value.trim(),
        phone: field('phone').value.trim(),
        company: field('company').value.trim(),
        website: field('website').value.trim(),
        service: field('service').value,
        budget: field('budget').value,
        contactMethod: field('contactMethod').value,
        details: field('details').value.trim(),
        enquiryType: 'Discuss a Project',
        formSource: /faq/.test(location.pathname) ? 'faq_page' : 'contact_page',
        sid: (window.HTAnalytics && HTAnalytics.ids() || {}).sid || '',
        vid: (window.HTAnalytics && HTAnalytics.ids() || {}).vid || '',
        page: location.pathname
      };

      sending = true;
      submitBtn.disabled = true;
      var label = submitBtn.innerHTML;
      submitBtn.textContent = 'Sending…';

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': idemKey },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
          return data;
        });
      }).then(function () {
        track('contact_form_submission', { service: payload.service, has_budget: payload.budget ? 'yes' : 'no' });
        form.hidden = true;
        $$('[data-form-intro]').forEach(function (el) { el.hidden = true; });
        successBox.classList.add('show');
        var h = $('h2', successBox); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
        form.reset();
        idemKey = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
      }).catch(function (err) {
        var offline = err instanceof TypeError;
        showStatus(offline
          ? 'We could not reach the server. Please check your connection and try again, or message us on WhatsApp.'
          : err.message + ' You can also email ' + (CFG.contactEmail || 'helentech776@gmail.com') + ' or message us on WhatsApp.');
      }).then(function () {
        sending = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = label;
      });
    });

    var again = $('#sendAnother');
    if (again) again.addEventListener('click', function () {
      successBox.classList.remove('show');
      form.hidden = false;
      $$('[data-form-intro]').forEach(function (el) { el.hidden = false; });
      field('name').focus();
    });

    // Prefill from links: contact.html?package=growth or ?service=Shopify
    (function prefill() {
      var q = new URLSearchParams(location.search);
      var svc = q.get('service');
      var pk = { starter: ['Starter', 'Google Business Profile'] }[q.get('package')];
      var sel = field('service');
      if (svc) { $$('option', sel).forEach(function (o) { if (o.value.toLowerCase() === svc.toLowerCase()) sel.value = o.value; }); }
      if (pk) {
        sel.value = pk[1];
        if (!field('details').value) field('details').value = "I'm interested in the " + pk[0] + ' package.';
      }
    })();
  }
})();

/* Homepage portfolio carousel: moves on its own, pauses on hover, focus or touch, and has pause / previous / next buttons */
(function () {
  var wrap = document.querySelector('[data-rail]');
  if (!wrap) return;
  var rail = wrap.querySelector('.proj-rail');
  var prev = wrap.querySelector('[data-rail-prev]'), next = wrap.querySelector('[data-rail-next]'), toggle = wrap.querySelector('[data-rail-toggle]');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var userPaused = reduce, hold = false, visible = true, last = 0, pos = 0, wait = 0, resumeAt = 0;
  function step() { var c = rail.querySelector('.proj'); return c ? c.getBoundingClientRect().width + parseFloat(getComputedStyle(rail).columnGap || 20) : 300; }
  function setToggle() {
    toggle.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
    toggle.setAttribute('aria-label', userPaused ? 'Resume automatic scrolling' : 'Pause automatic scrolling');
  }
  function holdFor(ms) { resumeAt = performance.now() + ms; }
  function tick(t) {
    var dt = Math.min(64, t - (last || t)); last = t;
    if (!userPaused && !hold && visible && t >= resumeAt && !document.hidden) {
      var max = rail.scrollWidth - rail.clientWidth;
      if (max > 4) {
        if (Math.abs(pos - rail.scrollLeft) > 2) pos = rail.scrollLeft;
        if (wait > 0) { wait -= dt; }
        else if (pos >= max - 1) { wait = 1400; rail.scrollTo({ left: 0, behavior: 'smooth' }); pos = 0; holdFor(1600); }
        else { pos = Math.min(max, pos + dt * 0.045); rail.scrollLeft = pos; }
      }
    } else { pos = rail.scrollLeft; }
    requestAnimationFrame(tick);
  }
  ['mouseenter', 'focusin', 'pointerdown', 'touchstart', 'wheel'].forEach(function (ev) {
    rail.addEventListener(ev, function () { hold = true; }, { passive: true });
  });
  ['mouseleave', 'focusout'].forEach(function (ev) { rail.addEventListener(ev, function () { hold = false; holdFor(1200); }); });
  ['pointerup', 'touchend', 'touchcancel'].forEach(function (ev) { rail.addEventListener(ev, function () { hold = false; holdFor(2500); }, { passive: true }); });
  prev.addEventListener('click', function () { rail.scrollBy({ left: -step(), behavior: 'smooth' }); holdFor(4000); });
  next.addEventListener('click', function () { rail.scrollBy({ left: step(), behavior: 'smooth' }); holdFor(4000); });
  toggle.addEventListener('click', function () { userPaused = !userPaused; setToggle(); });
  rail.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { rail.scrollBy({ left: step(), behavior: 'smooth' }); holdFor(4000); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { rail.scrollBy({ left: -step(), behavior: 'smooth' }); holdFor(4000); e.preventDefault(); }
  });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(wrap);
  setToggle();
  requestAnimationFrame(tick);
})();
