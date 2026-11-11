// Unit tests for the image tools' shared logic and the ZIP writer. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as core from '../src/assets/js/image-core.js';
import { crc32, createZip } from '../src/assets/js/zip.js';

test('image: types are detected from MIME type or extension', () => {
  assert.equal(core.detectType('a.jpg', 'image/jpeg'), 'image/jpeg');
  assert.equal(core.detectType('a.jpg', 'image/jpg'), 'image/jpeg');
  assert.equal(core.detectType('IMG_0001.HEIC', ''), 'image/heic');
  assert.equal(core.detectType('notes.txt', 'text/plain'), '');
  assert.equal(core.isImage('logo.svg', ''), true);
  assert.equal(core.isImage('report.pdf', 'application/pdf'), false);
});

test('image: byte sizes read like a file manager', () => {
  assert.equal(core.formatBytes(512), '512 B');
  assert.equal(core.formatBytes(1536), '2 KB');
  assert.equal(core.formatBytes(420 * 1024), '420 KB');
  assert.equal(core.formatBytes(3.24 * 1024 * 1024), '3.2 MB');
  assert.equal(core.sizeChange(1000, 130), -87);
  assert.equal(core.sizeChange(1000, 1200), 20);
});

test('image: output type and file names', () => {
  assert.equal(core.outputType('image/png', 'same'), 'image/png');
  assert.equal(core.outputType('image/gif', 'same'), 'image/png');
  assert.equal(core.outputType('image/avif', 'same', 'image/webp'), 'image/webp');
  assert.equal(core.outputType('image/png', 'image/jpeg'), 'image/jpeg');
  assert.equal(core.outputName('Holiday photo.HEIC', 'image/jpeg', '-1080x720'), 'Holiday photo-1080x720.jpg');
  assert.equal(core.outputName('a/b:c.png', 'image/webp'), 'a-b-c.webp');
  assert.deepEqual(core.uniqueNames(['a.jpg', 'A.jpg', 'a.jpg', 'b.png']), ['a.jpg', 'A (2).jpg', 'a (3).jpg', 'b.png']);
});

test('image: resize plans', () => {
  const photo = { width: 4000, height: 3000 };
  assert.deepEqual(core.planResize(photo, { mode: 'fit', width: 1080, height: 1080 }), { width: 1080, height: 810, sx: 0, sy: 0, sw: 4000, sh: 3000, dx: 0, dy: 0, dw: 1080, dh: 810 });
  assert.equal(core.planResize(photo, { mode: 'fit', width: 1200 }).height, 900);
  assert.equal(core.planResize(photo, { mode: 'fit', height: 600 }).width, 800);
  assert.equal(core.planResize({ width: 800, height: 600 }, { mode: 'fit', width: 1600, noEnlarge: true }).width, 800);
  assert.equal(core.planResize({ width: 800, height: 600 }, { mode: 'fit', width: 1600 }).width, 1600);

  const cover = core.planResize(photo, { mode: 'cover', width: 1080, height: 1080 });
  assert.deepEqual([cover.width, cover.height, cover.sx, cover.sy, cover.sw, cover.sh], [1080, 1080, 500, 0, 3000, 3000]);

  const contain = core.planResize(photo, { mode: 'contain', width: 1080, height: 1080 });
  assert.deepEqual([contain.width, contain.height, contain.dx, contain.dy, contain.dw, contain.dh], [1080, 1080, 0, 135, 1080, 810]);

  const stretch = core.planResize(photo, { mode: 'stretch', width: 500, height: 500 });
  assert.deepEqual([stretch.width, stretch.height, stretch.dw, stretch.dh], [500, 500, 500, 500]);

  assert.deepEqual([core.planResize(photo, { mode: 'percent', percent: 25 }).width, core.planResize(photo, { mode: 'percent', percent: 25 }).height], [1000, 750]);
  // exact modes need both sides; with one they fall back to "fit"
  assert.equal(core.planResize(photo, { mode: 'cover', width: 1000 }).height, 750);
  assert.throws(() => core.planResize(photo, { mode: 'percent', percent: 900 }), /too large/);
  assert.throws(() => core.planResize({ width: 0, height: 10 }, {}), /no size/);
});

test('image: target size search finds the best quality that fits', async () => {
  // a fake encoder whose output grows with quality: 100 KB at q=1
  const encode = async (q) => ({ size: Math.round(q * 100_000), q });
  const hit = await core.fitToSize(encode, 40_000);
  assert.equal(hit.reached, true);
  assert.ok(hit.blob.size <= 40_000);
  assert.ok(hit.quality > 0.36, `quality ${hit.quality} should be close to 0.4`);
  const easy = await core.fitToSize(encode, 500_000);
  assert.equal(easy.quality, 0.95);
  const impossible = await core.fitToSize(encode, 1_000);
  assert.equal(impossible.reached, false);
  assert.equal(impossible.quality, 0.05);
});

test('zip: CRC-32 matches the standard check value', () => {
  const enc = new TextEncoder();
  assert.equal(crc32(enc.encode('123456789')), 0xcbf43926);
  assert.equal(crc32(enc.encode('hello')), 0x3610a686);
});

test('zip: archive structure is valid', () => {
  const enc = new TextEncoder();
  const zip = createZip([
    { name: 'a.txt', data: enc.encode('hello'), date: new Date(2026, 10, 10, 12, 30, 10) },
    { name: 'café.jpg', data: new Uint8Array([1, 2, 3]) },
  ]);
  const view = new DataView(zip.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50, 'starts with a local file header');
  assert.equal(view.getUint32(14, true), 0x3610a686, 'stores the CRC');
  const eocd = zip.length - 22;
  assert.equal(view.getUint32(eocd, true), 0x06054b50, 'ends with the end-of-central-directory record');
  assert.equal(view.getUint16(eocd + 10, true), 2, 'two entries');
  const centralOffset = view.getUint32(eocd + 16, true);
  assert.equal(view.getUint32(centralOffset, true), 0x02014b50, 'central directory where the end record says');
  assert.equal(view.getUint16(6, true) & 0x0800, 0x0800, 'names are flagged as UTF-8');
});
