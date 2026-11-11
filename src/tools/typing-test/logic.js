import { randomBelow, randomUint32 } from '../../assets/js/random-core.js';

// 200 of the most common English words: short, familiar and fair for a speed test.
export const WORDS = `the be of and a to in he have it that for they with as not on she at by this we you do but from
or which one would all will there say who make when can more if no man out other so what time up go about than into
could state only new year some take come these know see use get like then first any work now may such give over think
most even find day also after way many must look before great back through long where much should well people down own
just because good each those feel seem how high too place little world very still nation hand old life tell write become
here show house both between need mean call develop under last right move thing general school never same another begin
while number part turn real leave might want point form off child few small since against ask late home interest large
person end open public follow during present without again hold govern around possible head consider word program
problem however lead system set order eye plan run keep face fact group play stand increase early course change help line`
  .split(/\s+/)
  .filter(Boolean);

export const DURATIONS = [15, 30, 60, 120];

const cap = (w) => w[0].toUpperCase() + w.slice(1);

/** A run of random common words; with `punctuation`, sentences get capitals, commas and full stops. */
export function makeWords(count, { punctuation = false } = {}, next = randomUint32) {
  const out = [];
  let inSentence = 0;
  for (let i = 0; i < count; i++) {
    let w = WORDS[randomBelow(WORDS.length, next)];
    if (!punctuation) {
      out.push(w);
      continue;
    }
    if (inSentence === 0) w = cap(w);
    inSentence++;
    const roll = randomBelow(100, next);
    if ((inSentence >= 4 && roll < 20) || inSentence >= 12) {
      w += roll < 3 ? '?' : '.';
      inSentence = 0;
    } else if (inSentence >= 2 && roll >= 90) {
      w += ',';
    }
    out.push(w);
  }
  return out;
}

/**
 * Keystrokes added between two versions of the current word: how many, and how many were right.
 * Deleting never counts; a space is right only straight after the complete word.
 */
export function countKeys(target, prev, next) {
  let i = 0;
  while (i < prev.length && i < next.length && prev[i] === next[i]) i++;
  let total = 0;
  let correct = 0;
  for (let p = i; p < next.length; p++) {
    total++;
    const ch = next[p];
    if (ch === ' ' ? p === target.length : target[p] === ch) correct++;
  }
  return { total, correct };
}

/**
 * Score a test. `words` are the finished words ({ target, typed }); `partial` is the word being typed when time ran out.
 * WPM counts correctly typed characters (a correct word plus its space) and divides by 5 per word, the usual standard.
 */
export function scoreTest({ words, partial = null, elapsedMs, keys = { total: 0, correct: 0 } }) {
  const minutes = elapsedMs / 60000;
  let correctChars = 0;
  let typedChars = 0;
  let correctWords = 0;
  const mistakes = [];
  for (const w of words) {
    typedChars += w.typed.length + 1;
    if (w.typed === w.target) {
      correctWords++;
      correctChars += w.target.length + 1;
    } else {
      mistakes.push(w);
    }
  }
  if (partial && partial.typed) {
    typedChars += partial.typed.length;
    if (partial.target.startsWith(partial.typed)) correctChars += partial.typed.length;
  }
  const perMinute = (chars) => (minutes > 0 ? chars / 5 / minutes : 0);
  return {
    wpm: Math.round(perMinute(correctChars)),
    raw: Math.round(perMinute(typedChars)),
    accuracy: keys.total ? (keys.correct / keys.total) * 100 : 0,
    correctWords,
    wrongWords: mistakes.length,
    correctChars,
    typedChars,
    mistakes,
  };
}

/** A plain-words verdict for a WPM figure. */
export function speedBand(wpm) {
  if (wpm < 25) return 'Getting started';
  if (wpm < 40) return 'About average';
  if (wpm < 60) return 'Above average';
  if (wpm < 80) return 'Fast';
  if (wpm < 100) return 'Very fast';
  return 'Exceptional';
}
