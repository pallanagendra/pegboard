#!/usr/bin/env node
// Tiny static server for local development: `npm run dev`, then open http://localhost:8080
// Serves dist/ with folder indexes and the 404 page, like the real host does.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', process.env.OUT_DIR || 'dist');
const PORT = Number(process.env.PORT || 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

// Apply dist/_headers the way Cloudflare does, so security headers (like the CSP) are tested locally too.
async function loadHeaderRules() {
  const text = await readFile(path.join(ROOT, '_headers'), 'utf8').catch(() => '');
  const rules = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) rules.push({ pattern: line.trim(), headers: {} });
    else if (rules.length) {
      const i = line.indexOf(':');
      rules.at(-1).headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return rules;
}

function headersFor(rules, urlPath) {
  const out = {};
  for (const r of rules) {
    const match = r.pattern.endsWith('*') ? urlPath.startsWith(r.pattern.slice(0, -1)) : urlPath === r.pattern;
    if (match) Object.assign(out, r.headers);
  }
  return out;
}

async function resolve(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const file = path.normalize(path.join(ROOT, clean));
  if (!file.startsWith(ROOT)) return null; // no escaping the folder
  try {
    const s = await stat(file);
    if (s.isDirectory()) {
      if (!clean.endsWith('/')) return { redirect: `${clean}/` };
      return { file: path.join(file, 'index.html') };
    }
    return { file };
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const extra = headersFor(await loadHeaderRules(), req.url.split('?')[0]);
  for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
  const found = await resolve(req.url);
  if (found?.redirect) {
    res.writeHead(301, { Location: found.redirect });
    return res.end();
  }
  try {
    if (!found) throw new Error('not found');
    const body = await readFile(found.file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(found.file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    const body = await readFile(path.join(ROOT, '404.html')).catch(() => 'Not found');
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(body);
  }
}).listen(PORT, () => {
  console.log(`Serving ${path.relative(process.cwd(), ROOT) || '.'} at http://localhost:${PORT}  (Ctrl+C to stop)`);
});
