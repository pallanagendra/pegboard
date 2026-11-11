import { createBatch } from '../../assets/js/image-batch.js';
import { planResize, outputName } from '../../assets/js/image-core.js';
import { render, encode, canEncode } from '../../assets/js/image-engine.js';
import { readForm, bindRangeOutputs, bindColorPairs, persistForm } from '../../assets/js/ui.js';

const root = document.querySelector('[data-tool]');
const form = root.querySelector('[data-form]');
const help = form.querySelector('[data-target-help]');
const HEX = /^#[0-9a-f]{6}$/i;

const HELP = {
  'image/jpeg': 'Best for photos. Small files, no transparency.',
  'image/png': 'Best for logos, screenshots and text. Keeps every pixel and transparency; files are larger.',
  'image/webp': 'Best for websites. Usually the smallest, and keeps transparency.',
};

bindRangeOutputs(form);
bindColorPairs(form);
persistForm(form, 'image-converter');

function sync() {
  const o = readForm(form);
  help.textContent = HELP[o.to] || '';
  form.querySelector('[data-quality]').hidden = o.to === 'image/png';
  form.querySelector('[data-background]').hidden = o.to !== 'image/jpeg';
}
form.addEventListener('input', sync);
form.addEventListener('change', sync);
sync();

canEncode('image/webp').then((ok) => {
  if (ok) return;
  const radio = form.querySelector('#cv-webp');
  radio.disabled = true;
  form.querySelector('label[for="cv-webp"]').title = 'This browser can’t save WebP images';
  if (radio.checked) form.querySelector('#cv-jpg').checked = true;
  sync();
});

async function process(item, o) {
  const type = o.to;
  const plan = planResize(item, { mode: 'fit' }); // same size
  const background = HEX.test(o.background) ? o.background : '#ffffff';
  const canvas = render(item.decoded, plan, { background: type === 'image/jpeg' ? background : null });
  const blob = await encode(canvas, type, o.quality / 100);
  let note = '';
  if (item.type === 'image/gif') note = 'If the GIF was animated, only the first frame is kept';
  else if (item.type === 'image/svg+xml') note = `Drawn at ${plan.width} × ${plan.height}. Use the image resizer for a different size`;
  return { blob, width: plan.width, height: plan.height, name: outputName(item.name, type, item.type === type ? '-converted' : ''), note };
}

createBatch({
  root,
  form,
  readOptions: () => readForm(form),
  process,
  zipName: 'converted-images.zip',
  showChange: false, // a format change isn't about saving space
  doneVerb: 'converted',
  sample: { type: 'image/png', transparent: true },
});
