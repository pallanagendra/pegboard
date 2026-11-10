// Unit tests for the pure logic behind each tool. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as barcode from '../src/tools/barcode-generator/logic.js';
import * as qr from '../src/tools/qr-code-generator/logic.js';
import * as iframe from '../src/tools/iframe-generator/logic.js';
import * as url from '../src/tools/url-encoder-decoder/logic.js';
import * as words from '../src/tools/word-counter/logic.js';

// ---------------------------------------------------------------- barcode
test('barcode: GS1 check digits match known products', () => {
  assert.equal(barcode.gs1CheckDigit('590123412345'), 7); // EAN-13 5901234123457
  assert.equal(barcode.gs1CheckDigit('03600029145'), 2); // UPC-A 036000291452
  assert.equal(barcode.gs1CheckDigit('9638507'), 4); // EAN-8 96385074
  assert.equal(barcode.gs1CheckDigit('1540014128876'), 3); // ITF-14 15400141288763
});

test('barcode: validation explains what is wrong', () => {
  assert.equal(barcode.validate('EAN13', '590123412345').ok, true);
  assert.match(barcode.validate('EAN13', '590123412345').note, /Check digit 7/);
  assert.equal(barcode.validate('EAN13', '5901234123457').ok, true);
  assert.match(barcode.validate('EAN13', '5901234123450').message, /should be 7/);
  assert.match(barcode.validate('EAN13', '12345').message, /12 or 13 digits/);
  assert.match(barcode.validate('UPC', 'abc').message, /digits only/);
  assert.equal(barcode.validate('CODE39', 'abc-1').value, 'ABC-1');
  assert.equal(barcode.validate('CODE128', 'café').ok, false);
  assert.equal(barcode.validate('ITF', '123').ok, false);
  assert.equal(barcode.validate('pharmacode', '2').ok, false);
  assert.equal(barcode.validate('CODE128', '').ok, false);
});

test('barcode: every format has a valid example', () => {
  for (const [format, f] of Object.entries(barcode.FORMATS)) {
    assert.equal(barcode.validate(format, f.example).ok, true, `${format} example "${f.example}"`);
  }
});

// ---------------------------------------------------------------- QR
test('qr: URLs get a scheme when missing', () => {
  assert.equal(qr.normalizeUrl('example.com/menu'), 'https://example.com/menu');
  assert.equal(qr.normalizeUrl('http://example.com'), 'http://example.com');
  assert.equal(qr.normalizeUrl('mailto:a@b.co'), 'mailto:a@b.co');
  assert.equal(qr.normalizeUrl('hello world'), 'hello world');
});

test('qr: Wi-Fi payload escapes special characters', () => {
  const r = qr.buildPayload('wifi', { wifiSsid: 'Café;Guest', wifiPassword: 'p:a"ss', wifiSecurity: 'WPA' });
  assert.equal(r.payload, 'WIFI:T:WPA;S:Café\\;Guest;P:p\\:a\\"ss;;');
  const open = qr.buildPayload('wifi', { wifiSsid: 'Open', wifiSecurity: 'nopass', wifiHidden: true });
  assert.equal(open.payload, 'WIFI:T:nopass;S:Open;H:true;;');
  assert.equal(qr.buildPayload('wifi', { wifiSsid: 'X', wifiSecurity: 'WPA', wifiPassword: '' }).ok, false);
});

test('qr: email, phone, SMS and vCard payloads', () => {
  assert.equal(qr.buildPayload('email', { emailTo: 'hi@example.com', emailSubject: 'Hello there' }).payload, 'mailto:hi@example.com?subject=Hello%20there');
  assert.equal(qr.buildPayload('email', { emailTo: 'nope' }).ok, false);
  assert.equal(qr.buildPayload('phone', { phone: '+1 (555) 010-0199' }).payload, 'tel:+15550100199');
  assert.equal(qr.buildPayload('sms', { smsNumber: '555 0100', smsMessage: 'On my way' }).payload, 'SMSTO:5550100:On my way');
  const v = qr.buildPayload('vcard', { vcFirst: 'Ada', vcLast: 'Lovelace', vcOrg: 'Analytical, Inc.' }).payload;
  assert.match(v, /^BEGIN:VCARD\r\nVERSION:3.0\r\nN:Lovelace;Ada;;;\r\nFN:Ada Lovelace\r\nORG:Analytical\\, Inc.\r\nEND:VCARD$/);
});

test('qr: color checks catch unscannable combinations', () => {
  assert.equal(qr.isDarkOnLight('#000000', '#ffffff'), true);
  assert.equal(qr.isDarkOnLight('#ffffff', '#000000'), false);
  assert.ok(qr.contrastRatio('#000000', '#ffffff') > 20);
  assert.ok(qr.contrastRatio('#777777', '#888888') < 2);
});

test('qr: module path merges horizontal runs', () => {
  const grid = [
    [1, 1, 0],
    [0, 1, 0],
    [0, 0, 0],
  ];
  const d = qr.modulesToPath(3, (r, c) => grid[r][c] === 1, 1);
  assert.equal(d, 'M1 1h2v1h-2zM2 2h1v1h-1z');
});

