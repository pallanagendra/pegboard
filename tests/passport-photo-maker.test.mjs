// Unit tests for the passport photo maker's specs, crop geometry and checks. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as pp from '../src/tools/passport-photo-maker/logic.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not close to ${b}`);

test('passport: guides keep the head and eyes inside the official ranges', () => {
  for (const doc of Object.values(pp.DOCS)) {
    const g = pp.guides(doc);
    // eye line, measured from the bottom
    if (doc.eyes) assert.ok(1 - g.eyes >= doc.eyes.min && 1 - g.eyes <= doc.eyes.max, `${doc.label}: eye line`);
    else near(g.crown, doc.crownGap, 1e-12);
    // chin on the line and hair anywhere in the band → head size within spec
    for (const hair of [g.hairTop, g.crown, g.hairBottom]) {
      const head = g.chin - hair;
      assert.ok(head >= doc.head.min - 1e-9 && head <= doc.head.max + 1e-9, `${doc.label}: head ${head}`);
    }
    assert.ok(g.hairTop > 0 && g.hairTop < g.crown && g.crown < g.hairBottom && g.hairBottom < g.eyes && g.eyes < g.chin && g.chin < 1);
  }
  assert.equal(pp.docFor('nope'), pp.DOCS['us-passport']);
});

test('passport: every document has a complete, sensible spec', () => {
  assert.deepEqual(Object.keys(pp.DOCS), ['us-passport', 'us-visa', 'in-passport', 'uk-passport', 'au-passport', 'schengen-visa']);
  for (const [id, doc] of Object.entries(pp.DOCS)) {
    for (const field of ['label', 'help', 'background', 'glasses', 'recent']) assert.ok(doc[field], `${id}: ${field}`);
    assert.ok(doc.head.min > 0.4 && doc.head.min < doc.head.max && doc.head.max < 0.9, `${id}: head range`);
    assert.ok(doc.eyes || doc.crownGap > 0, `${id}: needs an eye line or a gap above the head`);
    assert.ok(['hair', 'head'].includes(doc.topOf), `${id}: topOf`);
    assert.ok(doc.file.minWidth >= 600 && doc.file.minWidth <= doc.file.maxWidth, `${id}: file widths`);
    // the printed shape matches the photo's shape
    if (doc.print) near(doc.print.inches[0] / doc.print.inches[1], pp.aspect(doc), 1e-9);
    // a document for upload says how big the file may be
    if (doc.file.upload) assert.ok(doc.file.maxBytes > 0, `${id}: upload limit`);
  }
  // 35 × 45 mm is 7:9, and so is India's 630 × 810 pixels
  near(pp.aspect(pp.DOCS['uk-passport']), 35 / 45, 1e-12);
  near(pp.aspect(pp.DOCS['in-passport']), 630 / 810, 1e-12);
  // UK head: 29 to 34 mm of 45
  near(pp.DOCS['uk-passport'].head.min * 45, 29, 1e-9);
  near(pp.DOCS['au-passport'].head.max * 45, 36, 1e-9);
});

