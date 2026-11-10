// Turn form values into the text a QR code should hold. Pure functions, unit tested.

/** Add https:// when someone types "example.com/page". */
export function normalizeUrl(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return s; // already has a scheme (https:, mailto:, etc.)
  if (/^[^\s/]+\.[^\s/]{2,}/.test(s)) return `https://${s}`;
  return s;
}

/** Wi-Fi QR strings need \ ; , : " escaped with a backslash. */
export function escapeWifi(s) {
  return String(s ?? '').replace(/([\\;,:"])/g, '\\$1');
}

/** vCard values need \ , ; escaped and newlines written as \n. */
export function escapeVcard(s) {
  return String(s ?? '').replace(/([\\,;])/g, '\\$1').replace(/\r?\n/g, '\\n');
}

export function buildPayload(type, o) {
  const t = (v) => String(v ?? '').trim();
  switch (type) {
    case 'url': {
      const url = normalizeUrl(o.url);
      return url ? { ok: true, payload: url } : { ok: false, message: 'Enter a web address.' };
    }
    case 'text':
      return t(o.text) ? { ok: true, payload: String(o.text) } : { ok: false, message: 'Enter some text.' };
    case 'wifi': {
      if (!t(o.wifiSsid)) return { ok: false, message: 'Enter the network name (SSID).' };
      const sec = o.wifiSecurity || 'WPA';
      if (sec !== 'nopass' && !o.wifiPassword) return { ok: false, message: 'Enter the Wi-Fi password, or choose "No password".' };
      const parts = [`T:${sec}`, `S:${escapeWifi(o.wifiSsid)}`];
      if (sec !== 'nopass') parts.push(`P:${escapeWifi(o.wifiPassword)}`);
      if (o.wifiHidden) parts.push('H:true');
      return { ok: true, payload: `WIFI:${parts.join(';')};;` };
    }
    case 'email': {
      const to = t(o.emailTo);
      if (!to) return { ok: false, message: 'Enter an email address.' };
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false, message: 'That email address looks incomplete.' };
      const q = [];
      if (t(o.emailSubject)) q.push(`subject=${encodeURIComponent(o.emailSubject)}`);
      if (t(o.emailBody)) q.push(`body=${encodeURIComponent(o.emailBody)}`);
      return { ok: true, payload: `mailto:${to}${q.length ? `?${q.join('&')}` : ''}` };
    }
    case 'phone': {
      const num = t(o.phone).replace(/[^\d+]/g, '');
      return num ? { ok: true, payload: `tel:${num}` } : { ok: false, message: 'Enter a phone number.' };
    }
    case 'sms': {
      const num = t(o.smsNumber).replace(/[^\d+]/g, '');
      if (!num) return { ok: false, message: 'Enter the phone number the text goes to.' };
      return { ok: true, payload: `SMSTO:${num}:${o.smsMessage ?? ''}` };
    }
    case 'vcard': {
      const first = t(o.vcFirst);
      const last = t(o.vcLast);
      if (!first && !last && !t(o.vcOrg)) return { ok: false, message: 'Enter at least a name or a company.' };
      const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${escapeVcard(last)};${escapeVcard(first)};;;`, `FN:${escapeVcard([first, last].filter(Boolean).join(' ') || o.vcOrg)}`];
      if (t(o.vcOrg)) lines.push(`ORG:${escapeVcard(o.vcOrg)}`);
      if (t(o.vcTitle)) lines.push(`TITLE:${escapeVcard(o.vcTitle)}`);
      if (t(o.vcPhone)) lines.push(`TEL;TYPE=CELL:${t(o.vcPhone)}`);
      if (t(o.vcEmail)) lines.push(`EMAIL:${t(o.vcEmail)}`);
      if (t(o.vcUrl)) lines.push(`URL:${normalizeUrl(o.vcUrl)}`);
      lines.push('END:VCARD');
      return { ok: true, payload: lines.join('\r\n') };
    }
    default:
      return { ok: false, message: 'Pick what the QR code should contain.' };
  }
}

/** WCAG relative luminance contrast ratio between two #rrggbb colors. */
export function contrastRatio(a, b) {
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Is the first color darker than the second? Scanners expect dark modules on a light background. */
export function isDarkOnLight(fg, bg) {
  const l = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  };
  return l(fg) < l(bg);
}

/** Build an SVG path for the dark modules, merging horizontal runs to keep the file small. */
export function modulesToPath(count, isDark, margin) {
  let d = '';
  for (let r = 0; r < count; r++) {
    let c = 0;
    while (c < count) {
      if (!isDark(r, c)) { c++; continue; }
      const start = c;
      while (c < count && isDark(r, c)) c++;
      d += `M${start + margin} ${r + margin}h${c - start}v1h-${c - start}z`;
    }
  }
  return d;
}

/** Dots style: one circle per dark module. */
export function modulesToDots(count, isDark, margin) {
  let d = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!isDark(r, c)) continue;
      const cx = c + margin + 0.5;
      const cy = r + margin + 0.5;
      d += `M${cx - 0.5} ${cy}a0.5 0.5 0 1 0 1 0a0.5 0.5 0 1 0 -1 0z`;
    }
  }
  return d;
}

/** True if (r, c) is inside one of the three 7×7 finder patterns. */
export function inFinder(count, r, c) {
  return (r < 7 && c < 7) || (r < 7 && c >= count - 7) || (r >= count - 7 && c < 7);
}
