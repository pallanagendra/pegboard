# Third-party software

| Component | Version | License | Used in |
|---|---|---|---|
| [JsBarcode](https://github.com/lindell/JsBarcode) | 3.12.3 | MIT | `src/assets/vendor/jsbarcode-3.12.3.min.js` — barcode generator |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase | 2.0.4 | MIT | `src/assets/vendor/qrcode-generator-2.0.4.js` — QR code generator |
| [Archivo](https://github.com/Omnibus-Type/Archivo) by Omnibus-Type | variable | SIL Open Font License 1.1 | `src/assets/fonts/` — site typeface (license text in `src/assets/fonts/OFL-LICENSE.txt`) |

The libraries are copied into the repository (not loaded from a CDN) so the site has no third-party requests and works under a strict Content Security Policy. To update one, replace the file, rename it with the new version number, and update `vendor` in the tool's `meta.json`.