test('passport: the crop always stays inside the photo', () => {
  const photo = { width: 3000, height: 4000 };
  assert.deepEqual(pp.cropRect(photo, {}), { sx: 0, sy: 500, sw: 3000, sh: 3000, zoom: 1, cx: 1500, cy: 2000 });
  // pushed far out of bounds → clamped to the edges
  const corner = pp.cropRect(photo, { zoom: 2, cx: -500, cy: 99999 });
  assert.deepEqual([corner.sx, corner.sy, corner.sw, corner.sh], [0, 2500, 1500, 1500]);
  // zoom is limited to 1…max
  assert.equal(pp.cropRect(photo, { zoom: 0.2 }).zoom, 1);
  assert.equal(pp.maxZoom(photo), 8);
  assert.equal(pp.maxZoom({ width: 900, height: 1200 }), 3);
  assert.equal(pp.maxZoom({ width: 200, height: 200 }), 1);
  assert.equal(pp.cropRect({ width: 900, height: 1200 }, { zoom: 50 }).sw, 300);
  // landscape photos work the same way
  assert.deepEqual(pp.cropRect({ width: 4000, height: 3000 }, {}), { sx: 500, sy: 0, sw: 3000, sh: 3000, zoom: 1, cx: 2000, cy: 1500 });

  // portrait formats (35 × 45 mm): limited by the width of a tall photo, by the height of a wide one
  const r = 7 / 9;
  const tall = pp.cropRect(photo, {}, r);
  near(tall.sw, 3000, 1e-9);
  near(tall.sh, 3000 / r, 1e-9);
  near(tall.sw / tall.sh, r, 1e-12);
  const wide = pp.cropRect({ width: 4000, height: 1800 }, {}, r);
  near(wide.sh, 1800, 1e-9);
  near(wide.sw, 1400, 1e-9);
  near(wide.sx, 1300, 1e-9);
  assert.equal(pp.maxZoom({ width: 4000, height: 1800 }, r), 1400 / 300);
  const pushed = pp.cropRect(photo, { zoom: 2, cx: 99999, cy: -5 }, r);
  near(pushed.sx + pushed.sw, 3000, 1e-9);
  assert.equal(pushed.sy, 0);
});

test('passport: first view, dragging and zooming', () => {
  const photo = { width: 3000, height: 4000 };
  const first = pp.initialView(photo);
  assert.equal(first.sw, 3000);
  assert.equal(first.sy, 150); // nearer the top, where the head is
  assert.equal(pp.initialView({ width: 4000, height: 3000 }).sx, 500);
  near(pp.initialView(photo, 7 / 9).sy, (4000 - 3000 * 9 / 7) * 0.15, 1e-9);

  // dragging the photo right by a quarter of the frame shows more of its left side
  const zoomed = pp.cropRect(photo, { zoom: 2, cx: 1500, cy: 2000 });
  const dragged = pp.panBy(photo, zoomed, 0.25, 0);
  assert.equal(dragged.cx, 1500 - 0.25 * 1500);
  assert.equal(pp.panBy(photo, zoomed, 99, 0).sx, 0);
  // in a portrait frame, a vertical drag moves by a share of the frame's height
  const z2 = pp.cropRect(photo, { zoom: 2, cx: 1500, cy: 2000 }, 7 / 9);
  near(pp.panBy(photo, z2, 0, 0.1, 7 / 9).cy, 2000 - 0.1 * z2.sh, 1e-9);

  // zooming keeps the chosen point of the frame over the same spot of the photo
  for (const r of [1, 7 / 9]) {
    const start = pp.cropRect(photo, { zoom: 1.5, cx: 1400, cy: 1800 }, r);
    const fx = 0.3;
    const fy = 0.7;
    const spot = [start.sx + fx * start.sw, start.sy + fy * start.sh];
    const after = pp.zoomAt(photo, start, 3, fx, fy, r);
    assert.equal(after.zoom, 3);
    near(after.sx + fx * after.sw, spot[0], 1e-6);
    near(after.sy + fy * after.sh, spot[1], 1e-6);
  }
  // default is the center
  const start = pp.cropRect(photo, { zoom: 1.5, cx: 1400, cy: 1800 });
  near(pp.zoomAt(photo, start, 2).cx, start.cx, 1e-6);
});

