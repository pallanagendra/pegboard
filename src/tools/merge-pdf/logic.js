// Merge PDF: page ranges, names and page sizes. Pure functions, tested in Node.

/**
 * Read a page selection like "1-3, 5, 8-" for a document with `total` pages.
 * Blank or "all" means every page. Returns { pages } (0-based, in the order given) or { error }.
 */
export function parsePages(text, total) {
  const s = String(text ?? '').trim().toLowerCase();
  if (!s || s === 'all') return { pages: Array.from({ length: total }, (_, i) => i) };
  const pages = [];
  for (const raw of s.split(/[,;\s]+/).filter(Boolean)) {
    const token = raw.replace(/[–—]/g, '-');
    let m;
    if ((m = token.match(/^(\d+)$/))) {
      const n = Number(m[1]);
      if (n < 1 || n > total) return { error: outOfRange(n, total) };
      pages.push(n - 1);
    } else if ((m = token.match(/^(\d*)-(\d*)$/)) && (m[1] || m[2])) {
      const a = m[1] ? Number(m[1]) : 1;
      const b = m[2] ? Number(m[2]) : total;
      for (const n of [a, b]) if (n < 1 || n > total) return { error: outOfRange(n, total) };
      const step = a <= b ? 1 : -1; // "5-3" gives 5, 4, 3
      for (let n = a; step > 0 ? n <= b : n >= b; n += step) pages.push(n - 1);
    } else if (token === 'odd' || token === 'even') {
      for (let n = token === 'odd' ? 1 : 2; n <= total; n += 2) pages.push(n - 1);
    } else {
      return { error: `“${raw}” isn’t a page or a range. Use numbers like 1-3, 5.` };
    }
  }
  if (!pages.length) return { error: 'Choose at least one page.' };
  return { pages };
}

function outOfRange(n, total) {
  return n < 1 ? 'Pages start at 1.' : `There’s no page ${n}: this file has ${total} page${total === 1 ? '' : 's'}.`;
}

/** "All 12 pages", "Pages 1–3 and 5 (4 of 12)". */
export function describeSelection(text, total) {
  const r = parsePages(text, total);
  if (r.error) return r.error;
  if (!String(text ?? '').trim() || String(text).trim().toLowerCase() === 'all') return total === 1 ? '1 page' : `All ${total} pages`;
  return `${r.pages.length} of ${total} page${total === 1 ? '' : 's'}`;
}

/** A safe file name ending in .pdf. */
export function pdfName(text, fallback = 'merged') {
  const base = String(text ?? '').trim().replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/\s+/g, ' ').slice(0, 120).trim();
  return `${base || fallback}.pdf`;
}

// PDF points: 72 per inch
export const PAGE_SIZES = {
  letter: [612, 792],
  a4: [595.28, 841.89],
};

/**
 * Where an image goes on its page. `size` is 'image' (the page fits the picture, at 96 pixels per inch),
 * 'letter' or 'a4' (turned to match the picture, with a half-inch margin).
 */
export function placeImage(width, height, size = 'letter') {
  if (size === 'image' || !PAGE_SIZES[size]) {
    // 0.75 pt per pixel = 96 ppi; PDF pages max out at 200 inches (14,400 pt)
    const scale = Math.min(0.75, 14400 / Math.max(width, height));
    const w = width * scale;
    const h = height * scale;
    return { pageWidth: w, pageHeight: h, x: 0, y: 0, width: w, height: h };
  }
  let [pw, ph] = PAGE_SIZES[size];
  if (width > height) [pw, ph] = [ph, pw];
  const margin = 36;
  const scale = Math.min((pw - margin * 2) / width, (ph - margin * 2) / height);
  const w = width * scale;
  const h = height * scale;
  return { pageWidth: pw, pageHeight: ph, x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h };
}

/** Move the item at `from` by `delta` places, returning a new array. */
export function move(list, from, delta) {
  const to = from + delta;
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return list.slice();
  const out = list.slice();
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}

/** Natural A–Z by name, so "scan 2" comes before "scan 10". */
export function sortByName(list) {
  return list.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}
