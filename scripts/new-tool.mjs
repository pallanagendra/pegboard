#!/usr/bin/env node
// Scaffold a new tool:  npm run new-tool -- "Case converter" text
// Creates src/tools/<slug>/ marked as a draft: it shows on dev and staging, not production,
// until you remove "status": "draft" from its meta.json.
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../site.config.mjs';

const [name, category = Object.keys(config.categories)[0]] = process.argv.slice(2);
if (!name) {
  console.error('Usage: npm run new-tool -- "Tool name" [category]');
  console.error(`Categories: ${Object.keys(config.categories).join(', ')}`);
  process.exit(1);
}
if (!config.categories[category]) {
  console.error(`Unknown category "${category}". Use one of: ${Object.keys(config.categories).join(', ')}`);
  process.exit(1);
}

const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'tools', slug);
if (existsSync(dir)) {
  console.error(`src/tools/${slug} already exists.`);
  process.exit(1);
}
await mkdir(dir, { recursive: true });

const meta = {
  name,
  title: `${name}: free online tool`,
  description: `Describe what ${name.toLowerCase()} does in one sentence under 155 characters. Mention it's free and runs in the browser.`,
  summary: `One line shown on the tool's tag on the home page.`,
  category,
  status: 'draft',
  order: 100,
  keywords: [],
  related: [],
  howTo: ['First step.', 'Second step.'],
  faq: [{ q: 'A question people search for?', a: 'A short, direct answer.' }],
};

await writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
await writeFile(
  path.join(dir, 'body.html'),
  `      <div class="workspace">
        <form class="panel panel--inputs" data-form novalidate>
          <div class="field">
            <label for="${slug}-input">Input</label>
            <textarea class="textarea" id="${slug}-input" name="input"></textarea>
          </div>
        </form>
        <section class="panel workspace__sticky" aria-labelledby="${slug}-out-title">
          <div class="panel__head">
            <h2 class="panel__title" id="${slug}-out-title">Result</h2>
            <button type="button" class="button button--primary button--small" data-copy-from="#${slug}-output">Copy</button>
          </div>
          <pre class="code-out" id="${slug}-output" data-output></pre>
        </section>
      </div>
`,
);
await writeFile(
  path.join(dir, 'logic.js'),
  `// Pure functions for ${name}. Keep browser-only code out of here so tests can import it.
export function transform(input) {
  return String(input ?? '');
}
`,
);
await writeFile(
  path.join(dir, 'tool.js'),
  `import { transform } from './logic.js';
import { readForm, persistForm } from '../../assets/js/ui.js';

const form = document.querySelector('[data-form]');
const output = document.querySelector('[data-output]');
persistForm(form, '${slug}');

function render() {
  const o = readForm(form);
  output.textContent = transform(o.input);
}

form.addEventListener('input', render);
form.addEventListener('submit', (e) => e.preventDefault());
render();
`,
);
await writeFile(path.join(dir, 'icon.svg'), '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12h8M12 8v8"/></svg>\n');

console.log(`✔ Created src/tools/${slug}/ (draft). Next:
  1. Edit meta.json, body.html, logic.js and tool.js
  2. npm run dev  → http://localhost:8080/tools/${slug}/
  3. Add tests in tests/${slug}.test.mjs
  4. Remove "status": "draft" from meta.json when it's ready for production`);
