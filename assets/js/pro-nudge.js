/* pro-nudge.js — Contextual pro upgrade nudge for Zovo satellite tools
 * Shows a subtle inline nudge after 3+ tool uses in a session.
 * Uses sessionStorage only. No cookies, no localStorage, no tracking.
 * Self-contained: injects its own CSS, finds result containers automatically.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'zovo_tool_uses';
  var DISMISS_KEY = 'zovo_nudge_dismissed';
  var THRESHOLD = 3;

  // Bail immediately if already dismissed this session
  if (sessionStorage.getItem(DISMISS_KEY)) return;

  // ---- Inject CSS ----
  var style = document.createElement('style');
  style.textContent = [
    '@keyframes proNudgeFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}',
    '.pro-nudge{display:flex;align-items:center;justify-content:space-between;background:#161b22;border:1px solid #30363d;border-left:3px solid #58a6ff;border-radius:6px;padding:0.75rem 1rem;margin-top:1rem;font-size:0.85rem;color:#8b949e;animation:proNudgeFadeIn 0.3s ease;gap:0.75rem}',
    '.pro-nudge a{color:#58a6ff;text-decoration:none;white-space:nowrap}',
    '.pro-nudge a:hover{text-decoration:underline}',
    '.pro-nudge-close{background:none;border:none;color:#484f58;cursor:pointer;font-size:1.1rem;padding:0.15rem 0.35rem;line-height:1;border-radius:3px;flex-shrink:0}',
    '.pro-nudge-close:hover{color:#8b949e;background:rgba(255,255,255,0.05)}'
  ].join('\n');
  document.head.appendChild(style);

  // ---- Usage counter ----
  function getCount() {
    return parseInt(sessionStorage.getItem(STORAGE_KEY), 10) || 0;
  }

  function increment() {
    var n = getCount() + 1;
    sessionStorage.setItem(STORAGE_KEY, n);
    return n;
  }

  // ---- Nudge element ----
  var nudgeEl = null;
  var nudgeInserted = false;

  function buildNudge(count) {
    var host = location.hostname;
    var url = 'https://zovo.one/pricing?utm_source=' + encodeURIComponent(host) + '&utm_medium=nudge&utm_campaign=usage';

    var div = document.createElement('div');
    div.className = 'pro-nudge';
    div.innerHTML =
      '<span>You\u2019ve used this tool ' + count + ' time' + (count === 1 ? '' : 's') + '. <a href="' + url + '" target="_blank" rel="noopener">Unlock pro features \u2192</a></span>' +
      '<button class="pro-nudge-close" aria-label="Dismiss" title="Dismiss">\u00d7</button>';

    div.querySelector('.pro-nudge-close').addEventListener('click', function () {
      sessionStorage.setItem(DISMISS_KEY, '1');
      div.remove();
      nudgeEl = null;
      nudgeInserted = false;
    });

    return div;
  }

  function showNudge(count) {
    if (sessionStorage.getItem(DISMISS_KEY)) return;
    if (count < THRESHOLD) return;

    // Update text if nudge already exists
    if (nudgeEl && nudgeInserted) {
      var span = nudgeEl.querySelector('span');
      if (span) {
        var host = location.hostname;
        var url = 'https://zovo.one/pricing?utm_source=' + encodeURIComponent(host) + '&utm_medium=nudge&utm_campaign=usage';
        span.innerHTML = 'You\u2019ve used this tool ' + count + ' time' + (count === 1 ? '' : 's') + '. <a href="' + url + '" target="_blank" rel="noopener">Unlock pro features \u2192</a>';
      }
      return;
    }

    // Find the best container to append after
    var target = document.getElementById('tool-container')
      || document.querySelector('.tool-container')
      || document.getElementById('tool-mount')
      || document.querySelector('[data-component]')
      || document.querySelector('.tool-section')
      || document.querySelector('.result-grid')
      || document.querySelector('.result')
      || document.querySelector('#result')
      || document.querySelector('[data-result]')
      || document.querySelector('.output');

    if (!target) return;

    nudgeEl = buildNudge(count);
    target.parentNode.insertBefore(nudgeEl, target.nextSibling);
    nudgeInserted = true;
  }

  // ---- Global function for manual triggering ----
  window.trackProUse = function () {
    var n = increment();
    showNudge(n);
  };

  // ---- MutationObserver auto-detection ----
  // Watch for content changes in tool result areas (approach 2 — zero changes to existing code)
  var selectors = [
    '#tool-container',
    '.tool-container',
    '#tool-mount',
    '[data-component]',
    '.tool-section',
    '#result',
    '.result',
    '.result-grid',
    '.output',
    '[data-result]'
  ];

  var observedTargets = [];
  var debounceTimer = null;
  var lastMutationTime = 0;

  function onMutation() {
    // Debounce: many mutations fire in rapid succession when a result renders.
    // We count one "use" per burst (min 500ms between counted uses).
    var now = Date.now();
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      if (now - lastMutationTime < 500) return;
      lastMutationTime = now;
      var n = increment();
      showNudge(n);
    }, 300);
  }

  function setupObservers() {
    var seen = new Set();
    for (var i = 0; i < selectors.length; i++) {
      var els = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < els.length; j++) {
        if (seen.has(els[j])) continue;
        seen.add(els[j]);
        observedTargets.push(els[j]);

        var observer = new MutationObserver(onMutation);
        observer.observe(els[j], {
          childList: true,
          subtree: true,
          characterData: true
        });
      }
    }
  }

  // Wait for DOM ready, then set up observers.
  // Use a short delay to let tool components mount first.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(setupObservers, 500);
    });
  } else {
    setTimeout(setupObservers, 500);
  }
})();
