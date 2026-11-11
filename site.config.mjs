// Site-wide settings. Change the name/tagline here and every page updates on the next build.
export default {
  name: 'Pegboard',
  tagline: 'Small web tools that do one job well.',
  description:
    'Free, fast browser tools: barcode and QR code generators, iframe embed code, URL encoder/decoder, word counter. Nothing is uploaded — everything runs on your device.',

  // Public URL per environment, used for canonical links and the sitemap.
  // Leave these empty: set the SITE_URL variable on each GitHub Environment instead
  // (Settings → Environments → <env> → Variables), so changing it needs no code change.
  urls: {
    production: '',
    staging: '',
    dev: '',
    local: 'http://localhost:8080',
  },

  // Shown in the footer.
  owner: 'Pegboard',

  // Tool categories, in display order. Each tool's meta.json picks one of these keys.
  categories: {
    generators: 'Generators',
    files: 'Images and files',
    calculators: 'Calculators',
    everyday: 'Everyday',
    text: 'Text',
    web: 'Web & developer',
  },
};
