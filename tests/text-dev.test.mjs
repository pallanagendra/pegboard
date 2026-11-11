import test from 'node:test';
import assert from 'node:assert/strict';

import { sequence } from '../src/assets/js/random-core.js';
import { makePassword, makePassphrase, characterSets, strength, crackTime, SETS, LOOK_ALIKE } from '../src/tools/password-generator/logic.js';
import words from '../src/tools/password-generator/words.js';
import { convert } from '../src/tools/case-converter/logic.js';
import { check, format, stats, highlight } from '../src/tools/json-formatter/logic.js';
import { encodeText, parseBase64, bytesToText, bytesToBase64, sniff, encodedLength } from '../src/tools/base64-encoder-decoder/logic.js';
import { parseColor, formats, contrast, wcag, formatRatio, readableOn, tintsAndShades, nearestPassing, toHex } from '../src/tools/color-picker/logic.js';

test('password: every chosen kind of character appears, look-alikes can be left out', () => {
  for (let i = 0; i < 200; i++) {
    const { password } = makePassword(8, { upper: true, lower: true, digits: true, symbols: true });
    assert.equal(password.length, 8);
    for (const set of Object.values(SETS)) assert.ok([...password].some((c) => set.includes(c)), `${password} is missing one kind`);
  }
  for (let i = 0; i < 100; i++) {
    const { password } = makePassword(40, { upper: true, lower: true, digits: true, symbols: false, avoidLookAlike: true });
    assert.ok(![...password].some((c) => LOOK_ALIKE.includes(c) || SETS.symbols.includes(c)), password);
  }
  assert.equal(characterSets({ upper: false, lower: false, digits: true, symbols: false, avoidLookAlike: true })[0], '23456789');
  assert.match(makePassword(16, { upper: false, lower: false, digits: false, symbols: false }).error, /at least one/);
  assert.match(makePassword(3, {}).error, /from 4/);
  assert.equal(Math.round(makePassword(16, {}).bits), 103);
});

test('password: passphrases, strength labels and guessing time', () => {
  assert.equal(words.length, 7776);
  assert.equal(new Set(words).size, 7776);
  const p = makePassphrase(words, 5, { separator: '-', capitalize: true, addNumber: true });
  const parts = p.password.split('-');
  assert.equal(parts.length, 5);
  assert.ok(parts.every((w) => /^[A-Z][a-z-]*\d?$/.test(w)), p.password);
  assert.equal(parts.filter((w) => /\d$/.test(w)).length, 1);
  assert.equal(Math.round(makePassphrase(words, 6).bits), 78);
  assert.equal(makePassphrase(['alpha', 'beta'], 3, { separator: ' ' }, sequence(0, 1, 0)).password, 'alpha beta alpha');
  assert.match(makePassphrase(words, 2).error, /3 to 12/);
  assert.equal(strength(20).label, 'Very weak');
  assert.equal(strength(64).label, 'Strong');
  assert.equal(strength(100).label, 'Very strong');
  assert.equal(crackTime(30).text, 'less than a second');
  assert.equal(crackTime(128).text, 'trillions of years');
  assert.match(crackTime(50).text, /^\d+ hours?$|^\d+ minutes?$/);
});

test('case: writing and code cases', () => {
  assert.equal(convert('the quick brown fox jumps over the lazy dog', 'title'), 'The Quick Brown Fox Jumps Over the Lazy Dog');
  assert.equal(convert('the lord of the rings: the return of the king', 'title'), 'The Lord of the Rings: The Return of the King');
  assert.equal(convert('how NASA tested the new iPhone', 'title'), 'How NASA Tested the New iPhone');
  assert.equal(convert('WHY IS THIS ALL CAPS? it is.', 'title'), 'Why Is This All Caps? It Is.');
  assert.equal(convert('HELLO THERE. i AM HERE!\nnew line', 'sentence'), 'Hello there. I am here!\nNew line');
  assert.equal(convert('parseHTTPResponse v2\nuser first-name', 'camel'), 'parseHttpResponseV2\nuserFirstName');
  assert.equal(convert('Hello World', 'snake'), 'hello_world');
  assert.equal(convert('Hello World', 'kebab'), 'hello-world');
  assert.equal(convert('Hello World', 'constant'), 'HELLO_WORLD');
  assert.equal(convert('Hello World', 'pascal'), 'HelloWorld');
  assert.equal(convert('Hello World', 'dot'), 'hello.world');
  assert.equal(convert('Hello World', 'alternating'), 'hElLo WoRlD');
  assert.equal(convert('Hello World', 'inverse'), 'hELLO wORLD');
  assert.equal(convert('straße café', 'upper'), 'STRASSE CAFÉ');
});

test('json: errors point at the right line and column', () => {
  const e1 = check('{\n  "a": 1,\n  b: 2\n}').error;
  assert.deepEqual([e1.line, e1.column], [3, 3]);
  assert.match(e1.message, /double quotes/);
  const e2 = check('[1, 2, 3,]').error;
  assert.deepEqual([e2.line, e2.column], [1, 9]);
  assert.match(e2.message, /Trailing comma/);
  assert.match(check("{'a': 1}").error.message, /single quotes/);
  assert.match(check('{"a": 1 "b": 2}').error.message, /comma is missing/);
  assert.match(check('{"a": undefined}').error.message, /undefined/);
  assert.match(check('{"a": 1').error.message, /never closed/);
  assert.match(check('{} {}').error.message, /more text after/);
  assert.match(check('{"n": 012}').error.message, /start with a 0/);
  assert.ok(check('﻿{"ok": true}').value.ok);
  assert.equal(check('{"id": 12345678901234567890}').notes.longNumbers.length, 1);
  assert.equal(check('{"id": 9007199254740991}').notes.longNumbers.length, 0);
});

