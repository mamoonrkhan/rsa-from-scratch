// The light/dark toggle. The starting theme is set by a small script in the page's <head>.
(function () {
  'use strict';
  const root = document.documentElement;
  const button = document.getElementById('theme-toggle');
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const saved = () => { try { return localStorage.getItem('theme'); } catch (e) { return null; } };

  function label() {
    const dark = root.getAttribute('data-theme') === 'dark';
    button.textContent = dark ? '☀ Light' : '☾ Dark';
    button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  }

  button.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) { /* private browsing: just don't remember */ }
    label();
  });

  // Until the reader picks a theme, follow the system setting if it changes.
  system.addEventListener('change', (e) => {
    if (!saved()) {
      root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      label();
    }
  });

  label();
})();
