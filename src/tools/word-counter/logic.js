// Text statistics. Pure functions, unit tested. Uses Intl.Segmenter when available so
// emoji, accented letters and non-Latin scripts are counted the way people read them.

const hasSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function';
const seg = (granularity) => (hasSegmenter ? new Intl.Segmenter(undefined, { granularity }) : null);
const graphemes = seg('grapheme');
const wordsSeg = seg('word');
const sentencesSeg = seg('sentence');

export const READING_WPM = 238; // average silent reading speed for adults (Brysbaert, 2019)
export const SPEAKING_WPM = 150;

export const LIMITS = [
  { id: 'meta-title', label: 'Search result title', max: 60 },
  { id: 'meta-desc', label: 'Meta description', max: 160 },
  { id: 'x', label: 'Post on X', max: 280 },
  { id: 'yt-title', label: 'YouTube title', max: 100 },
  { id: 'instagram', label: 'Instagram caption', max: 2200 },
  { id: 'linkedin', label: 'LinkedIn post', max: 3000 },
];

export const STOP_WORDS = new Set(
  ('a about above after again against all am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves ' +
    "it's i'm don't can't won't isn't aren't wasn't weren't i've you're we're they're that's there's let's also")
    .split(/\s+/)
    .filter(Boolean),
);

export function countGraphemes(text) {
  if (graphemes) {
    let n = 0;
    for (const _ of graphemes.segment(text)) n++;
    return n;
  }
  return Array.from(text).length;
}

export function getWords(text) {
  if (wordsSeg) {
    // Join pieces split by a hyphen or apostrophe with no spaces ("well-known", "rock'n'roll"),
    // the way word processors count them.
    const out = [];
    let joinNext = false;
    let prevWasWord = false;
    for (const s of wordsSeg.segment(text)) {
      if (s.isWordLike) {
        if (joinNext && out.length) out[out.length - 1] += `${joinNext}${s.segment}`;
        else out.push(s.segment);
        joinNext = false;
        prevWasWord = true;
      } else {
        joinNext = prevWasWord && /^['’\-‐]$/.test(s.segment) ? s.segment : false;
        prevWasWord = false;
      }
    }
    return out;
  }
  return text.match(/[\p{L}\p{N}]+(?:['’\-‐][\p{L}\p{N}]+)*/gu) || [];
}

export function countSentences(text) {
  if (!text.trim()) return 0;
  if (sentencesSeg) {
    let n = 0;
    for (const s of sentencesSeg.segment(text)) if (/[\p{L}\p{N}]/u.test(s.segment)) n++;
    return n;
  }
  return (text.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || []).filter((s) => /[\p{L}\p{N}]/u.test(s)).length;
}

export function formatDuration(minutes) {
  const totalSeconds = Math.round(minutes * 60);
  if (totalSeconds === 0) return '0 s';
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m >= 60) return `${Math.floor(m / 60)} h ${m % 60} min`;
  return s ? `${m} min ${s} s` : `${m} min`;
}

// GSM 03.38 basic + extension characters; anything else forces UCS-2 (70-char) SMS.
const GSM_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = '^{}\\[~]|€\f';

export function smsInfo(text) {
  if (!text) return { encoding: 'GSM-7', units: 0, segments: 0 };
  let gsm = true;
  let units = 0;
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) units += 1;
    else if (GSM_EXT.includes(ch)) units += 2;
    else { gsm = false; break; }
  }
  if (gsm) return { encoding: 'GSM-7', units, segments: units <= 160 ? 1 : Math.ceil(units / 153) };
  const u16 = text.length; // UCS-2 counts UTF-16 code units
  return { encoding: 'Unicode', units: u16, segments: u16 <= 70 ? 1 : Math.ceil(u16 / 67) };
}

export function analyze(text, { hideCommon = true, top = 10 } = {}) {
  const t = String(text ?? '');
  const words = getWords(t);
  const lower = words.map((w) => w.toLocaleLowerCase().replace(/’/g, "'"));
  const freq = new Map();
  for (const w of lower) {
    if (hideCommon && (STOP_WORDS.has(w) || w.length < 2 || /^\d+$/.test(w))) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const keywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, top)
    .map(([word, count]) => ({ word, count, percent: words.length ? (count / words.length) * 100 : 0 }));

  const characters = countGraphemes(t);
  const charactersNoSpaces = countGraphemes(t.replace(/\s+/g, ''));
  const letters = words.reduce((n, w) => n + Array.from(w).length, 0);

  return {
    characters,
    charactersNoSpaces,
    words: words.length,
    uniqueWords: new Set(lower).size,
    sentences: countSentences(t),
    paragraphs: t.trim() ? t.split(/\n\s*\n/).filter((p) => p.trim()).length : 0,
    lines: t ? t.split(/\r\n|\r|\n/).length : 0,
    bytes: new TextEncoder().encode(t).length,
    avgWordLength: words.length ? letters / words.length : 0,
    readingTime: formatDuration(words.length / READING_WPM),
    speakingTime: formatDuration(words.length / SPEAKING_WPM),
    sms: smsInfo(t),
    keywords,
  };
}
