// Home page: filter the board by search text and category.
const input = document.querySelector('[data-search-input]');
const grid = document.querySelector('[data-tool-grid]');
const items = [...grid.querySelectorAll('.tag-item')];
const chips = [...document.querySelectorAll('[data-filter]')];
const empty = document.querySelector('[data-empty]');
const count = document.querySelector('[data-count]');
let category = 'all';

function apply() {
  const terms = input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const item of items) {
    const okCat = category === 'all' || item.dataset.category === category;
    const okText = terms.every((t) => item.dataset.search.includes(t));
    item.hidden = !(okCat && okText);
    if (!item.hidden) shown++;
  }
  empty.hidden = shown > 0;
  count.textContent = String(shown);
}

input.addEventListener('input', apply);
document.querySelector('[data-finder]').addEventListener('submit', (e) => {
  e.preventDefault();
  const first = items.find((i) => !i.hidden);
  if (first) first.querySelector('a').click();
});

chips.forEach((chip) =>
  chip.addEventListener('click', () => {
    category = chip.dataset.filter;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    apply();
  }),
);

// tool pages link back here with a category chosen: /?category=files#tools
const wanted = new URLSearchParams(location.search).get('category');
const wantedChip = chips.find((c) => c.dataset.filter === wanted);
if (wantedChip) {
  category = wanted;
  chips.forEach((c) => c.setAttribute('aria-pressed', String(c === wantedChip)));
}

document.querySelector('[data-clear-search]').addEventListener('click', () => {
  input.value = '';
  category = 'all';
  chips.forEach((c, i) => c.setAttribute('aria-pressed', String(i === 0)));
  apply();
  input.focus();
});

// "/" jumps to the search box
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;
  e.preventDefault();
  input.focus();
});

// browsers restore typed text on back-navigation
apply();
