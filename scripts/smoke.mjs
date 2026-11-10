#!/usr/bin/env node
// After a deploy: fetch the live site and make sure every page answers 200 with the right build.
// Usage: node scripts/smoke.mjs https://staging.pegboard.pages.dev
import { readFile } from 'node:fs/promises';

const base = (process.argv[2] || '').replace(/\/+$/, '');
if (!base) {
  console.log('No URL given — skipping smoke test.');
  process.exit(0);
}

const info = JSON.parse(await readFile(new URL('../dist/build-info.json', import.meta.url), 'utf8'));
const paths = ['/', '/about/', ...info.tools.map((t) => `/tools/${t}/`)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, attempts = 5) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'cache-control': 'no-cache' } });
      if (res.ok) return res;
      if (i === attempts) return res;
    } catch (err) {
      if (i === attempts) throw err;
    }
    await sleep(2000 * i); // new deployments can take a few seconds to reach every edge
  }
}

let failed = 0;

// 1. the deployed build is the one we just built
const live = await get(`${base}/build-info.json`);
const liveInfo = live?.ok ? await live.json() : null;
if (!liveInfo || liveInfo.sha !== info.sha) {
  console.error(`✖ ${base}/build-info.json shows build ${liveInfo?.sha ?? 'unknown'}, expected ${info.sha}`);
  failed++;
} else {
  console.log(`✔ live build is ${info.sha.slice(0, 7)} (${info.env})`);
}

// 2. every page loads
for (const p of paths) {
  const res = await get(base + p);
  const body = res?.ok ? await res.text() : '';
  if (!res?.ok || !body.includes('<title>')) {
    console.error(`✖ ${p} → ${res?.status ?? 'no response'}`);
    failed++;
  } else {
    console.log(`✔ ${p}`);
  }
}

// 3. missing pages return 404
const missing = await get(`${base}/this-page-does-not-exist/`, 1);
if (missing?.status !== 404) {
  console.error(`✖ unknown page returned ${missing?.status}, expected 404`);
  failed++;
} else {
  console.log('✔ unknown pages return 404');
}

if (failed) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nSmoke test passed.');
