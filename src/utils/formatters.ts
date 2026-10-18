/**
 * Number formatting and Persian digit conversions for KharjYar
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Converts English digits (0-9) to Persian digits (۰-۹)
 */
export function toPersianDigits(input: string | number): string {
  if (input === null || input === undefined) return '';
  return input
    .toString()
    .replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[parseInt(digit, 10)]);
}

/**
 * Converts Persian and Arabic digits to standard English digits
 */
export function parseToEnglishDigits(input: string): string {
  if (!input) return '';
  let result = input;
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(PERSIAN_DIGITS[i], 'g'), i.toString());
    result = result.replace(new RegExp(ARABIC_DIGITS[i], 'g'), i.toString());
  }
  return result;
}

/**
 * Parses user input string (handling Persian/English digits, spaces, commas)
 * into a valid positive integer.
 * Returns null if invalid or <= 0 or not safe integer.
 */
export function parsePositiveInteger(input: string | number): number | null {
  if (typeof input === 'number') {
    if (Number.isInteger(input) && input > 0 && input <= Number.MAX_SAFE_INTEGER) {
      return input;
    }
    return null;
  }

  if (!input || typeof input !== 'string') return null;

  // Normalize digits to English, remove commas, spaces, currency words
  const normalized = parseToEnglishDigits(input)
    .replace(/[,\s٬،]/g, '')
    .trim();

  // Must only be digits
  if (!/^\d+$/.test(normalized)) return null;

  const num = Number(normalized);
  if (!Number.isFinite(num) || num <= 0 || !Number.isSafeInteger(num)) {
    return null;
  }

  return num;
}

/**
 * Formats a number with thousands separators (٬) and Persian digits
 * Example: 80000 -> "۸۰٬۰۰۰"
 */
export function formatThousandsPersian(num: number): string {
  if (!Number.isFinite(num)) return '۰';
  // Use Intl with en-US to get clean commas, then replace digits and comma
  const parts = Math.round(num).toString().split('');
  let result = '';
  let count = 0;
  for (let i = parts.length - 1; i >= 0; i--) {
    count++;
    result = parts[i] + result;
    if (count % 3 === 0 && i > 0) {
      result = '٬' + result;
    }
  }
  return toPersianDigits(result);
}

/**
 * Formats amount in Tomans with Persian digits and separator
 * Example: 80000 -> "۸۰٬۰۰۰ تومان"
 */
export function formatToman(amount: number, includeUnit = true): string {
  const formatted = formatThousandsPersian(amount);
  return includeUnit ? `${formatted} تومان` : formatted;
}
