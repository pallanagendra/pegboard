// Unit tests for the passport photo maker's specs, crop geometry and checks. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as pp from '../src/tools/passport-photo-maker/logic.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not close to ${b}`);

test('passport: guides keep the head and eyes inside the official ranges', () => {
  for (const doc of Object.values(pp.DOCS)) {
    const g = pp.guides(doc);
    // eye line, measured from the bottom
    assert.ok(1 - g.eyes >= doc.eyes.min && 1 - g.eyes <= doc.eyes.max, `${doc.label}: eye line`);
    // chin on the line and hair anywhere in the band → head size within spec
    for (const hair of [g.hairTop, g.crown, g.hairBottom]) {
      const head = g.chin - hair;
      assert.ok(head >= doc.head.min - 1e-9 && head <= doc.head.max + 1e-9, `${doc.label}: head ${head}`);
    }
    assert.ok(g.hairTop > 0 && g.hairTop < g.crown && g.crown < g.hairBottom && g.hairBottom < g.eyes && g.eyes < g.chin && g.chin < 1);
  }
  assert.equal(pp.docFor('nope'), pp.DOCS['us-passport']);
});

test('passport: the crop is a square that always stays inside the photo', () => {
  const photo = { width: 3000, height: 4000 };
  assert.deepEqual(pp.cropSquare(photo, {}), { sx: 0, sy: 500, size: 3000, zoom: 1, cx: 1500, cy: 2000 });
  // pushed far out of bounds → clamped to the edges
  const corner = pp.cropSquare(photo, { zoom: 2, cx: -500, cy: 99999 });
  assert.deepEqual([corner.sx, corner.sy, corner.size], [0, 2500, 1500]);
  // zoom is limited to 1…max
  assert.equal(pp.cropSquare(photo, { zoom: 0.2 }).zoom, 1);
  assert.equal(pp.maxZoom(photo), 8);
  assert.equal(pp.maxZoom({ width: 900, height: 1200 }), 3);
  assert.equal(pp.maxZoom({ width: 200, height: 200 }), 1);
  assert.equal(pp.cropSquare({ width: 900, height: 1200 }, { zoom: 50 }).size, 300);
  // landscape photos work the same way
  assert.deepEqual(pp.cropSquare({ width: 4000, height: 3000 }, {}), { sx: 500, sy: 0, size: 3000, zoom: 1, cx: 2000, cy: 1500 });
});

test('passport: first view, dragging and zooming', () => {
  const photo = { width: 3000, height: 4000 };
  const first = pp.initialView(photo);
  assert.equal(first.size, 3000);
  assert.equal(first.sy, 150); // nearer the top, where the head is
  assert.equal(pp.initialView({ width: 4000, height: 3000 }).sx, 500);

  // dragging the photo right by a quarter of the frame shows more of its left side
  const zoomed = pp.cropSquare(photo, { zoom: 2, cx: 1500, cy: 2000 });
  const dragged = pp.panBy(photo, zoomed, 0.25, 0);
  assert.equal(dragged.cx, 1500 - 0.25 * 1500);
  assert.equal(pp.panBy(photo, zoomed, 99, 0).sx, 0);

  // zooming keeps the chosen point of the frame over the same spot of the photo
  const start = pp.cropSquare(photo, { zoom: 1.5, cx: 1400, cy: 1800 });
  const fx = 0.3;
  const fy = 0.7;
  const spot = [start.sx + fx * start.size, start.sy + fy * start.size];
  const after = pp.zoomAt(photo, start, 3, fx, fy);
  assert.equal(after.zoom, 3);
  near(after.sx + fx * after.size, spot[0], 1e-6);
  near(after.sy + fy * after.size, spot[1], 1e-6);
  // default is the center
  const centered = pp.zoomAt(photo, start, 2);
  near(centered.cx, start.cx, 1e-6);
});