test('passport: output size follows each document', () => {
  const passport = pp.DOCS['us-passport'];
  const visa = pp.DOCS['us-visa'];
  assert.deepEqual(pp.outputSize(3000, passport), { width: 1200, height: 1200, enlarged: false });
  assert.deepEqual(pp.outputSize(873.6, passport), { width: 873, height: 873, enlarged: false });
  assert.deepEqual(pp.outputSize(420, passport), { width: 600, height: 600, enlarged: true });
  assert.deepEqual(pp.outputSize(3000, visa), { width: 600, height: 600, enlarged: false });
  assert.deepEqual(pp.outputSize(599.8, visa), { width: 600, height: 600, enlarged: false });
  // India wants exactly 630 × 810; the 35 × 45 mm prints are saved at 600 dpi
  assert.deepEqual(pp.outputSize(3000, pp.DOCS['in-passport']), { width: 630, height: 810, enlarged: false });
  assert.deepEqual(pp.outputSize(500, pp.DOCS['in-passport']), { width: 630, height: 810, enlarged: true });
  assert.deepEqual(pp.outputSize(3000, pp.DOCS['uk-passport']), { width: 827, height: 1063, enlarged: false });

  assert.equal(pp.printDpi(1200, passport), 600);
  assert.equal(pp.printDpi(600, visa), 300);
  assert.equal(pp.printDpi(827, pp.DOCS['schengen-visa']), 600);
  assert.equal(pp.printDpi(630, pp.DOCS['in-passport']), 0);

  assert.deepEqual(pp.sizeCheck(40 * 1024, passport.file), { ok: false, problem: 'small' });
  assert.deepEqual(pp.sizeCheck(300 * 1024, passport.file), { ok: true, problem: '' });
  assert.deepEqual(pp.sizeCheck(11 * 1024 * 1024, passport.file), { ok: false, problem: 'large' });
  assert.deepEqual(pp.sizeCheck(40 * 1024, visa.file), { ok: true, problem: '' });
  assert.deepEqual(pp.sizeCheck(241 * 1024, visa.file), { ok: false, problem: 'large' });
  assert.deepEqual(pp.sizeCheck(251 * 1024, pp.DOCS['in-passport'].file), { ok: false, problem: 'large' });
  assert.deepEqual(pp.sizeCheck(5 * 1024 * 1024, pp.DOCS['uk-passport'].file), { ok: true, problem: '' });

  assert.equal(pp.fileName('us-passport', 'photo', 'jpg', 1200, 1200), 'us-passport-photo-1200x1200.jpg');
  assert.equal(pp.fileName('uk-passport', 'photo', 'jpg', 827, 1063), 'uk-passport-photo-827x1063.jpg');
  assert.equal(pp.fileName('us-visa', 'sheet', 'jpg'), 'us-visa-photos-4x6-print.jpg');
  assert.equal(pp.fileName('../x', 'photo', 'png', 600, 600), 'us-passport-photo-600x600.png');
});

test('passport: print sheets fit a 4 × 6 inch print with room to trim', () => {
  const sheet = pp.sheetLayout();
  assert.deepEqual([sheet.width, sheet.height, sheet.w, sheet.h], [1800, 1200, 600, 600]);
  assert.deepEqual(sheet.photos, [{ x: 225, y: 300 }, { x: 975, y: 300 }]);
  assert.equal(pp.sheetLayout({ count: 1 }).photos[0].x, 600);
  assert.throws(() => pp.sheetLayout({ count: 3 }), /don’t fit/);

  // every printed document: right size, inside the margins, not touching
  for (const [id, doc] of Object.entries(pp.DOCS)) {
    if (!doc.print) continue;
    const s = pp.sheetLayout({ photo: doc.print.inches, count: doc.print.count });
    assert.equal(s.photos.length, doc.print.count, id);
    near(s.w / 300, doc.print.inches[0], 0.002);
    near(s.h / 300, doc.print.inches[1], 0.002);
    s.photos.forEach((p, i) => {
      assert.ok(p.x >= 75 && p.y >= 75 && p.x + s.w <= 1725 && p.y + s.h <= 1125, `${id}: photo ${i} inside the margins`);
      if (i) assert.ok(p.x - (s.photos[i - 1].x + s.w) >= 100, `${id}: gap between photos`);
    });
  }
  // 35 × 45 mm at 300 dpi
  const uk = pp.sheetLayout({ photo: pp.DOCS['uk-passport'].print.inches, count: 3 });
  assert.deepEqual([uk.w, uk.h], [413, 531]);
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
