// JSON checking and formatting. JSON.parse does the real parsing; a small scanner of our own
// finds where an error is (line and column) and says what's wrong in plain words, the same in every browser.

class ScanError extends Error {
  constructor(message, at) {
    super(message);
    this.at = at;
  }
}

/** Walk the text the way a JSON parser would. Throws ScanError at the first problem; returns notes on success. */
export function scan(text) {
  let i = 0;
  const longNumbers = [];
  const fail = (msg, at = i) => { throw new ScanError(msg, at); };
  const ws = () => { while (i < text.length && ' \t\n\r'.includes(text[i])) i++; };
  const describe = (c) => (c === undefined ? 'the end' : `“${c}”`);

  function value() {
    ws();
    const c = text[i];
    if (c === '{') return object();
    if (c === '[') return array();
    if (c === '"') return string();
    if (c === '-' || (c >= '0' && c <= '9')) return number();
    for (const word of ['true', 'false', 'null']) {
      if (text.startsWith(word, i)) { i += word.length; return; }
    }
    if (c === undefined) fail('The JSON ends too soon: a value is missing.');
    if (c === "'") fail('Text needs double quotes ("), not single quotes.');
    if (c === '/') fail('Comments aren’t allowed in JSON.');
    if (c === '}' || c === ']') fail(`Unexpected “${c}”: a value is missing here. Is there an extra comma before it?`);
    if (/[A-Za-z_$]/.test(c)) {
      const word = text.slice(i).match(/^[A-Za-z_$][\w$]*/)[0];
      if (['undefined', 'NaN', 'Infinity'].includes(word)) fail(`${word} isn’t allowed in JSON. Use null or a number instead.`);
      if (['True', 'False', 'None', 'TRUE', 'FALSE', 'NULL', 'Null'].includes(word)) fail(`“${word}” must be written in lower case: true, false or null.`);
      fail(`Unexpected word “${word}”. Text values need double quotes.`);
    }
    fail(`Unexpected character “${c}”.`);
  }

  function object() {
    const open = i;
    i++;
    ws();
    if (text[i] === '}') { i++; return; }
    let comma = -1;
    for (;;) {
      ws();
      const c = text[i];
      if (c === '}' && comma >= 0) fail('Trailing comma: remove the comma before “}”.', comma);
      if (c === "'") fail('Property names need double quotes ("), not single quotes.');
      if (c === undefined) fail('The JSON ends too soon: this “{” is never closed.', open);
      if (c !== '"') fail(/[A-Za-z_$]/.test(c) ? 'Property names need double quotes, like "name".' : `Expected a property name in double quotes, found ${describe(c)}.`);
      string();
      ws();
      if (text[i] !== ':') fail(`Expected “:” after the property name, found ${describe(text[i])}.`);
      i++;
      value();
      ws();
      if (text[i] === ',') { comma = i; i++; continue; }
      if (text[i] === '}') { i++; return; }
      if (text[i] === undefined) fail('The JSON ends too soon: this “{” is never closed.', open);
      fail(text[i] === '"' ? 'A comma is missing between two properties.' : `Expected “,” or “}”, found ${describe(text[i])}.`);
    }
  }

  function array() {
    const open = i;
    i++;
    ws();
    if (text[i] === ']') { i++; return; }
    let comma = -1;
    for (;;) {
      ws();
      if (text[i] === ']' && comma >= 0) fail('Trailing comma: remove the comma before “]”.', comma);
      if (text[i] === ',') fail('Two commas in a row: a value is missing.');
      value();
      ws();
      if (text[i] === ',') { comma = i; i++; continue; }
      if (text[i] === ']') { i++; return; }
      if (text[i] === undefined) fail('The JSON ends too soon: this “[” is never closed.', open);
      fail(`Expected “,” or “]”, found ${describe(text[i])}. Is a comma missing?`);
    }
  }

  function string() {
    const start = i;
    i++;
    for (;;) {
      const c = text[i];
      if (c === undefined) fail('This text is never closed: a closing " is missing.', start);
      if (c === '"') { i++; return; }
      if (c === '\\') {
        const e = text[i + 1];
        if (e === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) fail('“\\u” must be followed by four hex digits, like \\u00e9.');
          i += 6;
          continue;
        }
        if (!'"\\/bfnrt'.includes(e ?? 'x')) fail(`“\\${e ?? ''}” isn’t a valid escape. Use \\\\ for a backslash.`);
        i += 2;
        continue;
      }
      if (c < ' ') fail(c === '\n' ? 'Line breaks inside text must be written as \\n (or a closing " is missing).' : 'Tabs and control characters inside text must be escaped, like \\t.');
      i++;
    }
  }

  function number() {
    if (/^-?0\d/.test(text.slice(i, i + 3))) fail('Numbers can’t start with a 0, like 007. Use 7, or put it in quotes.');
    const m = text.slice(i, i + 400).match(/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/);
    if (!m) fail(text[i] === '-' ? 'A minus sign must be followed by a number.' : 'Invalid number.');
    const after = text[i + m[0].length];
    if (after === '.') fail('A decimal point must be followed by digits.', i + m[0].length);
    if (after === 'e' || after === 'E') fail('An exponent such as e5 needs digits after the e.', i + m[0].length);
    if (!m[2] && !m[3] && !Number.isSafeInteger(Number(m[0]))) longNumbers.push({ text: m[0], at: i });
    i += m[0].length;
  }

  ws();
  if (i >= text.length) fail('Paste or type some JSON to check.');
  value();
  ws();
  if (i < text.length) fail(text[i] === ',' ? 'Unexpected comma after the end of the JSON.' : 'There’s more text after the end of the JSON. Is it two documents, or a missing “[” around a list?');
  return { longNumbers };
}

