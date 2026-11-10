// Percent-encoding and decoding. Pure functions, unit tested.

export const ENCODINGS = {
  component: { label: 'Query value or path segment', help: 'encodeURIComponent: escapes everything except letters, digits and - _ . ! ~ * \' ( )' },
  rfc3986: { label: 'Strict (RFC 3986)', help: 'Like the above, but also escapes ! \' ( ) * — safest for signatures and APIs.' },
  form: { label: 'Form data (spaces as +)', help: 'application/x-www-form-urlencoded, the way HTML forms send data.' },
  uri: { label: 'Whole URL', help: 'encodeURI: keeps : / ? # & = so the address still works.' },
};

const hex = (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0');

export function encode(text, variant = 'component') {
  const s = String(text);
  switch (variant) {
    case 'uri':
      return encodeURI(s);
    case 'rfc3986':
      return encodeURIComponent(s).replace(/[!'()*]/g, hex);
    case 'form':
      return encodeURIComponent(s).replace(/[!'()~]/g, hex).replace(/%20/g, '+');
    default:
      return encodeURIComponent(s);
  }
}

/**
 * Decode percent-escapes without throwing on bad input: valid runs are decoded,
 * invalid ones are left exactly as they were.
 */
export function tolerantDecode(s) {
  let bad = 0;
  const out = String(s).replace(/(?:%[0-9a-fA-F]{2})+/g, (run) => {
    try {
      return decodeURIComponent(run);
    } catch {
      // decode the longest valid prefixes one byte-sequence at a time
      let result = '';
      let i = 0;
      while (i < run.length) {
        let done = false;
        for (let len = Math.min(12, run.length - i); len >= 3; len -= 3) {
          try {
            result += decodeURIComponent(run.slice(i, i + len));
            i += len;
            done = true;
            break;
          } catch { /* try a shorter sequence */ }
        }
        if (!done) {
          result += run.slice(i, i + 3);
          i += 3;
          bad++;
        }
      }
      return result;
    }
  });
  return { text: out, bad };
}

export function decode(text, { plusAsSpace = true, repeat = false } = {}) {
  let current = String(text);
  let passes = 0;
  let bad = 0;
  const maxPasses = repeat ? 10 : 1;
  while (passes < maxPasses) {
    // "+" means space only in the original text; a "+" produced by decoding %2B is a real plus sign
    const input = plusAsSpace && passes === 0 ? current.replace(/\+/g, ' ') : current;
    const r = tolerantDecode(input);
    passes++;
    bad = r.bad;
    if (r.text === current) break;
    current = r.text;
    if (!/%[0-9a-fA-F]{2}/.test(current)) break;
  }
  return { text: current, passes, bad };
}

/** Break a URL into parts and decoded query parameters, or return null if it isn't a URL. */
export function parseUrl(text) {
  const s = String(text || '').trim();
  if (!s || /\s/.test(s)) return null;
  let url;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (!/^(https?|ftp|wss?):$/.test(url.protocol)) return null;
  const params = [...url.searchParams.entries()];
  return {
    parts: [
      ['Scheme', url.protocol.replace(':', '')],
      ['Host', url.hostname],
      ...(url.port ? [['Port', url.port]] : []),
      ['Path', safeDecodePath(url.pathname)],
      ...(url.hash ? [['Fragment', tolerantDecode(url.hash.slice(1)).text]] : []),
    ],
    params,
  };
}

function safeDecodePath(p) {
  return tolerantDecode(p).text;
}
