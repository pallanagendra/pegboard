import { createBatch } from '../../assets/js/image-batch.js';
import { planResize, outputType, outputName, fitToSize, formatBytes } from '../../assets/js/image-core.js';
import { render, encode, canEncode } from '../../assets/js/image-engine.js';
import { readForm, bindRangeOutputs, bindColorPairs, persistForm } from '../../assets/js/ui.js';

const root = document.querySelector('[data-tool]');
const form = root.querySelector('[data-form]');
const HEX = /^#[0-9a-f]{6}$/i;

bindRangeOutputs(form);
bindColorPairs(form);
persistForm(form, 'image-compressor');

function sync() {
  const o = readForm(form);
  form.querySelectorAll('[data-method]').forEach((el) => { el.hidden = el.dataset.method !== o.method; });
  form.querySelector('[data-limit-size]').hidden = !o.limit;
  form.querySelector('[data-background]').hidden = o.format !== 'image/jpeg';
}
form.addEventListener('input', sync);
form.addEventListener('change', sync);
sync();

canEncode('image/webp').then((ok) => {
  if (ok) return;
  const opt = form.querySelector('[data-formats] option[value="image/webp"]');
  opt.disabled = true;
  opt.textContent = 'WebP (not supported in this browser)';
  if (form.format.value === 'image/webp') form.format.value = 'same';
});

async function process(item, o) {
  const plan = o.limit
    ? planResize(item, { mode: 'fit', width: o.maxSide, height: o.maxSide, noEnlarge: true })
    : planResize(item, { mode: 'fit' });
  // "same" keeps JPG, PNG and WebP; GIF, AVIF and others become WebP
  const type = outputType(item.type, o.format, 'image/webp');
  const background = HEX.test(o.background) ? o.background : '#ffffff';
  const canvas = render(item.decoded, plan, { background: type === 'image/jpeg' ? background : null });
  const name = outputName(item.name, type, '-compressed');

  let blob;
  let note = '';
  if (type === 'image/png') {
    blob = await encode(canvas, type);
    note = 'PNG is lossless. Save as WebP or JPG for a much smaller file';
  } else if (o.method === 'target') {
    const target = Math.max(5, Number(o.targetKB) || 200) * 1024;
    const result = await fitToSize((q) => encode(canvas, type, q), target);
    blob = result.blob;
    note = result.reached
      ? `Quality ${Math.round(result.quality * 100)}%`
      : `Still over ${formatBytes(target)} at the lowest quality. Turn on “Also shrink big images”`;
  } else {
    blob = await encode(canvas, type, o.quality / 100);
  }

  // Never hand back something bigger than what came in, unless the size or format changed.
  const unchangedShape = plan.width === item.width && plan.height === item.height && type === item.type;
  if (unchangedShape && blob.size >= item.size) {
    const why = type === 'image/png'
      ? 'PNG is lossless, so the original is kept. Save as WebP or JPG for a much smaller file'
      : 'Already well compressed, so the original is kept';
    return { blob: item.file, width: item.width, height: item.height, name, note: why };
  }
  return { blob, width: plan.width, height: plan.height, name, note };
}

createBatch({
  root,
  form,
  readOptions: () => readForm(form),
  process,
  zipName: 'compressed-images.zip',
  sample: { type: 'image/jpeg', quality: 0.98 },
});
