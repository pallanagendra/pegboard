# Third-party software

| Component | Version | License | Used in |
|---|---|---|---|
| [JsBarcode](https://github.com/lindell/JsBarcode) | 3.12.3 | MIT | `src/assets/vendor/jsbarcode-3.12.3.min.js` — barcode generator |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase | 2.0.4 | MIT | `src/assets/vendor/qrcode-generator-2.0.4.js` — QR code generator |
| [EFF long word list](https://www.eff.org/dice) by the Electronic Frontier Foundation | 2016 | [CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/) | `src/tools/password-generator/words.js` — passphrases in the password generator (credited on the tool and About pages) |
| [libheif](https://github.com/strukturag/libheif) by struktur AG, as built by [libheif-js](https://github.com/catdad-experiments/libheif-js) | 1.23.5 | [LGPL-3.0](src/assets/vendor/libheif-1.23.5/LICENSE.txt) | `src/assets/vendor/libheif-1.23.5/` — HEIC decoding in the image tools and HEIC to JPG. Unmodified; loaded as a separate file, so it can be swapped for another build. Source: [libheif releases](https://github.com/strukturag/libheif/releases) and [libheif-js 1.23.5](https://github.com/catdad-experiments/libheif-js) |
| [pdf-lib](https://github.com/Hopding/pdf-lib) by Andrew Dillon | 1.17.1 | [MIT](src/assets/vendor/pdf-lib-1.17.1.LICENSE.txt) | `src/assets/vendor/pdf-lib-1.17.1.min.js` — Merge PDF |
| [Archivo](https://github.com/Omnibus-Type/Archivo) by Omnibus-Type | variable | SIL Open Font License 1.1 | `src/assets/fonts/` — site typeface (license text in `src/assets/fonts/OFL-LICENSE.txt`) |

The libraries are copied into the repository (not loaded from a CDN) so the site has no third-party requests and works under a strict Content Security Policy. To update one, replace the file, rename it with the new version number, and update `vendor` in the tool's `meta.json`.