/** Line and column (both starting at 1) for an index in the text. */
export function lineColumn(text, at) {
  const before = text.slice(0, at);
  const line = before.split('\n').length;
  const column = at - before.lastIndexOf('\n');
  return { line, column };
}

/** Check JSON. Returns { value, notes } or { error: { message, at, line, column } }. */
export function check(input) {
  const text = String(input ?? '').replace(/^\uFEFF/, '');
  try {
    const notes = scan(text);
    return { value: JSON.parse(text), notes, text };
  } catch (e) {
    if (e instanceof ScanError) return { error: { message: e.message, at: e.at, ...lineColumn(text, e.at) }, text };
    // our scanner passed but the browser refused: report the browser's own words
    return { error: { message: e.message, at: 0, line: 1, column: 1 }, text };
  }
}

function sortDeep(v) {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).map((k) => [k, sortDeep(v[k])]));
  }
  return v;
}

/** Pretty-print (indent: 2, 4 or 'tab') or minify (indent: 0). */
export function format(value, { indent = 2, sortKeys = false } = {}) {
  const v = sortKeys ? sortDeep(value) : value;
  const space = indent === 'tab' ? '\t' : Number(indent) || 0;
  return JSON.stringify(v, null, space);
}

/** Size and shape: how many values, the deepest nesting and the top-level type. */
export function stats(value) {
  let keys = 0;
  let items = 0;
  let depth = 0;
  const walk = (v, d) => {
    depth = Math.max(depth, d);
    if (Array.isArray(v)) { items += v.length; v.forEach((x) => walk(x, d + 1)); }
    else if (v && typeof v === 'object') { const k = Object.keys(v); keys += k.length; k.forEach((x) => walk(v[x], d + 1)); }
  };
  walk(value, 0);
  const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
  return { type, keys, items, depth };
}

/** HTML with spans for keys, strings, numbers and literals; the input must be JSON.stringify output. */
export function highlight(json) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([^"\w-]+)/g, (m, str, colon, lit, num, other) => {
    if (str) return colon ? `<span class="j-key">${esc(str)}</span>${colon}` : `<span class="j-str">${esc(str)}</span>`;
    if (lit) return `<span class="j-lit">${lit}</span>`;
    if (num) return `<span class="j-num">${num}</span>`;
    return esc(other ?? m);
  });
}
