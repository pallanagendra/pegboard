# Pegboard

Small web tools that do one job well: 24 of them, live at https://tools.nexwavesolutions.net. Every tool runs in the browser — nothing typed or opened on the site is uploaded.

| Tool | Category | Path |
|---|---|---|
| Barcode generator | Generators | `/tools/barcode-generator/` |
| QR code generator | Generators | `/tools/qr-code-generator/` |
| Password generator | Generators | `/tools/password-generator/` |
| Image resizer | Images and files | `/tools/image-resizer/` |
| Image compressor | Images and files | `/tools/image-compressor/` |
| Image converter | Images and files | `/tools/image-converter/` |
| Percentage calculator | Calculators | `/tools/percentage-calculator/` |
| Loan calculator | Calculators | `/tools/loan-calculator/` |
| Age calculator | Calculators | `/tools/age-calculator/` |
| Time calculator | Calculators | `/tools/time-calculator/` |
| Days between dates | Calculators | `/tools/days-between-dates/` |
| Flip a coin | Everyday | `/tools/flip-a-coin/` |
| Random number generator | Everyday | `/tools/random-number-generator/` |
| Dice roller | Everyday | `/tools/dice-roller/` |
| Stopwatch and timer | Everyday | `/tools/stopwatch/` |
| Spin the wheel | Everyday | `/tools/spin-the-wheel/` |
| Typing speed test | Everyday | `/tools/typing-test/` |
| Word and character counter | Text | `/tools/word-counter/` |
| Case converter | Text | `/tools/case-converter/` |
| iFrame embed code generator | Web & developer | `/tools/iframe-generator/` |
| URL encoder and decoder | Web & developer | `/tools/url-encoder-decoder/` |
| JSON formatter | Web & developer | `/tools/json-formatter/` |
| Base64 encoder and decoder | Web & developer | `/tools/base64-encoder-decoder/` |
| Color picker | Web & developer | `/tools/color-picker/` |

**New here?** Follow [docs/SETUP-GUIDE.md](docs/SETUP-GUIDE.md) to put this on GitHub, connect the pipeline and go live. Ideas for what to build next are in [docs/TOOL-IDEAS.md](docs/TOOL-IDEAS.md).

## Run it locally

Needs Node.js 20 or newer. No `npm install` — there are no dependencies.

```bash
npm run dev       # build and serve at http://localhost:8080
npm run verify    # build, check every page and link, run unit tests (what CI runs)
npm run new-tool -- "Case converter" text   # scaffold a new tool as a draft
```

## How it's built

Plain HTML, CSS and JavaScript, assembled by one small build script — no framework to keep up to date.

```
site.config.mjs          site name, URLs per environment, categories
src/layout.html          shared header and footer
src/pages/               home, about, 404
src/tools/<slug>/
  meta.json              name, SEO title and description, FAQ, related tools, draft flag
  body.html              the tool's form and output
  logic.js               pure functions (unit tested)
  tool.js                wires logic.js to the page
  icon.svg
src/assets/              css, shared js, fonts, vendored libraries
scripts/build.mjs        builds dist/ for an environment (SITE_ENV=dev|staging|production)
scripts/check.mjs        fails the build on missing titles, broken links, oversized pages
scripts/smoke.mjs        after deploy: checks every live page serves this exact commit
scripts/pages-project.mjs  creates the Cloudflare Pages project on the first deploy
tests/                   node --test unit tests
.github/workflows/       CI, deploy pipeline, manual redeploy/rollback
```

What changes per environment:

| | local / dev / staging | production |
|---|---|---|
| Striped "not the live site" banner | yes | no |
| Search engines | blocked (`noindex`, `robots.txt`, `X-Robots-Tag`) | allowed, `sitemap.xml` generated |
| Draft tools (`"status": "draft"`) | shown with a badge | left out |
| Canonical URLs | — | from `SITE_URL` |

## The pipeline

Hosting is one Cloudflare Pages project, `pegboard`. Dev and staging are its preview branches (`dev.pegboard.pages.dev`, `staging.pegboard.pages.dev`); production is its `main` branch (`pegboard.pages.dev`, plus your custom subdomain via a CNAME record at your DNS provider).

```
feature/* ──PR──▶ develop ──▶ CI ──▶ dev
                     └──PR──▶ main ──▶ CI ──▶ staging ──approve──▶ production
```

- `ci.yml` — build, page/link checks and unit tests on every pull request
- `deploy.yml` — on push to `develop` or `main`, runs CI then deploys; production waits for approval
- `deploy-env.yml` — reusable: build for one environment, `wrangler pages deploy` to Cloudflare Pages, smoke test
- `redeploy.yml` — manual deploy of any branch or tag to any environment (also how you roll back)

## Security headers

Every response carries a strict Content-Security-Policy (no third-party scripts, styles or fonts), `nosniff`, a referrer policy and a permissions policy, generated into `dist/_headers` by the build. Libraries are vendored in `src/assets/vendor/` — see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
