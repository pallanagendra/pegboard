#!/usr/bin/env node
// Makes sure the Cloudflare Pages project exists before the pipeline deploys to it.
// On the very first deploy it creates the project, with "main" as the production branch.
// It also reports the project's public address (e.g. https://pegboard.pages.dev) for later steps.
//
// Needs: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID   Optional: PAGES_PROJECT (default "pegboard")
import { appendFile } from 'node:fs/promises';

const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const name = process.env.PAGES_PROJECT || 'pegboard';
const productionBranch = 'main';
const API = (process.env.CLOUDFLARE_API_BASE || 'https://api.cloudflare.com/client/v4').replace(/\/+$/, '');

const PROJECT_NOT_FOUND = 8000007; // Cloudflare's error code for "no Pages project with this name"

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

if (!token || !account) {
  fail('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set. Add them in GitHub under Settings → Secrets and variables → Actions.');
}

async function call(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API}/accounts/${account}/pages/projects${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    fail(`Could not reach Cloudflare: ${err.message}`);
  }
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function explain(body, status) {
  const errors = body.errors || [];
  const codes = errors.map((e) => e.code);
  const text = errors.map((e) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${status}`;
  if (status === 401 || status === 403 || codes.includes(10000) || codes.includes(9109)) {
    return `Cloudflare rejected the API token (${text}). Check that CLOUDFLARE_API_TOKEN is the full token and that it has the permission Account → Cloudflare Pages → Edit for this account.`;
  }
  if (codes.includes(7003) || codes.includes(7000)) {
    return `Cloudflare doesn't recognise the account (${text}). Check that CLOUDFLARE_ACCOUNT_ID is your Account ID, not a zone ID or email.`;
  }
  return `Cloudflare answered: ${text}`;
}

async function report(project) {
  const url = `https://${project.subdomain || `${name}.pages.dev`}`;
  console.log(`Production address: ${url}`);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `production-url=${url}\n`);
}

const lookup = await call(`/${encodeURIComponent(name)}`);
if (lookup.body.success) {
  console.log(`✔ Pages project "${name}" exists (production branch: ${lookup.body.result.production_branch}).`);
  if (lookup.body.result.production_branch !== productionBranch) {
    console.warn(`::warning::The project's production branch is "${lookup.body.result.production_branch}", but the pipeline deploys production as "${productionBranch}". Change it in Cloudflare: Workers & Pages → ${name} → Settings → Branch control.`);
  }
  await report(lookup.body.result);
  process.exit(0);
}

if (!(lookup.body.errors || []).some((e) => e.code === PROJECT_NOT_FOUND)) {
  fail(explain(lookup.body, lookup.status));
}

console.log(`Pages project "${name}" doesn't exist yet — creating it (production branch: ${productionBranch})…`);
const created = await call('', { method: 'POST', body: JSON.stringify({ name, production_branch: productionBranch }) });
if (!created.body.success) fail(`Could not create the Pages project. ${explain(created.body, created.status)}`);
console.log(`✔ Created Pages project "${name}".`);
await report(created.body.result);
