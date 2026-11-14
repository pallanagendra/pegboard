// Page chrome shared by every page: theme toggle, copy buttons and the all-tools menu.
import { copyText } from './ui.js';
import { pushRecent, parseRecent, matches } from './nav-core.js';

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

// ---------------------------------------------------------------- menu: every tool, one tap away
const menu = document.querySelector('[data-menu]');
if (menu && typeof menu.showModal === 'function') {
  const input = menu.querySelector('[data-menu-input]');
  const groups = [...menu.querySelectorAll('[data-menu-group]')];
  const recent = menu.querySelector('[data-menu-recent]');
  const empty = menu.querySelector('[data-menu-empty]');
  const opener = document.querySelector('[data-menu-open]');
  const current = document.querySelector('[data-tool]')?.dataset.tool || '';
  const KEY = 'recent-tools';

  const readRecent = () => {
    try { return parseRecent(localStorage.getItem(KEY)); } catch { return []; }
  };
  // remember this tool for next time (kept in this browser only)
  if (current) {
    try { localStorage.setItem(KEY, JSON.stringify(pushRecent(readRecent(), current))); } catch { /* storage blocked */ }
    menu.querySelector(`[data-slug="${CSS.escape(current)}"]`)?.setAttribute('aria-current', 'page');
  }

  function fillRecent() {
    const list = recent.querySelector('ul');
    list.replaceChildren();
    for (const slug of readRecent()) {
      if (slug === current) continue;
      const item = menu.querySelector(`[data-menu-group] [data-slug="${CSS.escape(slug)}"]`)?.closest('li');
      if (item) list.append(item.cloneNode(true));
    }
    return list.children.length > 0;
  }

  let hasRecent = false;
  function filter() {
    const query = input.value;
    let shown = 0;
    for (const group of groups) {
      let inGroup = 0;
      for (const li of group.querySelectorAll('li')) {
        li.hidden = !matches(li.dataset.search, query);
        if (!li.hidden) inGroup++;
      }
      group.hidden = inGroup === 0;
      shown += inGroup;
    }
    recent.hidden = !hasRecent || query.trim() !== '';
    empty.hidden = shown > 0;
  }

  const visibleLinks = () => [...menu.querySelectorAll('.menu__link')].filter((a) => !a.closest('[hidden]'));

  function openMenu({ search = false } = {}) {
    if (menu.open) return;
    input.value = '';
    hasRecent = fillRecent();
    filter();
    menu.showModal();
    menu.querySelector('[data-menu-body]').scrollTop = 0;
    // typing straight away suits a keyboard; on a phone, opening the keyboard would cover the list
    if (search) input.focus();
    else menu.querySelector('[data-menu-close]').focus();
    opener?.setAttribute('aria-expanded', 'true');
  }

  opener?.setAttribute('aria-expanded', 'false');
  opener?.addEventListener('click', () => openMenu());
  menu.querySelector('[data-menu-close]').addEventListener('click', () => menu.close());
  menu.addEventListener('close', () => opener?.setAttribute('aria-expanded', 'false'));
  // a click on the dimmed page behind the menu closes it
  menu.addEventListener('click', (e) => {
    if (e.target !== menu) return;
    const r = menu.getBoundingClientRect();
    if (e.clientX > r.right || e.clientX < r.left || e.clientY < r.top || e.clientY > r.bottom) menu.close();
  });

  input.addEventListener('input', filter);
  menu.querySelector('[data-menu-search]').addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value.trim()) visibleLinks().find((a) => a.closest('[data-menu-group]'))?.click();
  });
  // arrow keys walk through the list
  menu.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const links = visibleLinks();
    if (!links.length) return;
    const i = links.indexOf(document.activeElement);
    e.preventDefault();
    if (e.key === 'ArrowDown') links[Math.min(i + 1, links.length - 1)].focus();
    else if (i <= 0) input.focus();
    else links[i - 1].focus();
  });

  // Ctrl+K (⌘K on a Mac) anywhere, or "/" on pages without their own search box
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
    const palette = (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k';
    const slash = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !typing && !document.querySelector('[data-search-input]');
    if (!palette && !slash) return;
    e.preventDefault();
    openMenu({ search: true });
  });
}
