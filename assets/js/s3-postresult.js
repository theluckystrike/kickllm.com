/* Sprint 3 (2026-11-16) lane D2: post-result offer (data-cro="sprint-20261116-postresult").
   The offer block is in the server HTML right after the tool's result. With JS it waits until the visitor
   has used the tool (input/change/click inside data-s3-tool), then shows. Without data-s3-tool it is always shown.
   offer_view: once, only after a real interaction AND when at least half the block is on screen.
   begin_checkout: on a.s3-buy click when data-s3-bc="self" (sites whose own tracker does not count this link);
   a button[data-s3-checkout] POSTs the site's own checkout route and goes straight to checkout.stripe.com.
   data-s3-manual: the page dispatches 's3:show' on the block when its result is ready.
   Not-ready form (PAY7): same markup and Worker call as lane D1 (one delegated handler per page). */
(function () {
  'use strict';
  var blocks = Array.prototype.slice.call(document.querySelectorAll('[data-s3-post]'));
  if (!blocks.length) return;
  function track(name, p) {
    try {
      if (typeof window.__siteGA4Event === 'function') return window.__siteGA4Event(name, p);
      if (typeof window.elTrack === 'function') return window.elTrack(name, p);
      if (typeof window.mrTrack === 'function') return window.mrTrack(name, p);
      if (typeof window.gtag === 'function') return window.gtag('event', name, p);
    } catch (_) {}
  }
  function meta(b) {
    var price = Number(b.getAttribute('data-s3-price')) || 0, id = b.getAttribute('data-s3-product') || '';
    return { site: b.getAttribute('data-s3-site') || location.hostname, product: id, price: price, currency: 'USD', value: price,
      placement: 'postresult', items: [{ item_id: id, item_name: b.getAttribute('data-s3-name') || id, price: price, quantity: 1 }] };
  }
  var interacted = false, pending = [];
  function onReal() {
    if (interacted) return; interacted = true;
    pending.splice(0).forEach(function (f) { f(); });
  }
  ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach(function (t) { window.addEventListener(t, onReal, { passive: true, once: true }); });
  blocks.forEach(function (b) {
    var tool = b.getAttribute('data-s3-tool'), box = tool && document.querySelector(tool);
    function show() { if (b.hidden) { b.hidden = false; b.classList.add('s3-in'); } watch(); }
    if (b.hasAttribute('data-s3-manual')) {
      b.hidden = true;
      b.addEventListener('s3:show', show);  // the page shows it after its own result (e.g. a finished test)
    } else if (box) {
      b.hidden = true;
      var go = function (e) {
        if (e && e.target && e.target.closest && e.target.closest('[data-s3-post]')) return;
        box.removeEventListener('input', go); box.removeEventListener('change', go); box.removeEventListener('click', go);
        setTimeout(show, 350);
      };
      box.addEventListener('input', go); box.addEventListener('change', go); box.addEventListener('click', go);
    } else show();
    var seen = false, watching = false;
    function watch() {
      if (watching || !('IntersectionObserver' in window)) return; watching = true;
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting || seen) return;
          var fire = function () { if (seen) return; seen = true; io.disconnect(); track('offer_view', meta(b)); };
          if (interacted) fire(); else pending.push(fire);
        });
      }, { threshold: 0.5 });
      io.observe(b);
    }
    if (b.getAttribute('data-s3-bc') === 'self') {
      Array.prototype.forEach.call(b.querySelectorAll('a.s3-buy'), function (a) {
        a.addEventListener('click', function () { track('begin_checkout', meta(b)); });
      });
    }
    Array.prototype.forEach.call(b.querySelectorAll('button[data-s3-checkout]'), function (btn) {
      var busy = false, fallback = btn.getAttribute('data-s3-fallback') || '/';
      btn.addEventListener('click', function () {
        if (busy) return; busy = true;
        track('begin_checkout', meta(b));
        var label = btn.textContent; btn.textContent = 'Opening Stripe checkout…'; btn.disabled = true;
        var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
        var ctl = window.AbortController ? new AbortController() : null, t = setTimeout(function () { if (ctl) ctl.abort(); }, 12000);
        fetch(btn.getAttribute('data-s3-checkout'), { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: ctl ? ctl.signal : undefined,
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ attempt_id: id }) })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (j) {
            clearTimeout(t);
            var u = j && typeof j.url === 'string' ? new URL(j.url) : null;
            if (u && u.protocol === 'https:' && u.hostname === 'checkout.stripe.com') { location.assign(u.href); return; }
            location.assign(fallback);
          })
          .catch(function () { clearTimeout(t); busy = false; btn.disabled = false; btn.textContent = label; location.assign(fallback); });
      });
    });
  });
  if (window.__s3NotReady) return;
  window.__s3NotReady = 1;
  document.addEventListener('submit', function (ev) {
    var f = ev.target;
    if (!f || !f.matches || !f.matches('form.s3-notready')) return;
    ev.preventDefault();
    if (f.elements.hp && f.elements.hp.value) return;
    var em = f.elements.email, msg = f.querySelector('.s3-nr-msg'), email = (em && em.value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { if (msg) msg.textContent = 'Please type a valid email address.'; return; }
    if (f.dataset.busy) return;
    f.dataset.busy = '1';
    var offer = f.getAttribute('data-offer') || '', price = f.getAttribute('data-price') || '';
    fetch('https://fleet-leads.lipmichal.workers.dev/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, offer_id: offer, offer_name: f.getAttribute('data-offer-name') || '', page: location.href, price: price, hp: '' }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return r.ok && j && j.ok; }); })
      .then(function (ok) {
        delete f.dataset.busy;
        if (!ok) { if (msg) msg.textContent = 'Sorry, that did not work. Please try again.'; return; }
        if (msg) msg.textContent = 'Check your inbox to confirm.';
        track('generate_lead', { site: offer.replace(/-notready$/, ''), offer_id: offer, price: Number(price), currency: 'USD' });
      })
      .catch(function () { delete f.dataset.busy; if (msg) msg.textContent = 'Sorry, that did not work. Please try again.'; });
  });
})();
