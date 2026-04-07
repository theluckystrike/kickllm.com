/**
 * Share Module — Shareable tool outputs via URL encoding
 * Zero dependencies. Works on GitHub Pages static hosting.
 */
(function() {
  'use strict';

  var MAX_URL_LENGTH = 2000;
  var DEBOUNCE_MS = 150;
  var debounceTimer = null;

  var Share = {
    collectState: function(container) {
      if (!container) return {};
      var state = {};
      var inputs = container.querySelectorAll('input[type="text"], input[type="number"], textarea, select');
      var count = 0;
      for (var i = 0; i < inputs.length && count < 50; i++) {
        var el = inputs[i];
        var key = el.id || el.name || ('f' + i);
        if (el.value !== '' && el.value !== undefined) {
          state[key] = el.value;
          count++;
        }
      }
      return state;
    },

    generate: function(state) {
      if (!state || Object.keys(state).length === 0) return window.location.href;
      var json = JSON.stringify(state);
      if (json.length < 200) {
        var params = new URLSearchParams();
        var keys = Object.keys(state);
        for (var i = 0; i < keys.length; i++) {
          params.set(keys[i], String(state[keys[i]]));
        }
        var url = window.location.origin + window.location.pathname + '?' + params.toString();
        if (url.length <= MAX_URL_LENGTH) return url;
      }
      try {
        var b64 = btoa(unescape(encodeURIComponent(json)));
        var url = window.location.origin + window.location.pathname + '#s=' + b64;
        if (url.length <= MAX_URL_LENGTH) return url;
      } catch (e) { /* fall through */ }
      return window.location.href;
    },

    load: function() {
      var params = new URLSearchParams(window.location.search);
      if (params.toString()) {
        var state = {};
        params.forEach(function(val, key) { state[key] = val; });
        return state;
      }
      var hash = window.location.hash;
      if (hash && hash.indexOf('#s=') === 0) {
        try {
          var json = decodeURIComponent(escape(atob(hash.slice(3))));
          return JSON.parse(json);
        } catch (e) { return null; }
      }
      return null;
    },

    restore: function(container, state) {
      if (!container || !state) return;
      var keys = Object.keys(state);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var el = document.getElementById(key);
        if (!el) el = container.querySelector('[name="' + key + '"]');
        if (el) {
          el.value = state[key];
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    },

    show: function(url) {
      var bar = document.getElementById('share-bar');
      var input = document.getElementById('share-url');
      if (!bar || !input) return;
      input.value = url;
      bar.style.display = 'block';
      history.replaceState(null, '', url);
    },

    copy: function() {
      var input = document.getElementById('share-url');
      if (!input) return;
      navigator.clipboard.writeText(input.value).then(function() {
        var btn = document.getElementById('copy-share');
        if (btn) {
          btn.textContent = 'Copied!';
          setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
        }
      });
    },

    showBanner: function() {
      var main = document.querySelector('main') || document.querySelector('.tool-page') || document.querySelector('.content') || document.body;
      if (!main) return;
      var banner = document.createElement('div');
      banner.style.cssText = 'background:rgba(88,166,255,0.1);border:1px solid rgba(88,166,255,0.3);border-radius:8px;padding:0.75rem 1.25rem;margin:1rem auto;max-width:900px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;';
      banner.innerHTML = '<span style="font-size:0.9rem;color:#58a6ff;">You\'re viewing a shared result</span><a href="' + window.location.pathname + '" style="color:#8b949e;font-size:0.85rem;text-decoration:none;">Start fresh &rarr;</a>';
      var firstSection = main.querySelector('section') || main.firstElementChild;
      if (firstSection) main.insertBefore(banner, firstSection);
      else main.prepend(banner);
    },

    twitter: function(text) {
      var url = document.getElementById('share-url');
      window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text || document.title) + '&url=' + encodeURIComponent(url ? url.value : window.location.href), '_blank', 'width=550,height=420');
    },
    linkedin: function() {
      var url = document.getElementById('share-url');
      window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url ? url.value : window.location.href), '_blank', 'width=550,height=420');
    },
    reddit: function(title) {
      var url = document.getElementById('share-url');
      window.open('https://reddit.com/submit?url=' + encodeURIComponent(url ? url.value : window.location.href) + '&title=' + encodeURIComponent(title || document.title), '_blank', 'width=550,height=420');
    }
  };

  window.Share = Share;

  function initShare() {
    // Find the main interactive container
    var container = document.getElementById('tool-container') || document.querySelector('.tool-container') || document.querySelector('.tool-section') || document.querySelector('main');
    if (!container) return;

    // Only proceed if there are interactive inputs on the page
    var inputs = container.querySelectorAll('input[type="text"], input[type="number"], textarea, select');
    if (inputs.length === 0) return;

    // Inject share bar
    var shareBar = document.createElement('div');
    shareBar.id = 'share-bar';
    shareBar.style.cssText = 'display:none;background:#161b22;border:1px solid #58a6ff;border-radius:8px;padding:1rem 1.25rem;margin-top:1.5rem;max-width:900px;margin-left:auto;margin-right:auto;animation:shareSlideUp 0.3s ease;';
    shareBar.innerHTML = '<div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">' +
      '<span style="font-size:0.85rem;font-weight:600;color:#c9d1d9;white-space:nowrap;">Share this result</span>' +
      '<div style="flex:1;display:flex;min-width:200px;">' +
        '<input type="text" id="share-url" readonly style="flex:1;background:#0d1117;border:1px solid #30363d;border-right:none;border-radius:6px 0 0 6px;padding:0.5rem 0.75rem;font-family:monospace;font-size:0.75rem;color:#8b949e;">' +
        '<button id="copy-share" onclick="Share.copy()" style="background:#58a6ff;color:#000;border:none;border-radius:0 6px 6px 0;padding:0.5rem 1rem;font-weight:600;font-size:0.8rem;cursor:pointer;">Copy</button>' +
      '</div>' +
      '<div style="display:flex;gap:0.5rem;">' +
        '<button onclick="Share.twitter()" title="Share on X" style="width:36px;height:36px;border-radius:50%;border:1px solid #30363d;background:transparent;color:#8b949e;cursor:pointer;font-size:0.85rem;">&#x1D54F;</button>' +
        '<button onclick="Share.linkedin()" title="Share on LinkedIn" style="width:36px;height:36px;border-radius:50%;border:1px solid #30363d;background:transparent;color:#8b949e;cursor:pointer;font-size:0.85rem;">in</button>' +
        '<button onclick="Share.reddit()" title="Share on Reddit" style="width:36px;height:36px;border-radius:50%;border:1px solid #30363d;background:transparent;color:#8b949e;cursor:pointer;font-size:0.85rem;">&uarr;</button>' +
      '</div>' +
    '</div>';

    // Insert after the tool area
    var toolArea = container.querySelector('.tool-container') || container.querySelector('.calculator') || container;
    toolArea.parentNode.insertBefore(shareBar, toolArea.nextSibling);

    var style = document.createElement('style');
    style.textContent = '@keyframes shareSlideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}';
    document.head.appendChild(style);

    // Hook into buttons and Enter key
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('button, .btn');
      if (!btn) return;
      var text = (btn.textContent || '').toLowerCase().trim();
      if (text === 'clear' || text === 'copy' || text === 'copied!' || text === 'reset') return;
      if (btn.id === 'copy-share') return;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        var state = Share.collectState(container);
        if (Object.keys(state).length > 0) {
          Share.show(Share.generate(state));
        }
      }, DEBOUNCE_MS);
    });

    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Enter') return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        var state = Share.collectState(container);
        if (Object.keys(state).length > 0) {
          Share.show(Share.generate(state));
        }
      }, DEBOUNCE_MS);
    });

    // Restore shared state
    var sharedState = Share.load();
    if (sharedState) {
      Share.restore(container, sharedState);
      // Try to trigger calculation
      var primaryBtn = container.querySelector('button.btn:not(.btn-outline), button[type="submit"], .btn-primary');
      if (primaryBtn) setTimeout(function() { primaryBtn.click(); }, 100);
      Share.showBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(initShare, 300); });
  } else {
    setTimeout(initShare, 300);
  }
})();
