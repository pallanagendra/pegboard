#!/usr/bin/env node
/**
 * Zero-dependency static site builder.
 *
 *   src/layout.html          shared page shell (header, footer)
 *   src/pages/*.html         home, about, 404
 *   src/tools/<slug>/        one folder per tool: meta.json, body.html, tool.js (+ optional logic.js)
 *   src/assets/              css, js, fonts, images, vendored libraries (copied as-is)
 *
 * Environment variables:
 *   SITE_ENV       local | dev | staging | production   (default: local)
 *   SITE_URL       public base URL for canonical links and sitemap (optional; falls back to site.config.mjs)
 *   PREVIEW_LINKS  "1" to link to .../index.html, for hosts that don't serve folder indexes
 *   OUT_DIR        output folder (default: dist)
 */
import { readFile, writeFile, mkdir, readdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../site.config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.resolve(ROOT, process.env.OUT_DIR || 'dist');

const ENVIRONMENTS = ['local', 'dev', 'staging', 'production'];
const env = process.env.SITE_ENV || 'local';
if (!ENVIRONMENTS.includes(env)) {
  fail(`SITE_ENV must be one of ${ENVIRONMENTS.join(', ')} — got "${env}"`);
}
const isProd = env === 'production';
const previewLinks = process.env.PREVIEW_LINKS === '1';
const siteUrl = (process.env.SITE_URL || config.urls[env] || '').replace(/\/+$/, '');
const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
const buildSha = process.env.GITHUB_SHA || process.env.BUILD_SHA || 'local';
const buildTime = new Date().toISOString();

// ---------------------------------------------------------------- helpers

function fail(message) {
  console.error(`\n✖ Build failed: ${message}\n`);
  process.exit(1);
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Relative prefix from an output file back to the site root, e.g. "../../". */
function rootFor(outFile) {
  if (outFile === '404.html' && !previewLinks) return '/'; // served at any depth
  const depth = outFile.split('/').length - 1;
  return depth === 0 ? './' : '../'.repeat(depth);
}

/** Link to a site path ("" = home, "tools/x/" = a tool). */
function link(root, target) {
  const t = target && !target.endsWith('/') && !target.includes('.') ? `${target}/` : target;
  if (previewLinks && (t === '' || t.endsWith('/'))) return `${root}${t}index.html`;
  return `${root}${t}` || './';
}

function absoluteUrl(target) {
  return siteUrl ? `${siteUrl}/${target}` : '';
}

function render(template, vars, file) {
  return template
    .replace(/\{\{asset:([^}]+)\}\}/g, (_, p) => `${vars.root}assets/${p}`)
    .replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (!(key in vars)) fail(`Unknown placeholder {{${key}}} in ${file}`);
      return vars[key];
    });
}

function jsonLd(data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">${json}</script>`;
}

async function readText(p) {
  return readFile(p, 'utf8');
}

async function writeOut(rel, content) {
  const dest = path.join(OUT, rel);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, content);
}

// ---------------------------------------------------------------- load tools

