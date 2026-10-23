/* HelenTech analytics dashboard (vanilla JS, no third-party code). All data comes from /api/admin/* and every value is
   inserted with textContent, never as HTML. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var NS = 'http://www.w3.org/2000/svg';
  var TZ = -new Date().getTimezoneOffset();
  var state = { me: null, from: '', to: '', bucket: 'day', data: null, tab: 'overview', metric: 'visitors', pageFilter: 'all', pageSort: { key: 'views', dir: -1 }, pageSearch: '', loading: false, rtTimer: null, statsTimer: null };
  var COLORS = ['#2680BF', '#F78616', '#03448F', '#5AA6D8', '#FFB461', '#7A8CA5', '#1E8E5A', '#C0392B'];
  var TABS = { overview: 'Overview', pages: 'Pages', services: 'Services', traffic: 'Traffic & audience', leads: 'Leads', live: 'Live activity' };
  var EVENT_LABELS = { cta_click: 'Button clicks', whatsapp_click: 'WhatsApp clicks', email_click: 'Email clicks', call_click: 'Call clicks', portfolio_click: 'Portfolio projects opened', portfolio_filter: 'Portfolio filters used', popup_open: 'Enquiry pop-up opened', form_submit: 'Form sent (browser report)', download: 'Downloads', outbound_click: 'Outbound link clicks', faq_open: 'FAQ opened' };

  /* ---------------- tiny DOM helpers ---------------- */
  function h(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else if (k === 'class') e.className = attrs[k]; else e.setAttribute(k, attrs[k]); });
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c == null || c === false) continue; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return e;
  }
  function sv(tag, attrs) { var e = document.createElementNS(NS, tag); if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); for (var i = 2; i < arguments.length; i++) if (arguments[i]) e.appendChild(arguments[i]); return e; }
  function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); return e; }
  var nf = new Intl.NumberFormat('en-US');
  var num = function (n) { return nf.format(Math.round(n || 0)); };
  var pctf = function (n) { return (Math.round((n || 0) * 10) / 10) + '%'; };
  function dur(s) { s = Math.round(s || 0); if (s < 60) return s + 's'; var m = Math.floor(s / 60), r = s % 60; if (m < 60) return m + 'm ' + (r < 10 ? '0' : '') + r + 's'; return Math.floor(m / 60) + 'h ' + (m % 60) + 'm'; }
  var regions = null; try { regions = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) {}
  function country(c) { if (!c || c === 'Unknown') return 'Unknown'; try { return (regions && regions.of(c)) || c; } catch (e) { return c; } }
  function ago(iso) { var s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000); if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; return Math.floor(s / 3600) + ' h ago'; }
  function dateLabel(k, bucket) {
    if (bucket === 'month') { var p = k.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }); }
    var d = new Date(k + 'T00:00:00Z'); var t = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }); return bucket === 'week' ? 'Week of ' + t : t;
  }
  var isoLocal = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  /* ---------------- API ---------------- */
  function api(path, opts) {
    opts = opts || {};
    return fetch('/api/admin/' + path, { method: opts.method || 'GET', credentials: 'same-origin', headers: Object.assign({ 'X-Requested-With': 'HT-Admin' }, opts.body ? { 'Content-Type': 'application/json' } : {}), body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { if (r.status === 401 && path !== 'login') { if (path !== 'me') { showLogin('Your session ended. Please sign in again.'); throw new Error('auth'); } } if (!r.ok) { var e = new Error(b.error || 'Request failed'); e.status = r.status; throw e; } return b; }); });
  }

  /* ---------------- sign in / out ---------------- */
  function showLogin(msg) {
    stopTimers(); $('#appView').hidden = true; $('#loginView').hidden = false;
    var box = $('#loginError'); if (msg) { box.textContent = msg; box.hidden = false; } else box.hidden = true;
    $('#password').value = ''; $('#email').focus();
  }
  function showApp() { $('#loginView').hidden = true; $('#appView').hidden = false; }
  $('#togglePw').addEventListener('click', function () { var i = $('#password'), show = i.type === 'password'; i.type = show ? 'text' : 'password'; this.textContent = show ? 'Hide' : 'Show'; this.setAttribute('aria-pressed', String(show)); this.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); });
  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault(); var btn = $('#loginBtn'), box = $('#loginError'); box.hidden = true;
    var email = $('#email').value.trim(), pw = $('#password').value;
    if (!email || !pw) { box.textContent = 'Enter your email and password.'; box.hidden = false; return; }
    btn.disabled = true; btn.textContent = 'Signing in...';
    api('login', { method: 'POST', body: { email: email, password: pw } })
      .then(function (me) { state.me = me; boot(); })
      .catch(function (err) { box.textContent = err.message === 'auth' ? 'Sign in failed.' : err.message; box.hidden = false; })
      .then(function () { btn.disabled = false; btn.textContent = 'Sign in'; });
  });
  $('#logoutBtn').addEventListener('click', function () { api('logout', { method: 'POST' }).catch(function () {}).then(function () { state.me = null; state.data = null; showLogin(); }); });

  /* ---------------- date range ---------------- */
  function applyPreset(p) {
    var now = new Date(), to = new Date(now), from = new Date(now);
    if (p === 'yesterday') { from.setDate(from.getDate() - 1); to.setDate(to.getDate() - 1); }
    else if (p === 'month') { from = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (p !== 'today' && p !== 'custom') { from.setDate(from.getDate() - (parseInt(p, 10) - 1)); }
    if (p !== 'custom') { $('#from').value = isoLocal(from); $('#to').value = isoLocal(to); }
  }
  $('#preset').addEventListener('change', function () { applyPreset(this.value); if (this.value !== 'custom') load(); });
  ['from', 'to'].forEach(function (id) { $('#' + id).addEventListener('change', function () { $('#preset').value = 'custom'; }); });
  $('#applyBtn').addEventListener('click', function () { load(); });
  $('#bucket').addEventListener('change', function () { load(); });
  $('#retryBtn').addEventListener('click', function () { load(); });

  /* ---------------- routing ---------------- */
  function route() {
    var t = (location.hash || '#overview').slice(1); if (!TABS[t]) t = 'overview'; state.tab = t;
    $$('[data-view]').forEach(function (s) { s.hidden = s.getAttribute('data-view') !== t; });
    $$('#nav a').forEach(function (a) { if (a.getAttribute('data-tab') === t) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('#pageTitle').textContent = TABS[t]; document.title = TABS[t] + ' | HelenTech Analytics';
    var rangeOff = t === 'live'; $('.range').hidden = rangeOff; $('#basis').hidden = rangeOff;
    closeMenu(); if (t === 'live') pollRealtime();
  }
  window.addEventListener('hashchange', route);
  function closeMenu() { $('#side').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false'); }
  $('#menuBtn').addEventListener('click', function () { var o = $('#side').classList.toggle('open'); this.setAttribute('aria-expanded', String(o)); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

  /* ---------------- shared widgets ---------------- */
  var tip = $('#tip');
  function showTip(e, lines) { clear(tip); lines.forEach(function (l, i) { tip.appendChild(h(i ? 'div' : 'b', { text: l })); }); tip.hidden = false; var x = Math.min(window.innerWidth - 250, e.clientX + 14); tip.style.left = Math.max(8, x) + 'px'; tip.style.top = (e.clientY + 14) + 'px'; }
  function hideTip() { tip.hidden = true; }
  function empty(node, title, text) { clear(node).appendChild(h('div', { class: 'empty' }, h('b', { text: title }), text || '')); }
  function bars(node, items, opts) {
    opts = opts || {}; clear(node); if (!items.length) return empty(node, 'No data yet', 'Nothing was recorded in this period.');
    var max = Math.max.apply(null, items.map(function (i) { return i.value; })) || 1; var wrap = h('div', { class: 'bars' });
    items.forEach(function (i) { wrap.appendChild(h('div', { class: 'bar-row' }, h('div', { class: 'bar-top' }, h('span', { text: i.label }), h('span', { text: i.text != null ? i.text : num(i.value) })), h('div', { class: 'bar-track' }, h('div', { class: 'bar-fill' + (opts.orange ? ' o' : ''), style: 'width:' + Math.max(2, (i.value / max) * 100) + '%' })))); });
    node.appendChild(wrap);
  }
  function list(node, items) { clear(node); if (!items.length) return empty(node, 'No data yet'); var l = h('div', { class: 'list' }); items.forEach(function (i) { l.appendChild(h('div', { class: 'li' }, h('span', { text: i.label }), h('b', { text: i.text }))); }); node.appendChild(l); }
  function donut(node, items, centre) {
    clear(node); var total = items.reduce(function (a, i) { return a + i.value; }, 0); if (!total) return empty(node, 'No data yet', 'Nothing was recorded in this period.');
    var r = 54, c = 2 * Math.PI * r, off = 0; var svg = sv('svg', { viewBox: '0 0 140 140', width: 150, height: 150, role: 'img', 'aria-label': items.map(function (i) { return i.label + ' ' + num(i.value); }).join(', ') });
    svg.appendChild(sv('circle', { cx: 70, cy: 70, r: r, fill: 'none', stroke: '#EEF2F7', 'stroke-width': 18 }));
    items.forEach(function (i, n) { var len = (i.value / total) * c; var seg = sv('circle', { cx: 70, cy: 70, r: r, fill: 'none', stroke: COLORS[n % COLORS.length], 'stroke-width': 18, 'stroke-dasharray': len + ' ' + (c - len), 'stroke-dashoffset': -off, transform: 'rotate(-90 70 70)' }); off += len; svg.appendChild(seg); });
    var t1 = sv('text', { x: 70, y: 68, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700, fill: '#14171C' }); t1.textContent = centre != null ? centre : num(total);
    var t2 = sv('text', { x: 70, y: 86, 'text-anchor': 'middle', 'font-size': 10, fill: '#5B6472' }); t2.textContent = 'total'; svg.appendChild(t1); svg.appendChild(t2);
    var lg = h('ul', { class: 'legend' }); items.forEach(function (i, n) { lg.appendChild(h('li', null, h('span', { class: 'sw', style: 'background:' + COLORS[n % COLORS.length] }), h('span', { text: i.label }), h('b', { text: num(i.value) + ' (' + Math.round((i.value / total) * 100) + '%)' }))); });
    node.appendChild(h('div', { class: 'donut-wrap' }, svg, lg));
  }
  function lineChart(node, series, key, bucket, color) {
    clear(node); var total = series.reduce(function (a, s) { return a + s[key]; }, 0);
    if (!series.length || !total) return empty(node, 'No ' + key + ' recorded', 'Try a wider date range. Data only appears for visitors who accepted analytics.');
    var W = 720, H = 260, L = 44, R = 12, T = 12, B = 30, iw = W - L - R, ih = H - T - B;
    var max = Math.max.apply(null, series.map(function (s) { return s[key]; })); var step = Math.max(1, Math.pow(10, Math.floor(Math.log10(max || 1)))); var top = Math.max(1, Math.ceil(max / step) * step); if (top / step < 3) { step = step / 2; top = Math.max(1, Math.ceil(max / step) * step); }
    var x = function (i) { return L + (series.length === 1 ? iw / 2 : (i / (series.length - 1)) * iw); }, y = function (v) { return T + ih - (v / top) * ih; };
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Line chart of ' + key + ' over time' });
    var defs = sv('defs', null, sv('linearGradient', { id: 'g', x1: 0, y1: 0, x2: 0, y2: 1 }, sv('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': 0.28 }), sv('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0 }))); svg.appendChild(defs);
    for (var v = 0; v <= top + 0.001; v += step) { svg.appendChild(sv('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid-l' })); var tx = sv('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'axis' }); tx.textContent = num(v); svg.appendChild(tx); }
    var every = Math.ceil(series.length / 8), last = series.length - 1; series.forEach(function (s, i) { if (i === last || (i % every === 0 && last - i >= Math.ceil(every / 2))) { var t = sv('text', { x: x(i), y: H - 8, 'text-anchor': i === 0 ? 'start' : (i === series.length - 1 ? 'end' : 'middle'), class: 'axis' }); t.textContent = dateLabel(s.date, bucket).replace('Week of ', ''); svg.appendChild(t); } });
    var pts = series.map(function (s, i) { return x(i) + ',' + y(s[key]); });
    svg.appendChild(sv('polygon', { points: L + ',' + (T + ih) + ' ' + pts.join(' ') + ' ' + x(series.length - 1) + ',' + (T + ih), fill: 'url(#g)' }));
    svg.appendChild(sv('polyline', { points: pts.join(' '), fill: 'none', stroke: color, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));
    var colW = series.length === 1 ? iw : iw / (series.length - 1);
    series.forEach(function (s, i) {
      if (series.length <= 45) svg.appendChild(sv('circle', { cx: x(i), cy: y(s[key]), r: 3, fill: '#fff', stroke: color, 'stroke-width': 2 }));
      var hit = sv('rect', { x: x(i) - colW / 2, y: T, width: colW, height: ih, class: 'hit', tabindex: 0, 'aria-label': dateLabel(s.date, bucket) + ': ' + num(s[key]) });
      hit.addEventListener('mousemove', function (e) { showTip(e, [dateLabel(s.date, bucket), num(s[key]) + ' ' + key, 'Visitors ' + num(s.visitors) + ' · Sessions ' + num(s.sessions)]); }); hit.addEventListener('mouseleave', hideTip);
      hit.addEventListener('focus', function () { var r = hit.getBoundingClientRect(); showTip({ clientX: r.left, clientY: r.top }, [dateLabel(s.date, bucket), num(s[key]) + ' ' + key]); }); hit.addEventListener('blur', hideTip); svg.appendChild(hit);
    });
    node.appendChild(svg);
  }
  /* sortable, searchable table */
  function table(node, cols, rows, opts) {
    opts = opts || {}; clear(node);
    if (!rows.length) { var wrap = node.parentNode; node.hidden = true; var ex = wrap.querySelector('.empty'); if (ex) ex.remove(); wrap.appendChild(h('div', { class: 'empty' }, h('b', { text: opts.emptyTitle || 'No data yet' }), opts.emptyText || 'Nothing was recorded in this period.')); return; }
    node.hidden = false; var old = node.parentNode.querySelector('.empty'); if (old) old.remove();
    var sort = opts.sort, thead = h('tr'), tbody = h('tbody');
    cols.forEach(function (c) {
      var th = h('th', { scope: 'col', class: c.num ? 'num' : '' });
      if (opts.onSort && c.sortable !== false) { var b = h('button', { type: 'button', text: c.label }); b.addEventListener('click', function () { opts.onSort(c.key); }); th.appendChild(b); th.setAttribute('aria-sort', sort && sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'); } else th.textContent = c.label;
      thead.appendChild(th);
    });
    rows.forEach(function (r) { var tr = h('tr'); cols.forEach(function (c) { var td = h('td', { class: (c.num ? 'num ' : '') + (c.wrap ? 'wrap' : '') }); var v = c.render ? c.render(r) : r[c.key]; if (v instanceof Node) td.appendChild(v); else td.textContent = v == null ? '' : String(v); tr.appendChild(td); }); tbody.appendChild(tr); });
    node.appendChild(h('thead', null, thead)); node.appendChild(tbody);
  }
  var simple = function (id, cols, rows, emptyText) { table($(id), cols, rows, { emptyText: emptyText }); };

  /* ---------------- KPI cards ---------------- */
  function delta(cur, prev, isRate, lowerBetter) {
    if (prev == null) return h('span', { class: 'muted', text: '' });
    var diff = cur - prev; if (!prev && !cur) return h('span', { class: 'muted', text: 'no change' });
    var label = isRate ? (diff >= 0 ? '+' : '') + (Math.round(diff * 10) / 10) + ' pts' : (prev ? (diff >= 0 ? '+' : '') + Math.round((diff / prev) * 100) + '%' : 'new');
    var good = lowerBetter ? diff <= 0 : diff >= 0; return h('span', { class: diff === 0 ? 'muted' : (good ? 'up' : 'down'), text: (diff > 0 ? '▲ ' : diff < 0 ? '▼ ' : '') + label });
  }
  function kpiCard(node, k, v, cur, prev, o) { o = o || {}; node.appendChild(h('div', { class: 'card' + (o.orange ? ' orange' : '') }, h('div', { class: 'k', text: k }), h('div', { class: 'v', text: v }), h('div', { class: 'd' }, delta(cur, prev, o.rate, o.lowerBetter), h('span', { text: 'vs previous period' })), o.note ? h('div', { class: 'n', text: o.note }) : null)); }

  /* ---------------- render ---------------- */
  function render() {
    var d = state.data; if (!d) return; var s = d.summary, p = d.previous || {};
    var kp = clear($('#kpis'));
    kpiCard(kp, 'Visitors', num(s.visitors), s.visitors, p.visitors, { note: num(s.newVisitors) + ' new · ' + num(s.returningVisitors) + ' returning' });
    kpiCard(kp, 'Sessions', num(s.sessions), s.sessions, p.sessions);
    kpiCard(kp, 'Page views', num(s.pageviews), s.pageviews, p.pageviews, { note: s.avgPagesPerSession + ' pages per session' });
    kpiCard(kp, 'Avg. time per session', dur(s.avgSessionSeconds), s.avgSessionSeconds, p.avgSessionSeconds, { note: 'Estimated active time' });
    kpiCard(kp, 'Bounce rate', pctf(s.bounceRate), s.bounceRate, p.bounceRate, { rate: true, lowerBetter: true, note: 'One page, no clicks' });
    kpiCard(kp, 'Enquiries', num(s.enquiries), s.enquiries, p.enquiries, { orange: true, note: s.enquiriesUnattributed ? num(s.enquiriesUnattributed) + ' without analytics consent' : 'Completed forms only' });
    kpiCard(kp, 'Conversion rate', pctf(s.conversionRate), s.conversionRate, p.conversionRate, { rate: true, orange: true, note: 'Sessions that sent an enquiry' });
    kpiCard(kp, 'Total engagement', dur(s.engagedSecondsTotal), s.engagedSecondsTotal, p.engagedSecondsTotal, { note: 'All visitors combined' });
    drawTrend();
    donut($('#nvDonut'), [{ label: 'New visitors', value: s.newVisitors }, { label: 'Returning visitors', value: s.returningVisitors }], num(s.visitors));
    bars($('#topPages'), d.pages.slice(0, 6).map(function (r) { return { label: r.name || r.title || r.path, value: r.views, text: num(r.views) + ' views' }; }));
    bars($('#srcBars'), d.sources.slice(0, 6).map(function (r) { return { label: r.source, value: r.sessions, text: num(r.sessions) + ' · ' + r.share + '%' }; }));
    donut($('#devDonut'), d.devices.map(function (r) { return { label: r.device.charAt(0).toUpperCase() + r.device.slice(1), value: r.sessions }; }));
    var f = clear($('#funnel')); var top = (d.funnel[0] && d.funnel[0].value) || 0;
    if (!top) empty($('#funnel'), 'No sessions yet'); else { var fw = h('div', { class: 'funnel' }); d.funnel.forEach(function (st) { fw.appendChild(h('div', { class: 'f-row' }, h('span', { text: st.step }), h('div', null, h('div', { class: 'f-bar', style: 'width:' + Math.max(1, (st.value / top) * 100) + '%' })), h('b', { text: num(st.value) }))); }); f.appendChild(fw); }
    bars($('#svcBars'), d.services.filter(function (x) { return x.pageViews + x.articleViews; }).map(function (x) { return { label: x.service, value: x.pageViews + x.articleViews, text: num(x.pageViews) + ' page · ' + num(x.articleViews) + ' articles' }; }), { orange: true });
    renderPages(); renderServices(); renderTraffic(); renderLeads();
  }
  function drawTrend() { var d = state.data; if (!d) return; var m = state.metric; lineChart($('#trendChart'), d.series, m, d.meta.bucket, m === 'enquiries' ? '#F78616' : '#2680BF'); }
  $('#metricSeg').addEventListener('click', function (e) { var b = e.target.closest('button[data-m]'); if (!b) return; state.metric = b.getAttribute('data-m'); $$('#metricSeg button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); drawTrend(); });

  function renderPages() {
    var d = state.data, rows = d.pages.slice(), q = state.pageSearch.trim().toLowerCase(), f = state.pageFilter;
    if (q) rows = rows.filter(function (r) { return (r.path + ' ' + r.title + ' ' + r.name).toLowerCase().indexOf(q) > -1; });
    if (f === 'low') rows = rows.filter(function (r) { return r.flag === 'high-traffic-low-engagement'; });
    if (f === 'eng') rows = rows.filter(function (r) { return r.views >= 1; });
    var sk = state.pageSort.key, dir = state.pageSort.dir; if (f === 'top') { sk = 'views'; dir = -1; } if (f === 'eng') { sk = 'avgSeconds'; dir = -1; }
    rows.sort(function (a, b) { var x = a[sk], y = b[sk]; if (typeof x === 'string') return x.localeCompare(y) * dir; return ((x == null ? -1 : x) - (y == null ? -1 : y)) * dir; });
    var cols = [
      { key: 'path', label: 'Page', wrap: true, render: function (r) { return h('div', null, h('div', { class: 'pgname', text: r.name || r.title || r.path }), h('div', { class: 'pgurl', text: r.path + (r.title && r.name ? ' · ' + r.title : '') })); } },
      { key: 'views', label: 'Views', num: true, render: function (r) { return num(r.views); } }, { key: 'visitors', label: 'Visitors', num: true, render: function (r) { return num(r.visitors); } },
      { key: 'avgSeconds', label: 'Avg. time', num: true, render: function (r) { return dur(r.avgSeconds); } }, { key: 'totalSeconds', label: 'Total time', num: true, render: function (r) { return dur(r.totalSeconds); } },
      { key: 'entrances', label: 'Entrances', num: true, render: function (r) { return num(r.entrances); } }, { key: 'bounceRate', label: 'Bounce', num: true, render: function (r) { return r.bounceRate == null ? '-' : pctf(r.bounceRate); } },
      { key: 'exits', label: 'Exits', num: true, render: function (r) { return num(r.exits); } }, { key: 'exitRate', label: 'Exit rate', num: true, render: function (r) { return pctf(r.exitRate); } },
      { key: 'flag', label: 'Insight', sortable: false, render: function (r) { return r.flag === 'high-engagement' ? h('span', { class: 'badge hi', text: 'High engagement' }) : r.flag ? h('span', { class: 'badge lo', text: 'High traffic, low engagement' }) : ''; } },
    ];
    table($('#pagesTbl'), cols, rows, { sort: state.pageSort, onSort: function (k) { state.pageFilter = 'all'; $$('#pageFilter button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-f') === 'all')); }); state.pageSort = { key: k, dir: state.pageSort.key === k ? -state.pageSort.dir : (k === 'path' ? 1 : -1) }; renderPages(); }, emptyTitle: q ? 'No pages match your search' : 'No page views yet', emptyText: q ? 'Try a different search.' : 'Page views appear here once visitors accept analytics.' });
    $('#pagesNote').textContent = 'Time on page = active, visible time (estimate). Bounce = one page, no clicks. "High traffic, low engagement" = viewed at least as often as the median page but in the lowest quarter for time on page (pages with 3+ views only). New pages appear automatically.';
  }
  $('#pageFilter').addEventListener('click', function (e) { var b = e.target.closest('button[data-f]'); if (!b) return; state.pageFilter = b.getAttribute('data-f'); $$('#pageFilter button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); renderPages(); });
  $('#pageSearch').addEventListener('input', function () { state.pageSearch = this.value; renderPages(); });

  function renderServices() {
    var d = state.data;
    simple('#svcTbl', [{ key: 'service', label: 'Service' }, { key: 'pageViews', label: 'Service page views', num: true, render: function (r) { return num(r.pageViews); } }, { key: 'articleViews', label: 'Article views', num: true, render: function (r) { return num(r.articleViews); } }, { key: 'visitors', label: 'Visitors', num: true, render: function (r) { return num(r.visitors); } }, { key: 'avgSeconds', label: 'Avg. time', num: true, render: function (r) { return dur(r.avgSeconds); } }, { key: 'ctaClicks', label: 'Contact clicks', num: true, render: function (r) { return num(r.ctaClicks); } }, { key: 'enquiries', label: 'Enquiries', num: true, render: function (r) { return num(r.enquiries); } }], d.services, 'Service page views will appear here.');
    list($('#ctaList'), d.ctaLabels.map(function (c) { return { label: c.label, text: num(c.count) }; }));
    list($('#portList'), d.portfolio.map(function (c) { return { label: c.label, text: num(c.count) }; }));
  }
  function renderTraffic() {
    var d = state.data;
    var cols = function (k, label) { return [{ key: k, label: label, render: function (r) { return k === 'country' ? country(r[k]) : r[k]; } }, { key: 'sessions', label: 'Sessions', num: true, render: function (r) { return num(r.sessions); } }, { key: 'visitors', label: 'Visitors', num: true, render: function (r) { return num(r.visitors); } }]; };
    simple('#srcTbl', [{ key: 'source', label: 'Source' }, { key: 'sessions', label: 'Sessions', num: true, render: function (r) { return num(r.sessions); } }, { key: 'visitors', label: 'Visitors', num: true, render: function (r) { return num(r.visitors); } }, { key: 'share', label: 'Share', num: true, render: function (r) { return r.share + '%'; } }, { key: 'enquiries', label: 'Enquiries', num: true, render: function (r) { return num(r.enquiries); } }, { key: 'conversionRate', label: 'Conv. rate', num: true, render: function (r) { return pctf(r.conversionRate); } }], d.sources);
    donut($('#devDonut2'), d.devices.map(function (r) { return { label: r.device.charAt(0).toUpperCase() + r.device.slice(1), value: r.sessions }; }));
    bars($('#browserBars'), d.browsers.map(function (b) { return { label: b.browser, value: b.sessions }; }));
    simple('#refTbl', cols('host', 'Website'), d.referrers, 'No referring websites in this period.'); simple('#campTbl', cols('campaign', 'Campaign'), d.campaigns, 'No UTM campaigns in this period.');
    simple('#ctyTbl', cols('country', 'Country'), d.countries, 'Location data is not available yet.'); simple('#cityTbl', cols('city', 'City'), d.cities, 'City data is not available yet.');
  }
  function renderLeads() {
    var d = state.data, s = d.summary, L = d.leads, p = d.previous || {}; var kp = clear($('#leadKpis'));
    kpiCard(kp, 'Enquiries', num(s.enquiries), s.enquiries, p.enquiries, { orange: true }); kpiCard(kp, 'Conversion rate', pctf(s.conversionRate), s.conversionRate, p.conversionRate, { rate: true, orange: true, note: 'Sessions with an enquiry' });
    kpiCard(kp, 'With source data', num(s.enquiriesAttributed), s.enquiriesAttributed, p.enquiriesAttributed, { note: 'Visitor accepted analytics' }); kpiCard(kp, 'Without source data', num(s.enquiriesUnattributed), s.enquiriesUnattributed, p.enquiriesUnattributed, { note: 'Visitor did not accept analytics' });
    lineChart($('#leadChart'), d.series, 'enquiries', d.meta.bucket, '#F78616');
    simple('#leadPagesTbl', [{ key: 'path', label: 'Submitted from', wrap: true, render: function (r) { return (PAGE[r.path] || r.path); } }, { key: 'enquiries', label: 'Enquiries', num: true, render: function (r) { return num(r.enquiries); } }, { key: 'views', label: 'Page views', num: true, render: function (r) { return num(r.views); } }, { key: 'rate', label: 'Rate', num: true, render: function (r) { return r.rate == null ? '-' : pctf(r.rate); } }], L.byPage, 'No enquiries in this period yet.');
    bars($('#leadLanding'), L.byLanding.map(function (r) { return { label: PAGE[r.key] || r.key, value: r.count }; }), { orange: true });
    bars($('#leadSource'), L.bySource.map(function (r) { return { label: r.key, value: r.count }; }), { orange: true }); bars($('#leadService'), L.byService.map(function (r) { return { label: r.key, value: r.count }; }), { orange: true }); bars($('#leadType'), L.byType.map(function (r) { return { label: r.key, value: r.count }; }), { orange: true });
    simple('#evTbl', [{ key: 'name', label: 'Action', render: function (r) { return EVENT_LABELS[r.name] || r.name; } }, { key: 'count', label: 'Times', num: true, render: function (r) { return num(r.count); } }, { key: 'sessions', label: 'Sessions', num: true, render: function (r) { return num(r.sessions); } }], d.events, 'No clicks recorded yet.');
    simple('#recentTbl', [{ key: 'at', label: 'When', render: function (r) { return new Date(r.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } }, { key: 'page', label: 'From', render: function (r) { return PAGE[r.page] || r.page || '-'; } }, { key: 'service', label: 'Service', render: function (r) { return r.service || '-'; } }, { key: 'type', label: 'Type', render: function (r) { return r.type || '-'; } }, { key: 'source', label: 'Source', render: function (r) { return r.source || 'Unknown'; } }], L.recent, 'Enquiries will be listed here.');
  }
  var PAGE = { '/': 'Home', '/about.html': 'About', '/google-services.html': 'Services', '/portfolio.html': 'Portfolio', '/blog.html': 'Blog', '/contact.html': 'Contact', '/pricing.html': 'Pricing', '/faq.html': 'FAQ', '/reviews.html': 'Testimonials', '/google-business-profile.html': 'Google Business Profile', '/google-merchant-center.html': 'Google Merchant Center', '/google-ads.html': 'Google Ads', '/google-analytics-4.html': 'Google Analytics 4' };

  /* ---------------- loading ---------------- */
  function skeleton() { var k = clear($('#kpis')); for (var i = 0; i < 8; i++) k.appendChild(h('div', { class: 'skel card' })); ['#trendChart', '#nvDonut', '#topPages', '#srcBars', '#devDonut', '#funnel', '#svcBars'].forEach(function (s) { clear($(s)).appendChild(h('div', { class: 'skel block' })); }); }
  function load() {
    if (state.loading) return; state.from = $('#from').value; state.to = $('#to').value; state.bucket = $('#bucket').value;
    if (!state.from || !state.to || state.from > state.to) { showError('Choose a valid date range: the start date must be before the end date.'); return; }
    state.loading = true; $('#errorBar').hidden = true; $('#applyBtn').disabled = true; skeleton();
    api('stats?from=' + state.from + '&to=' + state.to + '&tz=' + TZ + '&bucket=' + state.bucket)
      .then(function (d) { state.data = d; render(); if (d.meta.truncated) showError('This range has a very large number of records, so the figures may be incomplete. Choose a shorter range.'); })
      .catch(function (e) { if (e.message !== 'auth') showError(e.message || 'Could not load the data.'); })
      .then(function () { state.loading = false; $('#applyBtn').disabled = false; });
  }
  function showError(msg) { $('#errorText').textContent = msg; $('#errorBar').hidden = false; }

  /* ---------------- real time ---------------- */
  function pollRealtime() {
    api('realtime').then(function (r) {
      $('#liveCount').textContent = num(r.online); if (state.tab !== 'live') return;
      var k = clear($('#liveKpis')); k.appendChild(h('div', { class: 'card orange' }, h('div', { class: 'k', text: 'Online now' }), h('div', { class: 'v', text: num(r.online) }), h('div', { class: 'n', text: 'Active in the last ' + r.windowMinutes + ' minutes' })));
      k.appendChild(h('div', { class: 'card' }, h('div', { class: 'k', text: 'Pages being viewed' }), h('div', { class: 'v', text: num(r.pages.length) }), h('div', { class: 'n', text: 'Different pages right now' })));
      k.appendChild(h('div', { class: 'card' }, h('div', { class: 'k', text: 'Page views (last hour)' }), h('div', { class: 'v', text: num(r.feed.filter(function (f) { return f.type === 'pageview'; }).length) }), h('div', { class: 'n', text: 'Latest 40 items shown below' })));
      k.appendChild(h('div', { class: 'card' }, h('div', { class: 'k', text: 'Enquiries (last hour)' }), h('div', { class: 'v', text: num(r.feed.filter(function (f) { return f.type === 'enquiry'; }).length) }), h('div', { class: 'n', text: 'Completed forms' })));
      list($('#livePages'), r.pages.map(function (p) { return { label: PAGE[p.path] || p.path, text: num(p.visitors) }; })); list($('#liveCountries'), r.countries.map(function (c) { return { label: country(c.country), text: num(c.visitors) }; }));
      var f = clear($('#feed')); if (!r.feed.length) f.appendChild(h('li', null, h('span'), h('div', { class: 's', text: 'No activity in the last hour.' }), h('span')));
      r.feed.forEach(function (it) { var ic = it.type === 'enquiry' ? 'lead' : it.type === 'event' ? 'ev' : ''; var title = it.type === 'pageview' ? 'Viewed ' + (PAGE[it.path] || it.label) : it.type === 'enquiry' ? 'Enquiry sent' : (EVENT_LABELS[it.label] || it.label); var sub = [it.type === 'pageview' ? it.path : it.detail || it.path, it.device, it.country ? country(it.country) : ''].filter(Boolean).join(' · ');
        f.appendChild(h('li', null, h('span', { class: 'ic ' + ic }, sv('svg', { viewBox: '0 0 24 24' }, sv('circle', { cx: 12, cy: 12, r: it.type === 'pageview' ? 3 : 5 }))), h('div', null, h('div', { class: 't', text: title }), h('div', { class: 's', text: sub })), h('time', { datetime: it.at, text: ago(it.at) }))); });
      $('#liveStamp').textContent = 'Updated ' + new Date().toLocaleTimeString('en-GB');
    }).catch(function () {});
  }
  function stopTimers() { clearInterval(state.rtTimer); clearInterval(state.statsTimer); }
  function startTimers() { stopTimers(); state.rtTimer = setInterval(function () { if (!document.hidden) pollRealtime(); }, 15000); state.statsTimer = setInterval(function () { if (!document.hidden && $('#to').value === isoLocal(new Date())) { state.loading || load(); } }, 120000); }

  /* ---------------- export ---------------- */
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-export]'); if (!b) return; window.location.href = '/api/admin/export?type=' + encodeURIComponent(b.getAttribute('data-export')) + '&from=' + state.from + '&to=' + state.to + '&tz=' + TZ + '&bucket=' + state.bucket; });

  /* ---------------- start ---------------- */
  function boot() {
    showApp(); $('#whoEmail').textContent = state.me.email; $('#whoRole').textContent = state.me.role === 'owner' ? 'Owner' : 'Viewer (read-only)'; $('#avatar').textContent = (state.me.email || 'H').charAt(0).toUpperCase();
    $$('[data-export]').forEach(function (b) { b.hidden = state.me.role !== 'owner'; });
    if (!$('#from').value) applyPreset('30'); route(); load(); pollRealtime(); startTimers();
  }
  api('me').then(function (me) { state.me = me; boot(); }).catch(function (e) { showLogin(e.status === 503 ? e.message : ''); });
})();
