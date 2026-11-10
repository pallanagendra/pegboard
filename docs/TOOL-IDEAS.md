# Tool ideas and growth roadmap

The five starter tools share three building blocks: **generate-and-download** (barcode, QR), **paste-and-transform** (URL, word counter) and **configure-and-copy** (iframe). The ideas below are ordered so each wave reuses what already exists, and so every new tool links naturally to an old one — that internal linking is how a tool site grows in search.

Every idea runs entirely in the browser, which keeps hosting free and lets you keep the "nothing is uploaded" promise. That promise is a real selling point for anything involving passwords, tokens, images or private text.

Effort: **S** = an evening, **M** = a weekend, **L** = a few weekends.

## Wave 1 — quick wins (next 4–6 weeks)

High search demand, small code, and they reuse the existing patterns.

| Tool | Category | Effort | Why it fits |
|---|---|---|---|
| **Case converter** (UPPER, lower, Title, Sentence, camelCase, snake_case, kebab-case) | Text | S | Same textarea layout as the word counter; link them to each other. |
| **JSON formatter and validator** (pretty print, minify, show the error line) | Web & dev | S | One of the most-searched developer tools; same two-pane layout as the URL decoder. |
| **Base64 encoder/decoder** (text and files → data URI) | Web & dev | S | Natural sibling of the URL decoder. |
| **Password generator** (length, symbols, passphrase mode, strength meter) | Generators | S | Huge demand; `crypto.getRandomValues` makes it genuinely secure, and "generated on your device" is the trust story. |
| **UTM link builder** | Web & dev | S | Marketers build a tagged link, then turn it into a QR code — link it straight into the QR generator. The URL decoder already breaks UTM tags apart. |
| **UUID generator** (v4 and v7, bulk) | Generators | S | Tiny; `crypto.randomUUID()` does the work. |
| **Lorem ipsum generator** | Text | S | Steady traffic from designers; pairs with the word counter. |

## Wave 2 — bigger draws (next quarter)

These take more work but bring repeat visitors.

| Tool | Category | Effort | Why it fits |
|---|---|---|---|
| **Image compressor and resizer** (JPEG/WebP/PNG, batch) | Images *(new category)* | M | Very high demand. Doing it in-browser — no uploads — is the differentiator. Canvas + `toBlob` handles most of it. |
| **Color converter and contrast checker** (HEX/RGB/HSL/OKLCH, WCAG AA/AAA) | Web & dev | M | The QR tool already has a contrast check you can reuse. |
| **Text diff checker** | Text | M | Paste two versions, see what changed. Sticky for writers and developers. |
| **Unix timestamp and time zone converter** | Web & dev | S | `Intl.DateTimeFormat` does the heavy lifting. |
| **Hash generator** (SHA-1/256/512 for text and files) | Web & dev | S | `crypto.subtle.digest`, no library needed. |
| **JWT decoder** | Web & dev | S | Developers don't want to paste tokens into random sites; "decoded locally" is the pitch. |
| **Favicon generator** (from an image, text or emoji → PNG sizes + manifest) | Generators | M | Reuses the PNG export from the barcode and QR tools. |
| **Link preview checker** (title, meta description, Open Graph image as it appears on social and search) | Web & dev | M | Builds on the word counter's limit bars. Needs a fetch proxy because of CORS — a good first use of a Worker script. |

## Wave 3 — upgrades to the tools you have

Often worth more than a new tool, because the page already ranks.

- **QR codes:** logo in the middle (automatically switch to error correction H), batch from a CSV into a ZIP, printable Wi-Fi card for guests, more vCard fields (address, multiple phones).
- **Barcodes:** batch from a list, printable label sheets (PDF, common label sizes), GS1-128 with application identifiers.
- **Word counter:** readability score (Flesch reading ease, grade level), the case converter as a toolbar, "find long sentences".
- **iFrame generator:** presets for Google Maps, Google Forms and Calendly; a "copy as WordPress block" option.
- **URL decoder:** edit query parameters in the table and rebuild the URL; strip tracking parameters in one click.

## Growth playbook

What makes a tool site grow is mostly search traffic plus people coming back. The site already has the foundations (one fast page per tool, unique titles and descriptions, FAQ sections with structured data, a sitemap, internal "related tools" links). Next steps, in order:

1. **Connect Google Search Console and Bing Webmaster Tools** as soon as production has its own domain; submit the sitemap. Check which queries bring people in every few weeks, and write FAQ answers for the questions you see.
2. **Measure without cookies.** Cloudflare's dashboard already shows requests per page for free. For visits and referrers, turn on Cloudflare Web Analytics (cookie-free). It loads a script from Cloudflare, so add `https://static.cloudflareinsights.com` to `script-src` and `https://cloudflareinsights.com` to `connect-src` in the Content-Security-Policy in `scripts/build.mjs`.
3. **Give each tool a share image** (`og:image`, 1200×630) so links look good when shared. Can be generated at build time.
4. **Make it installable** (web app manifest + service worker) so it works offline and can live on a phone's home screen — a big plus for the QR and barcode tools used on shop floors and at events.
5. **Ship one tool or upgrade every week or two** rather than many at once. Each one is a new page that can rank and a reason for people to come back.
6. **Ask for ideas** with a small "Suggest a tool" link (a GitHub issue template or a simple form) — the requests tell you what people actually search for.
7. **Later, if traffic justifies it:** a "Buy me a coffee" link, or one tasteful sponsor slot per page. Avoid heavy ad networks: they'd break the speed and privacy promises that make the site worth using.

## Adding a tool (checklist)

1. `npm run new-tool -- "Tool name" category` — creates the folder as a **draft**.
2. Put pure logic in `logic.js` and test it in `tests/` (look at `tests/tools.test.mjs`).
3. Write `meta.json` like a search result: `title` around 60 characters with the main keyword first, `description` under 155, three or four real FAQ questions.
4. Add `related` links both ways, to and from existing tools.
5. Open a PR to `develop`, check it on dev and on a phone, then remove `"status": "draft"` and release.