// ---------------------------------------------------------------- iframe
test('iframe: converts popular share links to embed addresses', () => {
  assert.equal(iframe.toEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s').src, 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=90');
  assert.equal(iframe.toEmbedUrl('https://youtu.be/dQw4w9WgXcQ').src, 'https://www.youtube.com/embed/dQw4w9WgXcQ');
  assert.equal(iframe.toEmbedUrl('youtube.com/shorts/abcDEF12345').src, 'https://www.youtube.com/embed/abcDEF12345');
  assert.equal(iframe.toEmbedUrl('https://vimeo.com/76979871').src, 'https://player.vimeo.com/video/76979871');
  assert.equal(iframe.toEmbedUrl('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC').src, 'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC');
  assert.equal(iframe.toEmbedUrl('example.com').src, 'https://example.com/');
  assert.ok(iframe.toEmbedUrl('javascript:alert(1)').error);
});

test('iframe: responsive and fixed code', () => {
  const r = iframe.buildIframe({ url: 'https://example.com', title: 'Demo "page"', sizeMode: 'responsive', ratio: '16/9', maxWidth: 800, lazy: true, fullscreen: true, allow: ['autoplay'] });
  assert.equal(
    r.html,
    '<iframe src="https://example.com/" title="Demo &quot;page&quot;" style="width:100%;height:auto;aspect-ratio:16 / 9;max-width:800px;border:0" loading="lazy" allow="autoplay" allowfullscreen></iframe>',
  );
  const f = iframe.buildIframe({ url: 'https://example.com/?a=1&b=2', sizeMode: 'fixed', width: 100, widthUnit: '%', height: 400, border: true });
  assert.match(f.html, /src="https:\/\/example.com\/\?a=1&amp;b=2"/);
  assert.match(f.html, /width="100%" height="400"/);
  assert.match(f.html, /border:1px solid/);
  const s = iframe.buildIframe({ url: 'https://example.com', sizeMode: 'fixed', useSandbox: true, sandbox: ['allow-scripts', 'allow-same-origin'] });
  assert.match(s.html, /sandbox="allow-scripts allow-same-origin"/);
  assert.ok(s.notes.some((n) => /remove its own sandbox/.test(n)));
});

// ---------------------------------------------------------------- URL
test('url: encode variants', () => {
  assert.equal(url.encode('a b&c/d', 'component'), 'a%20b%26c%2Fd');
  assert.equal(url.encode("it's (ok)*", 'rfc3986'), 'it%27s%20%28ok%29%2A');
  assert.equal(url.encode('a b~!', 'form'), new URLSearchParams({ x: 'a b~!' }).toString().slice(2));
  assert.equal(url.encode('https://x.com/a b?q=é', 'uri'), 'https://x.com/a%20b?q=%C3%A9');
});

test('url: decode handles +, double encoding and broken sequences', () => {
  assert.equal(url.decode('caf%C3%A9+au+lait').text, 'café au lait');
  assert.equal(url.decode('a+b', { plusAsSpace: false }).text, 'a+b');
  assert.equal(url.decode('a%2Bb').text, 'a+b');
  const twice = url.decode('100%2525%2520off', { repeat: true });
  assert.equal(twice.text, '100% off');
  assert.equal(twice.passes, 2); // two layers: %2525 → %25 → %
  assert.equal(url.decode('spring%2Bsale%2520now', { repeat: true }).text, 'spring+sale now');
  const broken = url.decode('ok%20then%E2%28bad');
  assert.equal(broken.text, 'ok then%E2(bad');
  assert.equal(broken.bad, 1);
});

test('url: breaks a link into parts and parameters', () => {
  const p = url.parseUrl('https://example.com:8443/a%20b/?utm_source=news&q=caf%C3%A9#top');
  assert.deepEqual(Object.fromEntries(p.parts), { Scheme: 'https', Host: 'example.com', Port: '8443', Path: '/a b/', Fragment: 'top' });
  assert.deepEqual(p.params, [['utm_source', 'news'], ['q', 'café']]);
  assert.equal(url.parseUrl('not a url'), null);
});

// ---------------------------------------------------------------- words
test('words: counts what people see', () => {
  const r = words.analyze("Hello, world! It's a well-known fact.\n\nSecond paragraph 👍🏽 here.");
  assert.equal(r.words, 9);
  assert.equal(r.sentences, 3);
  assert.equal(r.paragraphs, 2);
  assert.equal(r.lines, 3);
  assert.equal(words.countGraphemes('👍🏽🇺🇸é'), 3);
});

test('words: empty text is all zeros', () => {
  const r = words.analyze('');
  assert.equal(r.words, 0);
  assert.equal(r.characters, 0);
  assert.equal(r.sentences, 0);
  assert.equal(r.paragraphs, 0);
  assert.equal(r.readingTime, '0 s');
});

test('words: SMS encoding and segments', () => {
  assert.deepEqual(words.smsInfo('a'.repeat(160)), { encoding: 'GSM-7', units: 160, segments: 1 });
  assert.equal(words.smsInfo('a'.repeat(161)).segments, 2);
  assert.equal(words.smsInfo('hi 👋').encoding, 'Unicode');
  assert.equal(words.smsInfo('€').units, 2);
});

test('words: keyword density skips common words', () => {
  const r = words.analyze('The cat and the hat. The cat sat.');
  assert.deepEqual(r.keywords.slice(0, 1), [{ word: 'cat', count: 2, percent: 25 }]);
  assert.ok(!r.keywords.some((k) => k.word === 'the'));
});

test('words: durations read naturally', () => {
  assert.equal(words.formatDuration(0.5), '30 s');
  assert.equal(words.formatDuration(2), '2 min');
  assert.equal(words.formatDuration(2.25), '2 min 15 s');
  assert.equal(words.formatDuration(75), '1 h 15 min');
});
