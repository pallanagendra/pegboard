// Menu helpers that don't touch the browser, so they can be unit tested in Node.

export const MAX_RECENT = 5;

/** Put `slug` at the front of the recently used list: no duplicates, at most `max` entries. */
export function pushRecent(list, slug, max = MAX_RECENT) {
  const clean = (Array.isArray(list) ? list : []).filter((s) => typeof s === 'string' && s && s !== slug);
  return slug ? [slug, ...clean].slice(0, max) : clean.slice(0, max);
}

/** Read a stored list safely: anything that isn't a JSON array of names becomes an empty list. */
export function parseRecent(text) {
  try {
    const list = JSON.parse(text || '[]');
    return Array.isArray(list) ? list.filter((s) => typeof s === 'string' && /^[a-z0-9-]+$/.test(s)).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

/** Does every word of the query appear in the tool's search text? An empty query matches everything. */
export function matches(searchText, query) {
  const terms = String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  const hay = String(searchText || '').toLowerCase();
  return terms.every((t) => hay.includes(t));
}
