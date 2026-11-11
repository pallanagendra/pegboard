# Tool ideas and growth roadmap

Every tool here runs entirely in the browser. That keeps hosting free and keeps the promise that nothing is uploaded — a real selling point for files, passwords and private text, where many of the big sites send your data to their servers.

Effort: **S** = an evening, **M** = a weekend.

## Build status (November 2026)

26 tools on tools.nexwavesolutions.net. Since release 0.3.0 the home page lists them by US monthly searches (most searched first), and the categories are ordered by their combined demand: Everyday, Calculators, Generators, Text, Images and PDF, Web & developer. To place a new tool, set `order` in its `meta.json` between its neighbours by demand (the numbers go up in tens).

| Release | Tools |
|---|---|
| 0.1.0 | Word counter, QR code generator, barcode generator, iFrame embed code generator, URL encoder and decoder |
| 0.2.0 | Image resizer, compressor and converter; percentage, loan, age and time calculators, days between dates; flip a coin, random numbers, dice, stopwatch and timer, spin the wheel, typing test; password generator, case converter, JSON formatter, Base64, color picker |
| 0.3.0 | HEIC to JPG (and HEIC support in every image tool), Merge PDF (photos become pages too) |

Still to build: margin calculator, salary to hourly, meta description checker. Natural next steps from 0.3.0: JPG to PDF and split PDF as their own pages, reusing the Merge PDF code.

## Search demand (researched November 2026)

Monthly searches in the **US** from Google Ads data (via seodata.dev, mid-2026), unless marked *Ahrefs*. Worldwide demand is several times higher.

**How to read these numbers.** A big number shows what people want, not the traffic you'll get. The broad terms are held by large, established sites. A new site wins first on specific variations — "compress jpeg to 100kb", "resize image to 1080x1080", "percentage increase calculator", "age in months" — so build the main tool first, then add focused pages for the variations people search. Google Ads "competition" is about advertisers, not ranking difficulty; *KD* (Ahrefs keyword difficulty, 0–100) is shown where known.

### Tools you already have

| Keyword | Searches/month |
|---|---|
| word counter | 1,220,000 |
| qr code generator | 776,000 *(Ahrefs, KD 90)* |
| barcode generator | 301,000 |
| url decoder | 27,100 |
| iframe generator | 1,600 |

### Images and PDF

The strongest fit for Pegboard: high demand, and "your files never leave your device" sets it apart.

| Tool | Searches/month | Effort | Notes |
|---|---|---|---|
| HEIC to JPG | 222,000 *(Ahrefs, KD 31)* | M | iPhone photos. Needs a HEIC decoder library (about 1 MB). |
| Merge PDF | 135,000 | M | `pdf-lib` in the browser. Later: split, reorder, rotate pages. |
| Image resizer | 110,000 | S | Canvas. Presets for Instagram, passport photos, email. |
| Image compressor | 60,500 (+ "compress image" 22,200) | S | Canvas `toBlob` quality slider, target size, batch. |
| PNG to JPG (and JPG/WebP/PNG either way) | 60,500 | S | Same engine as the resizer; one page per conversion pair. |

### Calculators *(new category)*

Very high demand, simple code, one shared layout. The business calculators suit NexWave's consulting audience.

| Tool | Searches/month | Effort |
|---|---|---|
| Percentage calculator | 673,000 | S |
| Loan calculator | 616,000 *(Ahrefs)* | S |
| Age calculator | 550,000 | S |
| Time calculator (add hours and minutes) | 335,000 *(Ahrefs)* | S |
| Days between dates | 110,000 | S |
| Margin calculator | 55,000 *(Ahrefs)* | S |
| Salary to hourly | 42,000 *(Ahrefs)* | S |

### Everyday and random *(new category)*

Enormous demand and repeat visitors. For several of these Google shows its own widget at the top of the results, so fewer clicks reach websites — but they still send real traffic (calculator.net gets about 307,000 US visits a month from "dice roller", per Ahrefs).

| Tool | Searches/month | Effort |
|---|---|---|
| Flip a coin | 1,830,000 | S |
| Random number generator | 1,500,000 | S |
| Stopwatch (and countdown timer) | 1,220,000 | S |
| Spin the wheel / random name picker | 823,000 | M |
| Typing test | 550,000 | M |
| Dice roller | 392,000 *(Ahrefs)* | S |

### Text and developer

