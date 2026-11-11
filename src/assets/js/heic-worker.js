// Decodes HEIC/HEIF photos off the main thread, so the page stays responsive.
// Classic worker: loads libheif (LGPL-3.0, unmodified, see ../vendor/libheif-1.23.5/LICENSE.txt).
/* global libheif */

const VENDOR = new URL('../vendor/libheif-1.23.5/', self.location.href);
importScripts(new URL('libheif.js', VENDOR).href);

let ready = null;
function init() {
  ready ||= fetch(new URL('libheif.wasm', VENDOR))
    .then((r) => {
      if (!r.ok) throw new Error('The HEIC decoder didn’t download. Check your connection and try again.');
      return r.arrayBuffer();
    })
    .then((wasmBinary) => libheif({ wasmBinary }))
    .catch((err) => {
      ready = null;
      throw err;
    });
  return ready;
}

let decoder = null;

self.onmessage = async (e) => {
  const { id, buffer } = e.data;
  try {
    const lib = await init();
    decoder ||= new lib.HeifDecoder();
    const images = decoder.decode(new Uint8Array(buffer));
    if (!images || !images.length) throw new Error('No photo was found in this file. It may be damaged, or not really a HEIC file.');
    const image = images.find((i) => i.is_primary?.()) || images[0];
    const width = image.get_width();
    const height = image.get_height();
    if (!width || !height) throw new Error('This photo has no size, so it can’t be converted.');
    const data = new Uint8ClampedArray(width * height * 4);
    await new Promise((resolve, reject) => {
      image.display({ data, width, height }, (out) => (out ? resolve() : reject(new Error('The photo inside this HEIC file couldn’t be decoded.'))));
    });
    const count = images.length;
    const alpha = !!image.has_alpha_channel?.();
    images.forEach((i) => i.free?.());
    self.postMessage({ id, width, height, data, count, alpha }, [data.buffer]);
  } catch (err) {
    self.postMessage({ id, error: err?.message || String(err) });
  }
};
