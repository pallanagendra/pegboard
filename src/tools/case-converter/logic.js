// Text case conversions. Writing cases (title, sentence) keep punctuation and spacing as typed;
// code cases (camelCase, snake_case …) work line by line, so a list of names converts in one go.

export const CASES = [
  { id: 'title', label: 'Title Case' },
  { id: 'sentence', label: 'Sentence case' },
  { id: 'upper', label: 'UPPERCASE' },
  { id: 'lower', label: 'lowercase' },
  { id: 'camel', label: 'camelCase' },
  { id: 'pascal', label: 'PascalCase' },
  { id: 'snake', label: 'snake_case' },
  { id: 'kebab', label: 'kebab-case' },
  { id: 'constant', label: 'CONSTANT_CASE' },
  { id: 'dot', label: 'dot.case' },
  { id: 'alternating', label: 'aLtErNaTiNg' },
  { id: 'inverse', label: 'iNVERSE cASE' },
];

// short words that stay lower case inside a title (common headline style)
const SMALL = new Set('a an and as at but by for in nor of off on or per so the to up via vs yet'.split(' '));
const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu;

const upperFirst = (w) => w.charAt(0).toUpperCase() + w.slice(1);
// an acronym like NASA or a mixed-case name like iPhone is kept as typed
const keepAsTyped = (w, shouting) => !shouting && w.length > 1 && (w === w.toUpperCase() && /\p{L}/u.test(w) ? true : /\p{Ll}\p{Lu}/u.test(w));

// mostly capitals means the whole text is shouting, so nothing in it counts as an acronym
function isShouting(text) {
  const letters = (text.match(/\p{L}/gu) || []).filter((c) => c.toLowerCase() !== c.toUpperCase());
  const caps = letters.filter((c) => c === c.toUpperCase()).length;
  return letters.length > 0 && caps / letters.length > 0.6;
}

export function titleCase(text) {
  const shouting = isShouting(text);
  return text
    .split(/(\n)/)
    .map((line) => {
      const words = [...line.matchAll(WORD)];
      let out = '';
      let last = 0;
      words.forEach((m, i) => {
        const w = m[0];
        const before = line.slice(last, m.index);
        const startsPhrase = i === 0 || /[:.!?—–]\s*$/.test(before) || /[:.!?]\s*["“'‘(]*$/.test(line.slice(0, m.index));
        const endsLine = i === words.length - 1;
        let next;
        if (keepAsTyped(w, shouting)) next = w;
        else if (!startsPhrase && !endsLine && SMALL.has(w.toLowerCase())) next = w.toLowerCase();
        else next = upperFirst(w.toLowerCase());
        out += before + next;
        last = m.index + w.length;
      });
      return out + line.slice(last);
    })
    .join('');
}

export function sentenceCase(text) {
  const shouting = isShouting(text);
  let capNext = true;
  let out = '';
  let last = 0;
  for (const m of text.matchAll(WORD)) {
    const w = m[0];
    const before = text.slice(last, m.index);
    if (/[.!?]\s*$|\n\s*$/.test(before)) capNext = true;
    let next = keepAsTyped(w, shouting) ? w : w.toLowerCase();
    if (next === 'i' || /^i['’]/.test(next)) next = 'I' + next.slice(1);
    if (capNext) next = upperFirst(next);
    capNext = false;
    out += before + next;
    last = m.index + w.length;
  }
  return out + text.slice(last);
}

/** Split an identifier or phrase into lower-case words: "parseHTTPResponse v2" → ["parse","http","response","v2"]. */
export function splitWords(line) {
  return line
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

const perLine = (text, fn) => text.split('\n').map((line) => (line.trim() ? fn(splitWords(line)) : line)).join('\n');

export function convert(text, id) {
  const s = String(text ?? '');
  switch (id) {
    case 'upper': return s.toUpperCase();
    case 'lower': return s.toLowerCase();
    case 'title': return titleCase(s);
    case 'sentence': return sentenceCase(s);
    case 'camel': return perLine(s, (w) => w.map((x, i) => (i ? upperFirst(x) : x)).join(''));
    case 'pascal': return perLine(s, (w) => w.map(upperFirst).join(''));
    case 'snake': return perLine(s, (w) => w.join('_'));
    case 'kebab': return perLine(s, (w) => w.join('-'));
    case 'constant': return perLine(s, (w) => w.join('_').toUpperCase());
    case 'dot': return perLine(s, (w) => w.join('.'));
    case 'alternating': {
      let n = 0;
      return [...s].map((c) => (c.toLowerCase() !== c.toUpperCase() ? (n++ % 2 ? c.toUpperCase() : c.toLowerCase()) : c)).join('');
    }
    case 'inverse': return [...s].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('');
    default: return s;
  }
}