| Tool | Searches/month | Effort | Notes |
|---|---|---|---|
| Password generator | 300,000 *(Ahrefs, KD 82)* | S | Hard to rank for the broad term; "generated on your device" is the trust story. |
| Color picker (and HEX/RGB converter) | 246,000 | S | Add the contrast checker (7,000, *Ahrefs*) on the same page. |
| JSON formatter and validator | 135,000 | S | Advertisers pay about $11 a click for this keyword, a sign of a valuable audience. |
| Base64 encode/decode | 74,000 | S | Sibling of the URL decoder. |
| Case converter | 27,100 | S | Pairs with the word counter. |
| Meta description generator/checker | 1,600 *(Ahrefs, KD 12)* | S | Small but easy; builds on the word counter's limit bars. |

## Recommended build order

1. **Files: image resizer, image compressor, image converter.** One shared engine, the biggest demand that matches the privacy promise. Then HEIC to JPG and Merge PDF.
2. **Calculators: percentage, age, days between dates, time, margin, salary to hourly.** Quick to build, one layout, huge demand.
3. **Text and developer: password generator, JSON formatter, Base64, case converter, color picker.** Quick wins that reuse existing layouts.
4. **Everyday: coin flip, random number and dice, stopwatch and timer, spin the wheel, typing test.** Fun and sticky, but Google's own widgets compete for the clicks.

Ship them in small batches and give each a few weeks in Search Console before judging it.

## Upgrades to the tools you have

Often worth more than a new tool, because the page already ranks.

- **QR codes:** logo in the middle (automatically switch to error correction H), batch from a CSV into a ZIP, printable Wi-Fi card for guests, focused pages for Wi-Fi, vCard and menu QR codes.
- **Barcodes:** batch from a list, printable label sheets, a focused "EAN-13 check digit calculator" page.
- **Word counter:** readability score, the case converter as a toolbar, "find long sentences".
- **iFrame generator:** presets for Google Maps, Google Forms and Calendly; focused pages for YouTube and Vimeo embeds.
- **URL decoder:** edit query parameters and rebuild the URL; strip tracking parameters in one click; a focused "UTM decoder" page.

## Growth playbook

Google says its AI Overviews and AI Mode use the same ranking systems as normal results, so the same work covers both Google and AI assistants.

1. **Search Console and Bing Webmaster Tools.** Verify `nexwavesolutions.net` as a Domain property, submit the sitemap, request indexing for each new page. In Bing Webmaster Tools, use *Import from Google Search Console*. Bing's index feeds Microsoft Copilot and other AI search tools.
2. **Genuine mentions.** Show HN, Product Hunt, AlternativeTo, relevant Reddit communities (follow their rules), a "how I built this" post on dev.to, and a short post per tool on the NexWave WordPress blog. Avoid paid or fake mentions.
3. **Focused pages for specific searches,** each with real explanation — a few good ones beat many thin ones.
4. **Share images** (`og:image`, 1200×630) so links look good in chats and social posts, and **IndexNow** pings so Bing and others pick up new pages within minutes.
5. **Measure without cookies.** Turn on Cloudflare Web Analytics; add `https://static.cloudflareinsights.com` to `script-src` and `https://cloudflareinsights.com` to `connect-src` in the Content-Security-Policy in `scripts/build.mjs`.
6. **Make it installable** (web app manifest + service worker) so the tools work offline and live on a phone's home screen.
7. **Ship something every week or two.** Each tool is a new page that can rank and a reason to come back.

Skip: `llms.txt` (Google says Search ignores it, and most such files are never read) and FAQ rich results (Google removed them for all sites in 2026; FAQ sections still help readers).

## Adding a tool (checklist)

1. `npm run new-tool -- "Tool name" category` — creates the folder as a **draft**.
2. Put pure logic in `logic.js` and test it in `tests/` (look at `tests/tools.test.mjs`).
3. Write `meta.json` like a search result: `title` around 60 characters with the main keyword first, `description` under 155, three or four real FAQ questions.
4. Add `related` links both ways, to and from existing tools.
5. Open a PR to `develop`, check it on dev and on a phone, then remove `"status": "draft"` and release.

Sources: [seodata.dev keyword data](https://www.seodata.dev/), [Ahrefs: The free tools SEO strategy](https://ahrefs.com/blog/the-free-tools-seo-strategy/), [Ahrefs Top: calculator.net](https://ahrefstop.com/websites/calculator.net), [Google: Optimizing for generative AI features](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).
