// Page chrome shared by every page: theme toggle and the "/" shortcut.
import { copyText } from './ui.js';

const root = document.documentElement;
const media = window.matchMedia('(prefers-color-scheme: dark)');

function storedTheme() {
  try { return localStorage.getItem('theme'); } catch { return null; }
}

function applyTheme(theme) {
  if (theme) root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
  const dark = theme ? theme === 'dark' : media.matches;
  root.setAttribute('data-theme-resolved', dark ? 'dark' : 'light');
  const btn = document.querySelector('[data-theme-toggle]');
  if (btn) btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
}

applyTheme(storedTheme());
media.addEventListener('change', () => { if (!storedTheme()) applyTheme(null); });

document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
  const next = root.getAttribute('data-theme-resolved') === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('theme', next); } catch { /* ignore */ }
  applyTheme(next);
});

// Any element with data-copy-from="#id" copies that element's value or text.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-copy-from]');
  if (!btn) return;
  const src = document.querySelector(btn.dataset.copyFrom);
  if (!src) return;
  const text = 'value' in src && src.tagName !== 'OUTPUT' ? src.value : src.textContent;
  if (text) copyText(text, btn.dataset.copyLabel || 'Copied to clipboard');
});
