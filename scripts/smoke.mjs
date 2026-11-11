#!/usr/bin/env node
// After a deploy: fetch the live site and make sure every page answers 200 with the right build.
// Usage: node scripts/smoke.mjs https://staging.pegboard.pages.dev
//
// A brand-new Pages project needs a few minutes before addresses like dev.<project>.pages.dev
// get their HTTPS certificate, so the first check keeps retrying for up to SMOKE_WAIT_SECONDS
// (default 600 = 10 minutes). Once the site answers, every page is checked.
import { readFile } from 'node:fs/promises';

const base = (process.argv[2] || '').replace(/\/+$/, '');
if (!base) {
  console.log('No URL given — skipping smoke test.');
  process.exit(0);
}

const waitSeconds = Number(process.env.SMOKE_WAIT_SECONDS || 600);
const info = JSON.parse(await readFile(new URL('../dist/build-info.json', import.meta.url), 'utf8'));
const paths = ['/', '/about/', ...info.tools.map((t) => `/tools/${t}/`)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (sha) => (sha ? String(sha).slice(0, 7) : 'unknown');

/** One request; never throws. Returns { res } or { error: 'readable reason' }. */
async function fetchOnce(url) {
  try {
    return { res: await fetch(url, { redirect: 'follow', headers: { 'cache-control': 'no-cache' } }) };
  } catch (err) {
    const c = err?.cause;
    return { error: c?.code || c?.reason || c?.message || err?.message || String(err) };
  }
}

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

// ---- 1. wait until the address answers with the build we just deployed
console.log(`Smoke testing ${base} — expecting build ${short(info.sha)} (${info.env})`);
const deadline = Date.now() + waitSeconds * 1000;
let attempt = 0;
let last = '';
for (;;) {
  attempt++;
  const { res, error } = await fetchOnce(`${base}/build-info.json`);
  if (res?.ok) {
    const live = await res.json().catch(() => null);
    if (live?.sha === info.sha) break;
    last = `still serving build ${short(live?.sha)}`;
  } else {
    last = error || `HTTP ${res.status}`;
  }

  if (Date.now() >= deadline) {
    const tls = /ssl|tls|cert|handshake|EPROTO/i.test(last);
    fail(
      tls
        ? `${base} has no working HTTPS certificate yet (${last}). On a brand-new Pages project Cloudflare needs a few minutes to issue it for the dev and staging addresses. The files are deployed — wait 10 minutes and click "Re-run failed jobs".`
        : `${base} didn't serve build ${short(info.sha)} within ${waitSeconds >= 60 ? `${Math.round(waitSeconds / 60)} minutes` : `${waitSeconds} seconds`} (last result: ${last}). Check that SITE_URL, if set, points at this environment.`,
    );
  }
  const delay = Math.min(30, 5 * attempt);
  console.log(`  not ready yet (${last}) — trying again in ${delay}s`);
  await sleep(delay * 1000);
}
console.log(`✔ live build is ${short(info.sha)} (${info.env})`);

// ---- 2. every page loads
async function get(url, attempts = 3) {
  let result;
  for (let i = 1; i <= attempts; i++) {
    result = await fetchOnce(url);
    if (result.res?.ok) return result;
    if (i < attempts) await sleep(2000 * i);
  }
  return result;
}

let failed = 0;
for (const p of paths) {
  const { res, error } = await get(base + p);
  const body = res?.ok ? await res.text() : '';
  if (!res?.ok || !body.includes('<title>')) {
    console.error(`✖ ${p} → ${error || res?.status}`);
    failed++;
  } else {
    console.log(`✔ ${p}`);
  }
}

// ---- 3. missing pages return 404
const missing = await fetchOnce(`${base}/this-page-does-not-exist/`);
if (missing.res?.status !== 404) {
  console.error(`✖ unknown page returned ${missing.error || missing.res?.status}, expected 404`);
  failed++;
} else {
  console.log('✔ unknown pages return 404');
}

if (failed) fail(`${failed} check(s) failed.`);
console.log('\nSmoke test passed.');
