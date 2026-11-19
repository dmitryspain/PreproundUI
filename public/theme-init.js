/*
 * Applies the saved theme and accent before Angular starts, so the page never flashes in the wrong theme.
 * Only READS `prepround.prefs.v1`: PrefsService (through STORAGE) is the only writer and validates the same
 * way (src/app/core/prefs.service.ts). A file rather than an inline script, so a future CSP can stay at
 * `script-src 'self'` without hashes.
 */
(function () {
  var prefs = null;
  try {
    prefs = JSON.parse(localStorage.getItem('prepround.prefs.v1') || 'null');
  } catch (e) {
    /* storage blocked or broken JSON: the defaults apply */
  }
  if (typeof prefs !== 'object' || prefs === null) {
    prefs = {};
  }

  var root = document.documentElement;
  var theme = prefs.theme;
  if (theme !== 'aurora' && theme !== 'daylight' && theme !== 'terminal') {
    // "auto", or anything unknown: dark system -> Aurora, light -> Daylight (AUTO_DARK / AUTO_LIGHT in themes.ts)
    var dark =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = dark ? 'aurora' : 'daylight';
  }
  root.setAttribute('data-theme', theme);

  var accent = prefs.accent;
  if (typeof accent === 'number' && isFinite(accent) && accent >= 0 && accent <= 360) {
    root.style.setProperty('--accent-h-user', String(accent));
  }
})();