async function loadTools() {
  const dir = path.join(SRC, 'tools');
  const slugs = (await readdir(dir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  const tools = [];
  for (const slug of slugs) {
    const folder = path.join(dir, slug);
    const metaPath = path.join(folder, 'meta.json');
    if (!existsSync(metaPath)) fail(`src/tools/${slug} has no meta.json`);
    let meta;
    try {
      meta = JSON.parse(await readText(metaPath));
    } catch (e) {
      fail(`src/tools/${slug}/meta.json is not valid JSON: ${e.message}`);
    }
    for (const field of ['name', 'title', 'description', 'summary', 'category']) {
      if (!meta[field]) fail(`src/tools/${slug}/meta.json is missing "${field}"`);
    }
    if (!config.categories[meta.category]) {
      fail(`src/tools/${slug}: category "${meta.category}" is not listed in site.config.mjs`);
    }
    if (meta.description.length > 160) {
      console.warn(`⚠ ${slug}: description is ${meta.description.length} chars; search engines show about 155.`);
    }
    for (const file of ['body.html', 'tool.js', 'icon.svg']) {
      if (!existsSync(path.join(folder, file))) fail(`src/tools/${slug} is missing ${file}`);
    }
    const draft = meta.status === 'draft';
    if (draft && isProd) {
      console.log(`  skipped draft tool: ${slug}`);
      continue;
    }
    tools.push({
      slug,
      draft,
      order: meta.order ?? 999,
      ...meta,
      icon: (await readText(path.join(folder, 'icon.svg'))).trim(),
      body: await readText(path.join(folder, 'body.html')),
      folder,
    });
  }
  tools.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return tools;
}

// ---------------------------------------------------------------- page parts

function envBanner() {
  if (isProd) return '';
  const labels = { local: 'Local build', dev: 'Development', staging: 'Staging' };
  const short = buildSha.slice(0, 7);
  const build = buildSha === 'local' ? '' : ` Build ${esc(short)}.`;
  return `<div class="env-banner env-banner--${env}" role="note"><div class="wrap"><strong>${labels[env]}</strong> — not the live site.${build}</div></div>`;
}

function tagCard(tool, root, { headingLevel = 'h3' } = {}) {
  const keywords = [tool.name, tool.summary, ...(tool.keywords || [])].join(' ').toLowerCase();
  return `<li class="tag-item" data-category="${esc(tool.category)}" data-search="${esc(keywords)}">
  <a class="tag" href="${link(root, `tools/${tool.slug}/`)}">
    <span class="tag__icon" aria-hidden="true">${tool.icon}</span>
    <${headingLevel} class="tag__name">${esc(tool.name)}</${headingLevel}>
    <span class="tag__summary">${esc(tool.summary)}</span>
    <span class="tag__cat">${esc(config.categories[tool.category])}${tool.draft ? ' <span class="badge">Draft</span>' : ''}</span>
  </a>
</li>`;
}

function footerToolLists(tools, root) {
  return Object.entries(config.categories)
    .map(([key, label]) => {
      const inCat = tools.filter((t) => t.category === key);
      if (!inCat.length) return '';
      const items = inCat.map((t) => `<li><a href="${link(root, `tools/${t.slug}/`)}">${esc(t.name)}</a></li>`).join('');
      return `        <div class="site-footer__col"><p class="site-footer__heading">${esc(label)}</p><ul>${items}</ul></div>`;
    })
    .join('\n');
}

function baseVars(outFile, tools) {
  const root = rootFor(outFile);
  return {
    root,
    home: link(root, ''),
    aboutHref: link(root, 'about/'),
    siteName: esc(config.name),
    tagline: esc(config.tagline),
    owner: esc(config.owner),
    year: String(new Date().getFullYear()),
    version: esc(pkg.version),
    buildSha: esc(buildSha),
    buildShaShort: esc(buildSha.slice(0, 7)),
    buildTime: esc(buildTime),
    envBanner: envBanner(),
    robotsMeta: isProd ? '' : '<meta name="robots" content="noindex, nofollow">',
    footerToolLists: footerToolLists(tools, root),
    scripts: '',
    jsonLd: '',
    bodyClass: '',
  };
}

function seoVars(target) {
  const url = absoluteUrl(target);
  return {
    canonicalTag: isProd && url ? `<link rel="canonical" href="${esc(url)}">` : '',
    ogUrl: url ? `<meta property="og:url" content="${esc(url)}">` : '',
  };
}

// ---------------------------------------------------------------- build

async function build() {
  const started = Date.now();
  console.log(`Building ${config.name} for "${env}"${siteUrl ? ` (${siteUrl})` : ''}…`);

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  await cp(path.join(SRC, 'assets'), path.join(OUT, 'assets'), { recursive: true });

  const layout = await readText(path.join(SRC, 'layout.html'));
  const tools = await loadTools();
  const pages = []; // for sitemap

  // ---- tool pages
  for (const tool of tools) {
    const outFile = `tools/${tool.slug}/index.html`;
    const target = `tools/${tool.slug}/`;
    const vars = { ...baseVars(outFile, tools), ...seoVars(target) };
    const root = vars.root;

    const related = (tool.related || [])
      .map((slug) => tools.find((t) => t.slug === slug))
      .filter(Boolean);

    const howTo = (tool.howTo || []).map((s) => `<li>${s}</li>`).join('');
    const faq = (tool.faq || [])
      .map((f) => `<details class="faq"><summary>${esc(f.q)}</summary><p>${f.a}</p></details>`)
      .join('');

    const toolBody = render(tool.body, { ...vars }, `src/tools/${tool.slug}/body.html`);

    const content = `
    <div class="page-head">
      <div class="wrap">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="${link(root, '')}#tools">All tools</a><span aria-hidden="true">/</span><span>${esc(config.categories[tool.category])}</span></nav>
        <div class="page-head__row">
          <span class="page-head__icon" aria-hidden="true">${tool.icon}</span>
          <div>
            <h1 class="page-head__title">${esc(tool.h1 || tool.name)}${tool.draft ? ' <span class="badge">Draft</span>' : ''}</h1>
            <p class="page-head__lede">${esc(tool.summary)}</p>
          </div>
        </div>
      </div>
    </div>
    <div class="wrap tool" data-tool="${esc(tool.slug)}">
${toolBody}
    </div>
    ${howTo || faq ? `<section class="wrap guide" aria-label="Help">
      <div class="guide__grid">
        ${howTo ? `<div class="guide__col"><h2>How to use it</h2><ol class="steps">${howTo}</ol></div>` : ''}
        ${faq ? `<div class="guide__col"><h2>Questions</h2>${faq}</div>` : ''}
      </div>
    </section>` : ''}
    ${related.length ? `<section class="wrap related"><h2>Related tools</h2><ul class="tag-grid tag-grid--compact">${related.map((t) => tagCard(t, root)).join('')}</ul></section>` : ''}`;

    const vendorScripts = (tool.vendor || [])
      .map((file) => `  <script src="${root}assets/vendor/${file}" defer></script>`)
      .join('\n');

    const ld = [
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: tool.name,
        description: tool.description,
        ...(absoluteUrl(target) ? { url: absoluteUrl(target) } : {}),
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any (runs in the browser)',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
    ];
    if (tool.faq?.length) {
      ld.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: tool.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a.replace(/<[^>]+>/g, '') },
        })),
      });
    }

    const html = render(
      layout,
      {
        ...vars,
        pageTitle: esc(`${tool.title} | ${config.name}`),
        description: esc(tool.description),
        content,
        bodyClass: 'page-tool',
        jsonLd: ld.map(jsonLd).join('\n  '),
        scripts: `${vendorScripts}\n  <script type="module" src="./tool.js"></script>`.trimStart(),
      },
      'src/layout.html',
    );
    await writeOut(outFile, html);

    // copy the tool's scripts (tool.js, logic.js, anything else ending in .js)
    for (const f of await readdir(tool.folder)) {
      if (f.endsWith('.js')) await cp(path.join(tool.folder, f), path.join(OUT, 'tools', tool.slug, f));
    }
    pages.push({ target, priority: '0.8' });
  }

  // ---- home
  {
    const outFile = 'index.html';
    const vars = { ...baseVars(outFile, tools), ...seoVars('') };
    const filters = [['all', 'All'], ...Object.entries(config.categories).filter(([k]) => tools.some((t) => t.category === k))]
      .map(([key, label], i) => `<button type="button" class="chip" data-filter="${esc(key)}" aria-pressed="${i === 0}">${esc(label)}</button>`)
      .join('');
    const pageBody = render(
      await readText(path.join(SRC, 'pages/index.html')),
      {
        ...vars,
        toolGrid: tools.map((t) => tagCard(t, vars.root, { headingLevel: 'h2' })).join('\n'),
        categoryFilters: filters,
        toolCount: String(tools.length),
      },
      'src/pages/index.html',
    );
    const html = render(
      layout,
      {
        ...vars,
        pageTitle: esc(`${config.name}: ${config.tagline.replace(/\.$/, '')}`),
        description: esc(config.description),
        content: pageBody,
        bodyClass: 'page-home',
        jsonLd: jsonLd({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: config.name,
          description: config.description,
          ...(siteUrl ? { url: `${siteUrl}/` } : {}),
        }),
        scripts: `  <script type="module" src="${vars.root}assets/js/home.js"></script>`,
      },
      'src/layout.html',
    );
    await writeOut(outFile, html);
    pages.push({ target: '', priority: '1.0' });
  }

  // ---- simple pages
  for (const [name, outFile, title, description] of [
    ['about', 'about/index.html', `About and privacy | ${config.name}`, `What ${config.name} is, and how it handles your data: it doesn't — every tool runs in your browser.`],
    ['404', '404.html', `Page not found | ${config.name}`, 'This page does not exist.'],
  ]) {
    const vars = { ...baseVars(outFile, tools), ...seoVars(name === 'about' ? 'about/' : '') };
    if (name === '404') {
      vars.canonicalTag = '';
      vars.ogUrl = '';
      vars.robotsMeta = '<meta name="robots" content="noindex">';
    }
    const body = render(
      await readText(path.join(SRC, `pages/${name}.html`)),
      { ...vars, toolGrid: tools.slice(0, 6).map((t) => tagCard(t, vars.root)).join('\n') },
      `src/pages/${name}.html`,
    );
    const html = render(layout, { ...vars, pageTitle: esc(title), description: esc(description), content: body, bodyClass: `page-${name}` }, 'src/layout.html');
    await writeOut(outFile, html);
    if (name === 'about') pages.push({ target: 'about/', priority: '0.3' });
  }

  // ---- robots.txt, sitemap.xml, _headers
  const today = buildTime.slice(0, 10);
  if (isProd && siteUrl) {
    const urls = pages
      .map((p) => `  <url><loc>${esc(absoluteUrl(p.target))}</loc><lastmod>${today}</lastmod><priority>${p.priority}</priority></url>`)
      .join('\n');
    await writeOut('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
    await writeOut('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
  } else {
    await writeOut('robots.txt', `# ${env} build: keep search engines out\nUser-agent: *\nDisallow: /\n`);
  }

  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    'frame-src https:', // the iframe generator previews other sites
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
  await writeOut(
    '_headers',
    `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
${isProd ? '' : '  X-Robots-Tag: noindex, nofollow\n'}
/assets/vendor/*
  Cache-Control: public, max-age=31536000, immutable

/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable
`,
  );

  await writeOut(
    'build-info.json',
    JSON.stringify({ name: config.name, version: pkg.version, env, sha: buildSha, builtAt: buildTime, tools: tools.map((t) => t.slug) }, null, 2) + '\n',
  );

  console.log(`✔ Built ${tools.length} tools + ${pages.length - tools.length} pages into ${path.relative(ROOT, OUT) || OUT} in ${Date.now() - started} ms`);
}

await build();