test('passport: output size follows each document', () => {
  const passport = pp.DOCS['us-passport'].digital;
  const visa = pp.DOCS['us-visa'].digital;
  assert.deepEqual(pp.outputSide(3000, passport), { side: 1200, enlarged: false });
  assert.deepEqual(pp.outputSide(873.6, passport), { side: 873, enlarged: false });
  assert.deepEqual(pp.outputSide(420, passport), { side: 600, enlarged: true });
  assert.deepEqual(pp.outputSide(3000, visa), { side: 600, enlarged: false });
  assert.deepEqual(pp.outputSide(599.8, visa), { side: 600, enlarged: false });

  assert.deepEqual(pp.sizeCheck(40 * 1024, passport), { ok: false, problem: 'small' });
  assert.deepEqual(pp.sizeCheck(300 * 1024, passport), { ok: true, problem: '' });
  assert.deepEqual(pp.sizeCheck(11 * 1024 * 1024, passport), { ok: false, problem: 'large' });
  assert.deepEqual(pp.sizeCheck(40 * 1024, visa), { ok: true, problem: '' });
  assert.deepEqual(pp.sizeCheck(241 * 1024, visa), { ok: false, problem: 'large' });

  assert.equal(pp.fileName('us-passport', 'photo', 'jpg', 1200), 'us-passport-photo-1200x1200.jpg');
  assert.equal(pp.fileName('us-visa', 'sheet', 'jpg'), 'us-visa-photos-4x6-print.jpg');
  assert.equal(pp.fileName('../x', 'photo', 'png', 600), 'us-passport-photo-600x600.png');
});

test('passport: print sheet puts 2 × 2 inch photos on a 4 × 6 inch print', () => {
  const sheet = pp.sheetLayout();
  assert.deepEqual([sheet.width, sheet.height, sheet.side], [1800, 1200, 600]);
  assert.deepEqual(sheet.photos, [{ x: 225, y: 300 }, { x: 975, y: 300 }]);
  // photos never touch each other or the edges
  for (const p of sheet.photos) assert.ok(p.x >= 150 && p.y >= 150 && p.x + 600 <= 1650 && p.y + 600 <= 1050);
  assert.equal(pp.sheetLayout({ count: 1 }).photos[0].x, 600);
  assert.throws(() => pp.sheetLayout({ count: 6 }), /don’t fit/);
});

test('passport: print resolution is written into the JPG header', () => {
  //            SOI         APP0        len         J     F     I     F    \0   ver         units xdens       ydens       thumb
  const jpg = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb];
  const bytes = Uint8Array.from(jpg);
  const out = pp.setJpegDpi(bytes, 300);
  assert.deepEqual([...out.slice(13, 18)], [1, 0x01, 0x2c, 0x01, 0x2c]);
  assert.deepEqual([...out.slice(0, 13)], jpg.slice(0, 13));
  assert.deepEqual([...out.slice(18)], jpg.slice(18));
  assert.equal(bytes[13], 0, 'the original is left alone');
  // not a JFIF file, or a silly value → unchanged
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(pp.setJpegDpi(png, 300), png);
  assert.equal(pp.setJpegDpi(bytes, 0), bytes);
  assert.equal(pp.setJpegDpi(bytes, 70000), bytes);
});

test('passport: background check reads brightness and evenness, without changing anything', () => {
  const fill = (n, fn) => {
    const px = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      const [r, g, b] = fn(i);
      px.set([r, g, b, 255], i * 4);
    }
    return px;
  };
  const white = fill(400, () => [244, 243, 240]);
  assert.deepEqual(pp.backgroundCheck(white, white), { ok: true, light: true, even: true, brightness: 243, spread: 0 });

  const dark = fill(400, () => [70, 80, 110]);
  const res = pp.backgroundCheck(dark, dark);
  assert.equal(res.ok, false);
  assert.equal(res.light, false);
  assert.equal(res.even, true);

  // a patterned wall: light on average but busy
  const busy = fill(400, (i) => (i % 2 ? [255, 255, 255] : [170, 170, 170]));
  assert.deepEqual([pp.backgroundCheck(busy, white).light, pp.backgroundCheck(busy, white).even], [true, false]);

  // a shadow on one side: each corner is smooth, but they differ
  const shaded = fill(400, () => [180, 180, 180]);
  const shadow = pp.backgroundCheck(white, shaded);
  assert.equal(shadow.even, false);
  assert.ok(shadow.spread > 25);

  assert.equal(pp.backgroundCheck(new Uint8ClampedArray(0), new Uint8ClampedArray(0)).ok, false);
});
