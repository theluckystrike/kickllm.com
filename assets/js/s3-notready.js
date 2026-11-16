/* Sprint 3 (2026-11-16) lane D1B: "Not ready? Email me this link" (data-cro="sprint-20261116-notready").
   Same Worker call and markup as lanes D1/D2 (fleet-leads /lead, double opt-in). One delegated handler per page. */
(function () {
  'use strict';
  if (window.__s3NotReady) return;
  window.__s3NotReady = 1;
  function track(name, p) { try { if (typeof window.mrTrack === 'function') window.mrTrack(name, p); else if (typeof window.gtag === 'function') window.gtag('event', name, p); } catch (_) {} }
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
        track('generate_lead', { site: 'kickllm', offer_id: offer, price: Number(price), currency: 'USD' });
      })
      .catch(function () { delete f.dataset.busy; if (msg) msg.textContent = 'Sorry, that did not work. Please try again.'; });
  });
})();
