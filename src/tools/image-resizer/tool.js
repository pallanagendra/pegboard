import { createBatch } from '../../assets/js/image-batch.js';
import { planResize, outputType, outputName } from '../../assets/js/image-core.js';
import { render, encode, canEncode } from '../../assets/js/image-engine.js';
import { PRESETS, presetMatches } from './logic.js';
import { readForm, bindRangeOutputs, bindColorPairs, persistForm } from '../../assets/js/ui.js';

const root = document.querySelector('[data-tool]');
const form = root.querySelector('[data-form]');
const presetSelect = form.querySelector('[data-presets]');
const HEX = /^#[0-9a-f]{6}$/i;

presetSelect.innerHTML = PRESETS.map((p) => `<option value="${p.id}">${p.label}</option>`).join('');
presetSelect.value = 'web';

bindRangeOutputs(form);
bindColorPairs(form);
persistForm(form, 'image-resizer');

// choosing a common size fills in the fields; editing them by hand switches back to "Custom"
presetSelect.addEventListener('change', () => {
  const p = PRESETS.find((x) => x.id === presetSelect.value);
  if (!p?.width) return;
  form.width.value = p.width;
  form.height.value = p.height || '';
  form.fit.value = p.fit;
});
for (const name of ['width', 'height', 'fit']) {
  form[name].addEventListener('input', () => {
    const o = readForm(form);
    if (!presetMatches(o.preset, o)) presetSelect.value = 'custom';
  });
}

function sync() {
  const o = readForm(form);
  form.querySelectorAll('[data-by]').forEach((el) => { el.hidden = el.dataset.by !== o.by; });
  form.querySelector('[data-quality]').hidden = o.format === 'image/png';
  form.querySelector('[data-background]').hidden = !(o.format === 'image/jpeg' || (o.by === 'size' && o.fit === 'contain'));
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
  const plan =
    o.by === 'percent'
      ? planResize(item, { mode: 'percent', percent: o.percent })
      : planResize(item, { mode: o.fit, width: o.width, height: o.height, noEnlarge: o.noEnlarge });
  const type = outputType(item.type, o.format);
  const background = HEX.test(o.background) ? o.background : '#ffffff';
  const hasBorders = plan.dw < plan.width || plan.dh < plan.height;
  const canvas = render(item.decoded, plan, { background: type === 'image/jpeg' || hasBorders ? background : null });
  const blob = await encode(canvas, type, o.quality / 100);

  let note = '';
  if (plan.width > item.width || plan.height > item.height) note = 'Enlarged, so it may look soft';
  else if (o.by === 'size' && o.fit === 'fit' && o.noEnlarge && plan.width === item.width && (Number(o.width) > item.width || Number(o.height) > item.height)) {
    note = 'Already smaller than that, so the size is kept';
  }
  return { blob, width: plan.width, height: plan.height, name: outputName(item.name, type, `-${plan.width}x${plan.height}`), note };
}

createBatch({
  root,
  form,
  readOptions: () => readForm(form),
  process,
  zipName: 'resized-images.zip',
  sample: { type: 'image/jpeg', quality: 0.92 },
});
