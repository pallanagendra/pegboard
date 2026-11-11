// Site-wide settings. Change the name/tagline here and every page updates on the next build.
export default {
  name: 'Pegboard',
  tagline: 'Small web tools that do one job well.',
  description:
    'Free browser tools: QR codes, barcodes, image resizer, percentage and loan calculators, password generator, JSON formatter and more. Nothing is uploaded.',

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
