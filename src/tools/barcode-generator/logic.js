// Barcode rules that don't need a browser, so they can be unit tested.

export const FORMATS = {
  CODE128: { label: 'Code 128', hint: 'Any text: letters, numbers and symbols.', example: 'PEG-2026-0001' },
  EAN13: { label: 'EAN-13', hint: '12 digits (the check digit is added for you) or 13 with a valid check digit.', example: '590123412345' },
  UPC: { label: 'UPC-A', hint: '11 digits (the check digit is added for you) or 12 with a valid check digit.', example: '03600029145' },
  EAN8: { label: 'EAN-8', hint: '7 digits, or 8 with a valid check digit.', example: '9638507' },
  UPCE: { label: 'UPC-E', hint: '6 digits, or 8 including the number system and check digit.', example: '123456' },
  CODE39: { label: 'Code 39', hint: 'Capital letters A–Z, digits 0–9, space and - . $ / + %.', example: 'PEG-1234' },
  CODE93: { label: 'Code 93', hint: 'Capital letters A–Z, digits 0–9, space and - . $ / + %.', example: 'PEG-93' },
  ITF14: { label: 'ITF-14', hint: '13 digits (the check digit is added for you) or 14 with a valid check digit.', example: '1540014128876' },
  ITF: { label: 'ITF (Interleaved 2 of 5)', hint: 'An even number of digits.', example: '12345678' },
  codabar: { label: 'Codabar', hint: 'Digits and - $ : / . + — may start and end with A, B, C or D.', example: 'A40156B' },
  MSI: { label: 'MSI Plessey', hint: 'Digits only.', example: '1234567' },
  pharmacode: { label: 'Pharmacode', hint: 'A whole number from 3 to 131070.', example: '1234' },
};

/** GS1 mod-10 check digit for EAN-8/EAN-13/UPC-A/ITF-14 bodies. */
export function gs1CheckDigit(body) {
  const digits = String(body).split('').map(Number).reverse();
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10;
}

const GS1_LENGTHS = { EAN13: 13, UPC: 12, EAN8: 8, ITF14: 14 };

/**
 * Pre-check a value for a format so we can show a specific, helpful error
 * before handing it to the barcode library.
 * Returns { ok: true, value } or { ok: false, message }.
 */
export function validate(format, raw) {
  const value = String(raw ?? '');
  if (!value.trim()) return { ok: false, message: 'Enter something to encode.' };

  const full = GS1_LENGTHS[format];
  if (full) {
    if (!/^\d+$/.test(value)) return { ok: false, message: `${FORMATS[format].label} takes digits only.` };
    if (value.length === full - 1) return { ok: true, value, note: `Check digit ${gs1CheckDigit(value)} added.` };
    if (value.length === full) {
      const expected = gs1CheckDigit(value.slice(0, -1));
      if (Number(value.at(-1)) !== expected) {
        return { ok: false, message: `The last digit should be ${expected}, not ${value.at(-1)}. Enter the first ${full - 1} digits to have it calculated.` };
      }
      return { ok: true, value };
    }
    return { ok: false, message: `${FORMATS[format].label} needs ${full - 1} or ${full} digits — you have ${value.length}.` };
  }

  switch (format) {
    case 'CODE128':
      // eslint-disable-next-line no-control-regex
      if (!/^[\x00-\x7F]+$/.test(value)) return { ok: false, message: 'Code 128 supports plain ASCII only — remove accents, emoji and curly quotes.' };
      return { ok: true, value };
    case 'CODE39':
    case 'CODE93':
      if (!/^[0-9A-Z\-. $/+%]+$/.test(value)) {
        return /[a-z]/.test(value) && /^[0-9A-Za-z\-. $/+%]+$/.test(value)
          ? { ok: true, value: value.toUpperCase(), note: 'Converted to capital letters.' }
          : { ok: false, message: `${FORMATS[format].label} supports A–Z, 0–9, space and - . $ / + % only.` };
      }
      return { ok: true, value };
    case 'UPCE':
      if (!/^(\d{6}|\d{8})$/.test(value)) return { ok: false, message: 'UPC-E needs exactly 6 or 8 digits.' };
      return { ok: true, value };
    case 'ITF':
      if (!/^\d+$/.test(value) || value.length % 2) return { ok: false, message: 'ITF needs an even number of digits.' };
      return { ok: true, value };
    case 'codabar':
      if (!/^[A-Da-d]?[0-9\-$:/.+]+[A-Da-d]?$/.test(value)) return { ok: false, message: 'Codabar takes digits and - $ : / . +, optionally wrapped in A–D start/stop letters.' };
      return { ok: true, value: value.toUpperCase() };
    case 'MSI':
      if (!/^\d+$/.test(value)) return { ok: false, message: 'MSI takes digits only.' };
      return { ok: true, value };
    case 'pharmacode': {
      const n = Number(value);
      if (!/^\d+$/.test(value) || n < 3 || n > 131070) return { ok: false, message: 'Pharmacode needs a whole number between 3 and 131070.' };
      return { ok: true, value };
    }
    default:
      return { ok: true, value };
  }
}
