// Site-wide settings. Change the name/tagline here and every page updates on the next build.
export default {
  name: 'Pegboard',
  tagline: 'Small web tools that do one job well.',
  description:
    'Free, fast browser tools: barcode and QR code generators, iframe embed code, URL encoder/decoder, word counter. Nothing is uploaded — everything runs on your device.',

  // Public URL per environment. The pipeline can override these with the SITE_URL variable
  // set on each GitHub Environment (Settings → Environments → <env> → Variables).
  urls: {
    production: 'https://pegboard.example.com',
    staging: '',
    dev: '',
    local: 'http://localhost:8080',
  },

  // Shown in the footer.
  owner: 'Pegboard',
  repo: 'https://github.com/YOUR-USERNAME/pegboard',

  // Tool categories, in display order. Each tool's meta.json picks one of these keys.
  categories: {
    generators: 'Generators',
    text: 'Text',
    web: 'Web & developer',
  },
};
