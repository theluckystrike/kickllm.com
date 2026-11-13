/* sprint-20261113 L4: offer_view, cta_click and generate_lead for the ml0x Claude Code Workflow Pack (cross-sell box)
   and the PyTorch error explainer. Sends through window.mrTrack (site-analytics.js), which only
   reports on the production host and respects the consent banner.
   Markup:
     [data-l4-offer][data-product][data-price]   offer block, offer_view once per product
     a[data-l4-cta]                                cta_click (begin_checkout only if href is a real checkout)
     form[data-l4-lead][data-offer-id]             waitlist form, POST to fleet-leads, generate_lead on success */
(function () {
  'use strict';
  var SITE = 'kickllm.com';
  var LEADS = 'https://fleet-leads.lipmichal.workers.dev/lead';
  function track(name, p) { try { if (typeof window.mrTrack === 'function') window.mrTrack(name, p); } catch (e) {} }
  function params(el) {
    var box = el.closest('[data-product]') || el;
    return {
      site: SITE,
      product: el.getAttribute('data-product') || box.getAttribute('data-product') || '',
      price: Number(el.getAttribute('data-price') || box.getAttribute('data-price') || 0),
      value: Number(el.getAttribute('data-price') || box.getAttribute('data-price') || 0),
      currency: 'USD'
    };
  }

  // offer_view: only after a scroll, pointer, key or touch event, or after 10 s on the page.
  var armed = false, queue = [], seen = {};
  function arm() {
    if (armed) return;
    armed = true;
    queue.forEach(function (f) { f(); });
    queue = [];
  }
  ['scroll', 'pointerdown', 'keydown', 'touchstart', 'mousemove'].forEach(function (t) {
    window.addEventListener(t, arm, { capture: true, passive: true, once: true });
  });
  setTimeout(arm, 10000);
  function watch(el) {
    var fire = function () {
      var p = params(el);
      var key = p.product + '|' + (el.getAttribute('data-placement') || '');
      if (seen[key]) return;
      seen[key] = true;
      p.placement = el.getAttribute('data-placement') || '';
      track('offer_view', p);
    };
    if (!('IntersectionObserver' in window)) { if (armed) fire(); else queue.push(fire); return; }
    var io = new IntersectionObserver(function (es) {
      if (!es.some(function (e) { return e.isIntersecting; })) return;
      io.disconnect();
      if (armed) fire(); else queue.push(fire);
    }, { threshold: 0.25 });
    io.observe(el);
  }
  document.querySelectorAll('[data-l4-offer]').forEach(watch);
  window.__l4watch = watch; // for offer blocks added later (explainer results)

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-l4-cta]') : null;
    if (!a) return;
    var p = params(a);
    p.cta_id = a.getAttribute('data-l4-cta');
    p.link_url = (a.href || '').split('?')[0];
    track('cta_click', p);
    if (/^https:\/\/(buy|checkout)\.stripe\.com\//.test(a.href || '')) track('begin_checkout', p);
  }, true);

  document.querySelectorAll('form[data-l4-lead]').forEach(function (f) {
    var msg = f.querySelector('[data-l4-msg]');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (f.querySelector('input[type=email]') || {}).value || '';
      var hp = (f.querySelector('input[name=hp]') || {}).value || '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { if (msg) msg.textContent = 'Please enter a valid email address.'; return; }
      var p = params(f);
      var btn = f.querySelector('button');
      if (btn) btn.disabled = true;
      if (msg) msg.textContent = 'Sending...';
      fetch(LEADS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, offer_id: f.getAttribute('data-offer-id'), page: location.pathname, price: p.price, hp: hp })
      }).then(function (r) { return r.json().catch(function () { return {}; }); }).then(function (d) {
        if (d && d.ok) {
          p.offer_id = f.getAttribute('data-offer-id');
          track('generate_lead', p);
          f.querySelectorAll('input,button').forEach(function (x) { x.disabled = true; });
          if (msg) msg.textContent = f.getAttribute('data-success') || 'You are on the list.';
        } else {
          if (btn) btn.disabled = false;
          if (msg) msg.textContent = 'That did not go through. Please try again, or email lipmichal@gmail.com.';
        }
      }).catch(function () {
        if (btn) btn.disabled = false;
        if (msg) msg.textContent = 'Network error. Please try again, or email lipmichal@gmail.com.';
      });
    });
  });
})();
