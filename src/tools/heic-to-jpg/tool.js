import { createBatch } from '../../assets/js/image-batch.js';
import { planResize, OUTPUT_TYPES } from '../../assets/js/image-core.js';
import { render, encode, canEncode } from '../../assets/js/image-engine.js';
import { readForm, bindRangeOutputs, persistForm } from '../../assets/js/ui.js';
import { sizeOptions, burstNote, convertedName } from './logic.js';

const root = document.querySelector('[data-tool]');
const form = root.querySelector('[data-form]');
const help = form.querySelector('[data-target-help]');

const HELP = {
  'image/jpeg': 'Opens everywhere: Windows, Android, email, every website. The best choice for photos.',
  'image/png': 'Keeps every pixel, but files are several times bigger. Use it if you’ll edit the photo further.',
  'image/webp': 'Smaller than JPG for the same quality, and works in all modern browsers.',
};

bindRangeOutputs(form);
persistForm(form, 'heic-to-jpg');

function sync() {
  const o = readForm(form);
  help.textContent = HELP[o.to] || '';
  form.querySelector('[data-quality]').hidden = o.to === 'image/png';
}
form.addEventListener('input', sync);
form.addEventListener('change', sync);
sync();

canEncode('image/webp').then((ok) => {
  if (ok) return;
  const radio = form.querySelector('#hc-webp');
  radio.disabled = true;
  form.querySelector('label[for="hc-webp"]').title = 'This browser can’t save WebP images';
  if (radio.checked) form.querySelector('#hc-jpg').checked = true;
  sync();
});

async function process(item, o) {
  const type = o.to;
  const plan = planResize(item, sizeOptions(o.size));
  // JPG has no transparency; a white backing keeps any see-through edges clean
  const canvas = render(item.decoded, plan, { background: type === 'image/jpeg' ? '#ffffff' : null });
  const blob = await encode(canvas, type, o.quality / 100);
  canvas.width = canvas.height = 0;
  const notes = [burstNote(item.decoded.count || 1)];
  if (plan.width !== item.width) notes.push(`Resized from ${item.width} × ${item.height}`);
  return { blob, width: plan.width, height: plan.height, name: convertedName(item.name, OUTPUT_TYPES[type].ext), note: notes.filter(Boolean).join('. ') };
}

createBatch({
  root,
  form,
  readOptions: () => readForm(form),
  process,
  zipName: 'converted-photos.zip',
  showChange: false,
  doneVerb: 'converted',
  sampleFile: async () => {
    const res = await fetch(new URL('../../assets/samples/sample-photo.heic', import.meta.url));
    if (!res.ok) throw new Error('The sample photo didn’t download.');
    return new File([await res.blob()], 'sample-photo.heic', { type: 'image/heic', lastModified: Date.now() });
  },
});
