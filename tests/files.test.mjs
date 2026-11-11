import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { parsePages, describeSelection, pdfName, placeImage, move, sortByName } from '../src/tools/merge-pdf/logic.js';
import { sizeOptions, burstNote, convertedName } from '../src/tools/heic-to-jpg/logic.js';
import { isHeifHeader, looksLikeHeic } from '../src/assets/js/heic.js';
import { detectType, planResize } from '../src/assets/js/image-core.js';

test('merge: page selections', () => {
  assert.deepEqual(parsePages('', 3).pages, [0, 1, 2]);
  assert.deepEqual(parsePages('all', 3).pages, [0, 1, 2]);
  assert.deepEqual(parsePages('1-3, 5', 6).pages, [0, 1, 2, 4]);
  assert.deepEqual(parsePages('5-3', 6).pages, [4, 3, 2]);
  assert.deepEqual(parsePages('4-', 6).pages, [3, 4, 5]);
  assert.deepEqual(parsePages('-2', 6).pages, [0, 1]);
  assert.deepEqual(parsePages('2–3', 6).pages, [1, 2]); // an en dash, as some keyboards type
  assert.deepEqual(parsePages('odd', 5).pages, [0, 2, 4]);
  assert.deepEqual(parsePages('even', 5).pages, [1, 3]);
  assert.deepEqual(parsePages('2 2', 3).pages, [1, 1]);
  assert.match(parsePages('9', 6).error, /no page 9: this file has 6 pages/);
  assert.match(parsePages('0', 6).error, /start at 1/);
  assert.match(parsePages('abc', 6).error, /isn’t a page/);
  assert.match(parsePages('-', 6).error, /isn’t a page/);
  assert.equal(describeSelection('', 12), 'All 12 pages');
  assert.equal(describeSelection('1-3', 12), '3 of 12 pages');
  assert.equal(describeSelection('', 1), '1 page');
});

test('merge: names, page sizes and ordering', () => {
  assert.equal(pdfName(''), 'merged.pdf');
  assert.equal(pdfName('Q3 report: final'), 'Q3 report- final.pdf');
  assert.equal(pdfName('notes.PDF'), 'notes.pdf');
  const portrait = placeImage(200, 300, 'letter');
  assert.deepEqual([portrait.pageWidth, portrait.pageHeight], [612, 792]);
  assert.ok(Math.abs(portrait.x + portrait.width / 2 - 306) < 1e-9 && portrait.y >= 36);
  const wide = placeImage(4000, 3000, 'a4');
  assert.ok(wide.pageWidth > wide.pageHeight, 'landscape photos get a landscape page');
  assert.ok(wide.width <= wide.pageWidth - 72 + 1e-9);
  assert.deepEqual([placeImage(200, 300, 'image').pageWidth, placeImage(200, 300, 'image').pageHeight], [150, 225]);
  assert.ok(placeImage(40000, 1000, 'image').pageWidth <= 14400);
  const list = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
  assert.deepEqual(move(list, 2, -1).map((x) => x.name), ['a', 'c', 'b']);
  assert.deepEqual(move(list, 0, -1).map((x) => x.name), ['a', 'b', 'c']);
  assert.deepEqual(sortByName([{ name: 'scan 10' }, { name: 'Scan 2' }, { name: 'scan 1' }]).map((x) => x.name), ['scan 1', 'Scan 2', 'scan 10']);
});

test('heic: spotting HEIC files by their first bytes, not just the name', async () => {
  const sample = new Uint8Array(await readFile(new URL('../src/assets/samples/sample-photo.heic', import.meta.url)));
  assert.ok(isHeifHeader(sample));
  const ftyp = (major, ...compat) => new TextEncoder().encode(`\0\0\0\x18ftyp${major}\0\0\0\0${compat.join('')}`);
  assert.ok(isHeifHeader(ftyp('mif1', 'heic')));
  assert.ok(!isHeifHeader(ftyp('avif', 'mif1')), 'AVIF shares the container but browsers open it natively');
  assert.ok(!isHeifHeader(ftyp('isom', 'mp41')), 'an MP4 video is not a photo');
  assert.ok(!isHeifHeader(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])));
  assert.ok(looksLikeHeic({ name: 'IMG_0001.HEIC', type: '' }));
  assert.ok(looksLikeHeic({ name: 'x', type: 'image/heif' }));
  assert.ok(!looksLikeHeic({ name: 'photo.jpg', type: 'image/jpeg' }));
  assert.equal(detectType('DSC_1.HIF', ''), 'image/heif');
});

test('heic: sizes, names and notes', () => {
  assert.deepEqual(sizeOptions('0'), { mode: 'fit' });
  const plan = planResize({ width: 4032, height: 3024 }, sizeOptions('2048'));
  assert.deepEqual([plan.width, plan.height], [2048, 1536]);
  const small = planResize({ width: 800, height: 600 }, sizeOptions('2048'));
  assert.deepEqual([small.width, small.height], [800, 600], 'never enlarged');
  assert.equal(convertedName('IMG_1234.HEIC', 'jpg'), 'IMG_1234.jpg');
  assert.equal(convertedName('holiday.heif', 'png'), 'holiday.png');
  assert.equal(burstNote(1), '');
  assert.match(burstNote(3), /holds 3 images/);
});
