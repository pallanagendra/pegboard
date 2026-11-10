// Runs before first paint so the page never flashes the wrong theme.
(function () {
  var stored = null;
  try { stored = localStorage.getItem('theme'); } catch (e) { /* storage blocked */ }
  var root = document.documentElement;
  if (stored === 'light' || stored === 'dark') root.setAttribute('data-theme', stored);
  var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  root.setAttribute('data-theme-resolved', dark ? 'dark' : 'light');
})();
