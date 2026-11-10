// Build iframe embed code. Pure functions, unit tested.

export const RATIOS = {
  '16/9': '16:9 (video)',
  '4/3': '4:3',
  '1/1': '1:1 (square)',
  '9/16': '9:16 (vertical video)',
  '21/9': '21:9 (wide)',
  '3/4': '3:4 (document)',
};

export const PERMISSIONS = [
  ['autoplay', 'Autoplay'],
  ['clipboard-write', 'Write to clipboard'],
  ['encrypted-media', 'Protected media (DRM)'],
  ['picture-in-picture', 'Picture-in-picture'],
  ['web-share', 'Share'],
  ['accelerometer', 'Motion sensors'],
  ['gyroscope', 'Gyroscope'],
  ['camera', 'Camera'],
  ['microphone', 'Microphone'],
  ['geolocation', 'Location'],
];

export const SANDBOX = [
  ['allow-scripts', 'Run scripts'],
  ['allow-same-origin', 'Keep its own origin (cookies, storage)'],
  ['allow-forms', 'Submit forms'],
  ['allow-popups', 'Open pop-ups and new tabs'],
  ['allow-presentation', 'Start presentations'],
  ['allow-downloads', 'Download files'],
];

export const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** "1m30s" | "90" | "90s" → 90 */
export function parseTimestamp(t) {
  if (!t) return 0;
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
  if (!m) return 0;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

/**
 * Turn a normal page link into its embeddable address for well-known services.
 * Returns { src, note, provider }.
 */
export function toEmbedUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return { src: '', note: '' };
  let url;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { src: '', note: '', error: 'That doesn’t look like a web address.' };
  }
  if (!/^https?:$/.test(url.protocol)) return { src: '', note: '', error: 'Only http:// and https:// addresses can be embedded.' };

  const host = url.hostname.replace(/^www\.|^m\./, '');

  // YouTube
  let ytId = null;
  if (host === 'youtu.be') ytId = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') ytId = url.searchParams.get('v');
    else if (/^\/(shorts|live)\//.test(url.pathname)) ytId = url.pathname.split('/')[2];
    else if (url.pathname.startsWith('/embed/')) return { src: url.href, note: '', provider: 'youtube' };
  }
  if (ytId && /^[\w-]{6,}$/.test(ytId)) {
    const start = parseTimestamp(url.searchParams.get('t') || url.searchParams.get('start'));
    const embed = new URL(`https://www.youtube.com/embed/${ytId}`);
    if (start) embed.searchParams.set('start', String(start));
    return { src: embed.href, note: 'Converted the YouTube link to its embed address.', provider: 'youtube' };
  }

  // Vimeo
  if (host === 'vimeo.com') {
    const id = url.pathname.split('/').find((p) => /^\d+$/.test(p));
    if (id) return { src: `https://player.vimeo.com/video/${id}`, note: 'Converted the Vimeo link to its player address.', provider: 'vimeo' };
  }

  // Loom
  if (host === 'loom.com' && url.pathname.startsWith('/share/')) {
    return { src: `https://www.loom.com/embed/${url.pathname.split('/')[2]}`, note: 'Converted the Loom link to its embed address.', provider: 'loom' };
  }

  // Spotify
  if (host === 'open.spotify.com' && !url.pathname.startsWith('/embed/')) {
    const m = /^\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/.exec(url.pathname);
    if (m) return { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, note: 'Converted the Spotify link to its embed address.', provider: 'spotify' };
  }

  // Google Maps share links can't be converted
  if ((host === 'google.com' && url.pathname.startsWith('/maps') && !url.pathname.startsWith('/maps/embed')) || host === 'maps.app.goo.gl' || host === 'goo.gl') {
    return { src: url.href, note: 'Google Maps links need their embed address: in Google Maps, choose Share → Embed a map and paste the src="…" value here.', provider: 'maps' };
  }

  return { src: url.href, note: url.protocol === 'http:' ? 'This address uses http://. Most browsers block insecure frames on https:// pages — use https:// if the site supports it.' : '' };
}

/** Build the iframe HTML from options. */
export function buildIframe(o) {
  const { src, note, error, provider } = toEmbedUrl(o.url);
  if (error) return { ok: false, message: error };
  if (!src) return { ok: false, message: 'Enter the address of the page you want to embed.' };

  const attrs = [`src="${escapeAttr(src)}"`, `title="${escapeAttr(o.title?.trim() || 'Embedded content')}"`];
  const style = [];

  if (o.sizeMode === 'responsive') {
    style.push('width:100%', 'height:auto', `aspect-ratio:${(o.ratio || '16/9').replace('/', ' / ')}`);
    if (Number(o.maxWidth) > 0) style.push(`max-width:${Number(o.maxWidth)}px`);
  } else {
    const w = Number(o.width) > 0 ? Number(o.width) : 560;
    const h = Number(o.height) > 0 ? Number(o.height) : 315;
    attrs.push(`width="${o.widthUnit === '%' ? `${Math.min(w, 100)}%` : w}"`, `height="${h}"`);
  }
  style.push(o.border ? 'border:1px solid #d0d7de' : 'border:0');
  if (o.rounded) style.push('border-radius:8px');

  attrs.push(`style="${style.join(';')}"`);
  if (o.lazy) attrs.push('loading="lazy"');

  const allow = (o.allow || []).filter(Boolean);
  if (allow.length) attrs.push(`allow="${allow.join('; ')}"`);
  if (o.fullscreen) attrs.push('allowfullscreen');
  if (o.referrer) attrs.push(`referrerpolicy="${escapeAttr(o.referrer)}"`);
  if (o.useSandbox) attrs.push(`sandbox="${(o.sandbox || []).join(' ')}"`);

  const notes = [];
  if (note) notes.push(note);
  if (o.useSandbox && (o.sandbox || []).includes('allow-scripts') && (o.sandbox || []).includes('allow-same-origin')) {
    notes.push('Allowing both scripts and same origin lets the embedded page remove its own sandbox. Only do this for content you trust.');
  }
  if (provider === 'youtube' && o.useSandbox && !(o.sandbox || []).includes('allow-scripts')) {
    notes.push('YouTube needs “Run scripts” and “Keep its own origin” to play inside a sandbox.');
  }

  return { ok: true, src, notes, html: `<iframe ${attrs.join(' ')}></iframe>` };
}
