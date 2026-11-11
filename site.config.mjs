// Site-wide settings. Change the name/tagline here and every page updates on the next build.
export default {
  name: 'Pegboard',
  tagline: 'Small web tools that do one job well.',
  description:
    'Free browser tools: QR codes, barcodes, HEIC to JPG, merge PDF, percentage and loan calculators, password generator and more. Nothing is uploaded.',

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

  // Tool categories, in display order (most searched first). Each tool's meta.json picks one of these keys.
  categories: {
    everyday: 'Everyday',
    calculators: 'Calculators',
    generators: 'Generators',
    text: 'Text',
    files: 'Images and PDF',
    web: 'Web & developer',
  },
};
