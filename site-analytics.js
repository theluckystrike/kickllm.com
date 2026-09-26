var MR_GA_ID = 'G-D96LRY3S6K';
var MR_CONSENT_MODE = 'basic'; // 'basic' | 'advanced'
/* KickLLM first-party analytics (GA4 + Consent Mode v2). One tag per page: <script src="/site-analytics.js" defer></script>
   basic (default): gtag.js is not requested and nothing is sent in the EEA/UK/CH (by /cdn-cgi/trace loc, and also
     when trace fails or says XX/T1) until the visitor presses Accept. Elsewhere it loads right after trace answers,
     with analytics_storage granted. A stored Decline, GPC or Do Not Track means it never loads.
   advanced: gtag.js loads at once for everyone (not under GPC/DNT); EEA/UK/CH default to denied, so Google gets
     cookieless pings until Accept.
   Ads signals are denied everywhere in both modes. Choice lives in localStorage mr_consent_v1 = {"a":"granted"|"denied",
   "t":ms} and is re-asked after 13 months. The country is never stored. [data-mr-consent-open] reopens the banner
   anywhere. page_location keeps only utm_* and gclid, so session_id and anything else never reach Google.
   The placeholder check uses a regex on purpose, so a sed replace of the ID touches only line 1. */
(function () {
  'use strict';
  var w = window, d = document, n = navigator, ID = MR_GA_ID, BASIC = MR_CONSENT_MODE !== 'advanced';
  w.mrTrack = function () {};
  if (!/^G-[A-Z0-9]{4,}$/.test(ID) || /^G-X+$/.test(ID) || w.__mrAnalytics) return;
  w.__mrAnalytics = 1;

  var KEY = 'mr_consent_v1', TTL = 34164000; // seconds, 13 months: cookie_expires and the re-ask window
  var REGION = ('AT BE BG HR CY CZ DK EE FI FR DE GR IE IT LV LT LU MT NL PL PT RO SK SI ES SE ' +
    'IS LI NO GB CH AX GF GP MQ RE YT MF').split(' ');
  var VALUE = { weekly: 9.99, lifetime: 199 };

  function get(k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { w.localStorage.setItem(k, v); } catch (e) {} }
  function del(k) { try { w.localStorage.removeItem(k); } catch (e) {} }
  function stored() {
    try {
      var c = JSON.parse(get(KEY) || 'null');
      if (c && (c.a === 'granted' || c.a === 'denied') && typeof c.t === 'number' && Date.now() - c.t < TTL * 1000) return c.a;
      if (c) del(KEY);
    } catch (e) { del(KEY); }
    return null;
  }
  function ext(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }
  function clip(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 100); }
  function base(u) { return u ? String(u).split(/[?#]/)[0].split('/').pop() : ''; }
  function clean(href) { // origin + path + utm_* and gclid only
    try {
      var u = new URL(href), q = [];
      u.searchParams.forEach(function (v, k) { if (/^utm_[a-z_]+$/i.test(k) || k === 'gclid') q.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); });
      return u.origin + u.pathname + (q.length ? '?' + q.join('&') : '');
    } catch (e) { return location.origin + location.pathname; }
  }
  function inRegion(c) { return !c || c === 'XX' || c === 'T1' || REGION.indexOf(c) >= 0; } // unknown counts as EEA

  var gpc = n.globalPrivacyControl === true || n.doNotTrack === '1' || w.doNotTrack === '1';
  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  w.gtag = gtag;

  var DENY = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
  if (gpc) {
    gtag('consent', 'default', ext(DENY, { analytics_storage: 'denied' }));
  } else {
    gtag('consent', 'default', ext(DENY, { analytics_storage: 'denied', wait_for_update: 500, region: REGION }));
    gtag('consent', 'default', ext(DENY, { analytics_storage: 'granted' }));
  }
  gtag('set', 'ads_data_redaction', true);
  gtag('set', 'url_passthrough', false);
  var choice = stored();
  if (choice) gtag('consent', 'update', { analytics_storage: choice });
  function optOut(on) { w['ga-disable-' + ID] = on; }
  if (gpc || (BASIC && choice === 'denied')) optOut(true);

  var booted = false, pending = [];
  function boot() {
    if (booted || gpc) return;
    booted = true;
    gtag('js', new Date());
    var cfg = { send_page_view: true, page_location: clean(location.href), cookie_expires: TTL };
    if (d.referrer) cfg.page_referrer = d.referrer.indexOf(location.origin + '/') === 0 ? clean(d.referrer) : d.referrer;
    gtag('config', ID, cfg);
    pending.forEach(function (x) { send(x[0], x[1], x[2]); });
    pending = [];
    var s = d.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ID);
    (d.head || d.documentElement).appendChild(s);
  }
  function send(name, p, done) { try { gtag('event', name, p); if (done) done(); } catch (e) {} }
  function track(name, p, done) {
    var e = ext(p, { transport_type: 'beacon' });
    if (booted) send(name, e, done); else if (!gpc && pending.length < 50) pending.push([name, e, done]);
  }
  w.mrTrack = function (name, p) { if (typeof name === 'string' && name) track(name, p || {}); };

  /* Stripe success_url is /welcome/?session_id=cs_... The page can't verify payment, so this is a return signal only.
     The session id never leaves the browser; a local hash dedupes reloads. */
  var sid = (/[?&]session_id=(cs_[A-Za-z0-9_]{8,300})/.exec(location.search) || [])[1];
  if (sid && /^\/welcome(\/|\/index\.html)?$/.test(location.pathname)) {
    var h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995;
    for (var i = 0; i < sid.length; i++) {
      h1 = Math.imul(h1 ^ sid.charCodeAt(i), 16777619) >>> 0;
      h2 = Math.imul(h2 ^ sid.charCodeAt(i), 2246822507) >>> 0;
    }
    var rk = 'mr_ret_' + h1.toString(16) + h2.toString(16);
    if (!get(rk)) track('checkout_return', { has_session: true }, function () { put(rk, '1'); });
  }

  /* ---------- consent banner ---------- */
  var cc; // country from /cdn-cgi/trace for this page view only; undefined until known, null when unknown
  function state() {
    if (gpc) return 'gpc';
    var c = stored();
    if (c) return c;
    if (cc === undefined) return null;
    if (inRegion(cc)) return BASIC || cc ? 'denied' : null;
    return 'granted';
  }
  var CSS = '.mrc{position:fixed;z-index:2147483600;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));' +
    'max-width:420px;margin:0 auto;box-sizing:border-box;padding:16px;border:1px solid rgba(255,255,255,.24);border-radius:20px;' +
    'background:#171716;color:#fffdf7;font:15px/1.45 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
    'text-align:left;box-shadow:0 18px 48px rgba(0,0,0,.45);color-scheme:dark;animation:mrc-in .2s ease-out}' +
    '.mrc *{box-sizing:border-box}' +
    '.mrc .mrc-title{margin:0 0 4px;padding:0;font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#F43F5E}' +
    '.mrc .mrc-text{margin:0 0 12px;padding:0;color:#d6d3cb}' +
    '.mrc .mrc-text a{color:#fffdf7;text-decoration:underline;text-underline-offset:3px}' +
    '.mrc .mrc-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
    '.mrc .mrc-btn{-webkit-appearance:none;appearance:none;min-height:44px;margin:0;padding:10px 14px;border:1px solid rgba(255,255,255,.24);' +
    'border-radius:999px;background:#212120;color:#fffdf7;font:inherit;font-weight:800;cursor:pointer}' +
    '.mrc .mrc-btn:hover{border-color:#F43F5E}' +
    '.mrc .mrc-btn:focus-visible,.mrc .mrc-text a:focus-visible{outline:3px solid #F43F5E;outline-offset:2px}' +
    '@media (min-width:760px){.mrc{left:auto;right:24px;bottom:calc(24px + env(safe-area-inset-bottom));max-width:none;' +
    'width:min(720px,calc(100% - 48px));display:grid;grid-template-columns:1fr auto;column-gap:20px;align-items:center;padding:14px 18px}' +
    '.mrc .mrc-title,.mrc .mrc-text{grid-column:1}.mrc .mrc-text{margin:0}' +
    '.mrc .mrc-actions{grid-column:2;grid-row:1/span 2;grid-template-columns:auto auto}.mrc .mrc-btn{min-width:112px}}' +
    '.mrc.mrc-light{background:#fffdf7;color:#090909;border-color:rgba(9,9,9,.18);box-shadow:0 18px 48px rgba(9,9,9,.18);color-scheme:light}' +
    '.mrc.mrc-light .mrc-title{color:#090909}.mrc.mrc-light .mrc-text{color:#55524b}.mrc.mrc-light .mrc-text a{color:#090909}' +
    '.mrc.mrc-light .mrc-btn{background:#f5f0e6;color:#090909;border-color:rgba(9,9,9,.24)}.mrc.mrc-light .mrc-btn:hover{border-color:#090909}' +
    '.mrc.mrc-light .mrc-btn:focus-visible,.mrc.mrc-light .mrc-text a:focus-visible{outline-color:#8d69ff}' +
    '@keyframes mrc-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
    '@media (prefers-reduced-motion:reduce){.mrc{animation:none}}' +
    '@media (forced-colors:active){.mrc,.mrc .mrc-btn{border:2px solid CanvasText}}';

  function lightPage() {
    try {
      var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(getComputedStyle(d.body).backgroundColor);
      return !!m && m[4] !== '0' && (0.299 * m[1] + 0.587 * m[2] + 0.114 * m[3]) > 160;
    } catch (e) { return false; }
  }
  var opener = null;
  function hide(back) {
    var b = d.getElementById('mrc-banner');
    if (b) b.parentNode.removeChild(b);
    if (back && opener && d.contains(opener) && opener.focus) opener.focus();
    opener = null;
  }
  function show(focus, from) {
    if (!d.body) { d.addEventListener('DOMContentLoaded', function () { show(focus, from); }); return; }
    hide(false);
    opener = from || null;
    if (!d.getElementById('mrc-style')) {
      var st = d.createElement('style');
      st.id = 'mrc-style';
      st.textContent = CSS;
      (d.head || d.documentElement).appendChild(st);
    }
    var now = state();
    var b = d.createElement('div');
    b.id = 'mrc-banner';
    b.className = 'mrc' + (lightPage() ? ' mrc-light' : '');
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-modal', 'false');
    b.setAttribute('aria-labelledby', 'mrc-title');
    b.setAttribute('aria-describedby', 'mrc-text');
    b.innerHTML = '<p class="mrc-title" id="mrc-title">Analytics cookies</p>' +
      '<p class="mrc-text" id="mrc-text">We use Google Analytics to see which posts bring people to KickLLM and what they click on. ' +
      (now === 'gpc' ? 'Your browser sends a privacy signal, so it stays off here. ' : now === 'granted' ? 'It&#39;s on right now. ' :
        now === 'denied' ? 'It&#39;s off until you accept. ' : '') +
      'We don&#39;t use it for ads. <a href="/privacy.html#analytics">How we use it</a></p>' +
      '<div class="mrc-actions">' + (now === 'gpc' ? '<button type="button" class="mrc-btn" data-mrc="close">Close</button>' :
        '<button type="button" class="mrc-btn" data-mrc="granted">Accept</button><button type="button" class="mrc-btn" data-mrc="denied">Decline</button>') +
      '</div>';
    b.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('[data-mrc]');
      if (btn) decide(btn.getAttribute('data-mrc'));
    });
    b.addEventListener('keydown', function (e) { if (e.key === 'Escape' || e.key === 'Esc') hide(true); });
    var bar = d.getElementById('joinBar'); // homepage fixed plan bar: keep it visible under the card
    var lift = bar && getComputedStyle(bar).position === 'fixed' && !bar.classList.contains('is-hidden') ?
      Math.round(w.innerHeight - bar.getBoundingClientRect().top + 12) : 0;
    if (lift > 12 && lift < w.innerHeight / 2) b.style.bottom = lift + 'px';
    d.body.appendChild(b);
    if (focus) b.querySelector('.mrc-btn').focus();
  }
  function clearGa() {
    try {
      var host = location.hostname.split('.');
      d.cookie.split(';').forEach(function (c) {
        var k = c.split('=')[0].trim();
        if (!/^_ga(_|$)/.test(k)) return;
        d.cookie = k + '=; Max-Age=0; path=/';
        for (var i = 0; i < host.length - 1; i++) {
          d.cookie = k + '=; Max-Age=0; path=/; domain=.' + host.slice(i).join('.');
          d.cookie = k + '=; Max-Age=0; path=/; domain=' + host.slice(i).join('.');
        }
      });
    } catch (e) {}
  }
  function decide(v) {
    if (v === 'granted' || v === 'denied') {
      put(KEY, JSON.stringify({ a: v, t: Date.now() }));
      gtag('consent', 'update', { analytics_storage: v });
      if (v === 'denied') { clearGa(); if (BASIC) optOut(true); } else { optOut(false); boot(); }
    }
    hide(true);
  }
  /* kickllm.com is served by GitHub Pages, which has no /cdn-cgi/trace (it 404s, and then every visitor would count
     as EEA). The site's own Margin Studio subdomain runs on Cloudflare, so its trace answers the country instead.
     It returns CORS *, and credentials are omitted. If it fails, the visitor is treated as EEA, as before. */
  var TRACE = 'https://margin.kickllm.com/cdn-cgi/trace';
  function country(cb) {
    var o = /[?&]mr_loc=([A-Za-z]{2})/.exec(location.search); // QA override: can only force the banner, never skip it
    if (o && REGION.indexOf(o[1].toUpperCase()) >= 0) return cb(o[1].toUpperCase());
    if (!w.fetch) return cb(null);
    var ctl = w.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 4000);
    w.fetch(TRACE, { credentials: 'omit', cache: 'no-store', signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r && r.ok ? r.text() : ''; })
      .then(function (t) { clearTimeout(timer); var m = /^loc=([A-Z0-9]{2})\s*$/m.exec(t || ''); cb(m ? m[1] : null); },
        function () { clearTimeout(timer); cb(null); });
  }

  if (!BASIC) boot(); // advanced: load now (never under GPC)
  else if (choice === 'granted') boot();
  if (!choice && !gpc) {
    country(function (c) {
      cc = c;
      if (BASIC && !inRegion(c)) return boot();
      if ((BASIC || c) && inRegion(c) && !stored() && !d.getElementById('mrc-banner')) show(false);
    });
  }

  /* ---------- events ---------- */
  function placement(el) {
    var p = el.closest('[data-mr-placement]'), nav = false;
    if (p) return clip(p.getAttribute('data-mr-placement'));
    if (el.getAttribute('data-track')) return clip(el.getAttribute('data-track'));
    for (var x = el; x && x !== d.body; x = x.parentElement) {
      var t = x.tagName;
      if ((t === 'SECTION' || t === 'ASIDE') && (x.id || x.classList[0])) return x.id || x.classList[0];
      if (t === 'ARTICLE' && x.id) return x.id;
      if (t === 'HEADER' || t === 'FOOTER') return t.toLowerCase() + (nav ? '_nav' : '');
      if (t === 'NAV') nav = true;
    }
    return nav ? 'nav' : 'main';
  }
  function planOf(el, href) {
    var m = /[?&]start=([^&#]*)/i.exec(href || ''), s = '';
    try { s = m ? decodeURIComponent(m[1]) : ''; } catch (e) { s = m[1]; }
    var h = el.closest('[data-mr-plan],[data-plan]');
    var srcs = [s, h && (h.getAttribute('data-mr-plan') || h.getAttribute('data-plan')), el.getAttribute('data-track'), el.textContent];
    for (var i = 0; i < srcs.length; i++) {
      var v = String(srcs[i] || '').toLowerCase(), wk = v.indexOf('weekly') >= 0, lt = v.indexOf('lifetime') >= 0;
      if (wk !== lt) return wk ? 'weekly' : 'lifetime';
    }
    return 'unknown';
  }
  var BOT = /^https?:\/\/(www\.)?(t|telegram)\.me\/makerollmembershipbot\/?([?#]|$)/i;
  var TG = /^https?:\/\/(www\.)?(t|telegram)\.me\/((makeroll_community|makeroll_com)(?=[\/?#]|$)|addlist\/)/i;
  var STRIPE = /^https:\/\/(checkout|buy)\.stripe\.com\//i;
  var AFTER_PURCHASE = /^\/(welcome|membership-help|withdraw)(\/|$)/;
  var HOME = location.pathname === '/' || location.pathname === '/index.html';

  function onClick(e) {
    var t = e.target;
    if (t && t.nodeType !== 1) t = t.parentElement;
    if (!t || !t.closest) return;
    var opn = t.closest('[data-mr-consent-open]');
    if (opn) { e.preventDefault(); show(true, opn); return; }
    if (t.closest('#mrc-banner')) return;
    var sum = t.closest('summary'), det = sum && sum.parentElement;
    if (det && det.tagName === 'DETAILS' && !det.open && !t.closest('a')) {
      var faq = det.classList.contains('faq') || det.closest('#faq,.faq-list,[data-mr-faq]');
      track(faq ? 'faq_open' : 'details_open', { question: clip(sum.textContent), placement: placement(det) });
      return;
    }
    var a = t.closest('a[href],button,[data-mr-checkout]');
    if (!a) return;
    var href = a.tagName === 'A' ? a.href : '';
    var plain = e.button === 0 && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);
    if (plain && (a.classList.contains('ig-load') || a.classList.contains('reference-play') || a.hasAttribute('data-mr-reel'))) {
      var ig = a.classList.contains('ig-load'), shell = a.parentElement;
      track('reel_load', {
        reel: clip(a.getAttribute('data-mr-reel') || (ig && shell && shell.id) || a.getAttribute('data-ig') || a.getAttribute('data-youtube')),
        reel_id: clip(a.getAttribute('data-ig') || a.getAttribute('data-youtube') || ''),
        reel_title: clip((a.getAttribute('data-title') || '').replace(/^Play\s+/i, '')),
        provider: ig ? 'instagram' : a.classList.contains('reference-play') ? 'youtube' : clip(a.getAttribute('data-mr-provider') || 'other'),
        placement: placement(a)
      });
      return;
    }
    if (BOT.test(href)) {
      track(AFTER_PURCHASE.test(location.pathname) ? 'bot_open' : 'join_click', { plan: planOf(a, href), placement: placement(a), link_url: clip(href) });
      return;
    }
    var tg = TG.exec(href);
    if (tg) {
      track('telegram_click', { target: tg[3] === 'addlist/' ? 'addlist' : tg[3].toLowerCase(), placement: placement(a), link_url: clip(href) });
      return;
    }
    if (STRIPE.test(href) || a.hasAttribute('data-mr-checkout')) {
      var plan = planOf(a, href), cp = { plan: plan, currency: 'USD', placement: placement(a) };
      if (VALUE[plan]) cp.value = VALUE[plan];
      track('begin_checkout', cp);
      return;
    }
    if (href && !HOME && a.origin === location.origin && (a.pathname === '/' || a.pathname === '/index.html') && /^#(plans|pricing)$/.test(a.hash)) {
      track('case_cta_click', { cta_target: a.hash.slice(1), placement: placement(a), link_text: clip(a.textContent), link_url: clip(href) });
      return;
    }
    if (HOME && a.getAttribute('data-track')) track('cta_click', { placement: placement(a) });
  }
  d.addEventListener('click', function (e) { try { onClick(e); } catch (err) {} }, true);

  var vids = typeof WeakMap === 'function' ? new WeakMap() : null;
  function vtitle(v) {
    var src = v.currentSrc || v.getAttribute('src') || (v.querySelector('source') || { getAttribute: function () { return ''; } }).getAttribute('src');
    return clip(v.getAttribute('data-title') || (v.getAttribute('aria-label') || '').replace(/^Play\s+/i, '') ||
      base(v.getAttribute('poster')) || base(src) || v.id || 'video');
  }
  function vevent(name, v, pct) {
    var p = { video_title: vtitle(v), video_percent: pct, video_provider: 'self', video_current_time: Math.round(v.currentTime || 0) };
    if (isFinite(v.duration) && v.duration > 0) p.video_duration = Math.round(v.duration);
    track(name, p);
  }
  function onMedia(e) {
    var v = e.target;
    if (!vids || !v || v.tagName !== 'VIDEO') return;
    var st = vids.get(v);
    if (!st) vids.set(v, st = {});
    if (e.type === 'play') { if (!st.start) { st.start = 1; vevent('video_start', v, 0); } return; }
    if (!st.start) return;
    if (e.type === 'ended') { if (!st.done) { st.done = 1; vevent('video_complete', v, 100); } return; }
    var dur = v.duration;
    if (!(isFinite(dur) && dur > 0)) return;
    var pct = (v.currentTime / dur) * 100;
    [25, 50, 75].forEach(function (m) { if (pct >= m && !st[m]) { st[m] = 1; vevent('video_progress', v, m); } });
  }
  ['play', 'timeupdate', 'ended'].forEach(function (t) {
    d.addEventListener(t, function (e) { try { onMedia(e); } catch (err) {} }, true);
  });
})();