test('json: formatting, stats and colouring', () => {
  const v = check('{"b":[1,{"z":null,"a":true}],"a":"x<y"}').value;
  assert.equal(format(v, { indent: 0 }), '{"b":[1,{"z":null,"a":true}],"a":"x<y"}');
  assert.equal(format(v, { indent: 2, sortKeys: true }).split('\n')[1], '  "a": "x<y",');
  assert.equal(format({ a: 1 }, { indent: 'tab' }), '{\n\t"a": 1\n}');
  assert.deepEqual(stats(v), { type: 'object', keys: 4, items: 2, depth: 3 });
  const html = highlight(format(v, { indent: 0 }));
  assert.ok(html.includes('<span class="j-str">"x&lt;y"</span>'));
  assert.ok(html.includes('<span class="j-key">"b"</span>'));
  assert.ok(!html.includes('<y'));
});

test('base64: text round trips, URL-safe, padding and data URLs', () => {
  assert.equal(encodeText('Hello'), 'SGVsbG8=');
  assert.equal(encodeText('é'), 'w6k=');
  assert.equal(encodeText('👋'), '8J+Riw==');
  assert.equal(encodeText('👋', { urlSafe: true }), '8J-Riw');
  assert.equal(encodeText('a'.repeat(100), { wrap: 76 }).split('\n')[0].length, 76);
  const round = (s) => bytesToText(parseBase64(encodeText(s)).bytes).text;
  assert.equal(round('Ünïcödé 👋 test'), 'Ünïcödé 👋 test');
  assert.equal(bytesToText(parseBase64('8J-Riw').bytes).text, '👋');
  assert.equal(bytesToText(parseBase64('SGVs\nbG8').bytes).text, 'Hello');
  const d = parseBase64('data:text/plain;charset=utf-8;base64,SGVsbG8=');
  assert.equal(d.mime, 'text/plain');
  assert.equal(bytesToText(d.bytes).text, 'Hello');
  assert.match(parseBase64('SGVs*G8=').error, /isn’t a Base64 character/);
  assert.match(parseBase64('SGVs=bG8').error, /middle/);
  assert.match(parseBase64('SGVsb').error, /length/);
  assert.match(parseBase64('data:text/plain,hello').error, /isn’t Base64/);
});

test('base64: files are spotted and sized', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.equal(sniff(png).ext, 'png');
  assert.ok(bytesToText(png).binary);
  assert.equal(sniff(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])).ext, 'webp');
  assert.equal(sniff(new Uint8Array([1, 2, 3])).ext, 'bin');
  assert.equal(bytesToBase64(png), 'iVBORw0KGgoAAAAA');
  assert.equal(encodedLength(3), 4);
  assert.equal(encodedLength(4), 8);
});

test('color: parsing and every format', () => {
  assert.deepEqual(parseColor('#fc3'), { r: 255, g: 204, b: 51, a: 1 });
  assert.deepEqual(parseColor('rgba(255 200 61 / 50%)'), { r: 255, g: 200, b: 61, a: 0.5 });
  assert.deepEqual(parseColor('hsl(210deg 50% 40%)'), { r: 51, g: 102, b: 153, a: 1 });
  assert.deepEqual(parseColor('255, 200, 61'), { r: 255, g: 200, b: 61, a: 1 });
  assert.equal(parseColor('#12345'), null);
  assert.equal(parseColor('teal'), null); // names are read by the browser, not here
  assert.deepEqual(formats(parseColor('#ffc83d')), {
    hex: '#ffc83d', rgb: 'rgb(255, 200, 61)', hsl: 'hsl(43, 100%, 62%)', hsv: 'hsv(43, 76%, 100%)', cmyk: 'cmyk(0%, 22%, 76%, 0%)', oklch: 'oklch(85.9% 0.158 85.8)',
  });
  assert.equal(formats(parseColor('#ff0000')).oklch, 'oklch(62.8% 0.258 29.2)');
  assert.equal(formats(parseColor('#ffc83d80')).hex, '#ffc83d80');
});

test('color: WCAG contrast and suggestions', () => {
  const white = parseColor('#fff');
  const black = parseColor('#000');
  assert.equal(formatRatio(contrast(white, black)), '21.00:1');
  const grey = contrast(parseColor('#777'), white);
  assert.equal(formatRatio(grey), '4.47:1'); // just under AA, and never rounded up to pass
  assert.deepEqual(wcag(grey), { aaNormal: false, aaLarge: true, aaaNormal: false, aaaLarge: false, ui: true });
  assert.ok(wcag(contrast(parseColor('#767676'), white)).aaNormal);
  assert.equal(toHex(readableOn(parseColor('#ffc83d'))), '#000000');
  assert.equal(toHex(readableOn(parseColor('#17212b'))), '#ffffff');
  const fix = nearestPassing(parseColor('#ffc83d'), white, 4.5);
  assert.ok(contrast(fix, white) >= 4.5);
  assert.equal(toHex(fix), '#996d00');
  const scale = tintsAndShades(parseColor('#ffc83d'));
  assert.equal(scale.length, 9);
  assert.equal(toHex(scale[4]), '#ffc83d');
});
