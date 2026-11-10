#!/usr/bin/env node
// Post-build checks that run in CI before anything is deployed:
//  - every page has a <title>, a meta description and exactly one <h1>
//  - every local link, script, stylesheet and image points at a file that exists
//  - no page is larger than it should be
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', process.env.OUT_DIR || 'dist');
const MAX_PAGE_KB = 120;
const problems = [];

if (!existsSync(ROOT)) {
  console.error('✖ No build found. Run `npm run build` first.');
  process.exit(1);
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const files = await walk(ROOT);
const pages = files.filter((f) => f.endsWith('.html'));

for (const page of pages) {
  const rel = path.relative(ROOT, page);
  const html = await readFile(page, 'utf8');
  const size = (await stat(page)).size / 1024;

  if (!/<title>[^<]{5,}<\/title>/.test(html)) problems.push(`${rel}: missing or empty <title>`);
  if (!/<meta name="description" content="[^"]{20,}">/.test(html)) problems.push(`${rel}: missing meta description`);
  const h1s = (html.match(/<h1[\s>]/g) || []).length;
  if (h1s !== 1) problems.push(`${rel}: has ${h1s} <h1> elements (expected 1)`);
  if (/\{\{\w+\}\}/.test(html)) problems.push(`${rel}: contains an unreplaced {{placeholder}}`);
  if (size > MAX_PAGE_KB) problems.push(`${rel}: ${size.toFixed(0)} KB is over the ${MAX_PAGE_KB} KB page budget`);

  const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^(https?:|mailto:|tel:|data:|#|javascript:)/.test(ref)) continue;
    const clean = ref.split('#')[0].split('?')[0];
    if (!clean) continue;
    let target = clean.startsWith('/') ? path.join(ROOT, clean) : path.resolve(path.dirname(page), clean);
    if (clean.endsWith('/')) target = path.join(target, 'index.html');
    if (!existsSync(target)) problems.push(`${rel}: broken link → ${ref}`);
  }
}

for (const required of ['index.html', '404.html', 'robots.txt', '_headers']) {
  if (!existsSync(path.join(ROOT, required))) problems.push(`missing ${required}`);
}

if (problems.length) {
  console.error(`✖ ${problems.length} problem(s) found:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✔ Checked ${pages.length} pages and their links — all good.`);
