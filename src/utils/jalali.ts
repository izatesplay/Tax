import { JalaliDate } from '../types';
import { toPersianDigits } from './formatters';

export const JALALI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

export const JALALI_WEEKDAYS = [
  'شنبه',
  'یک‌شنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
] as const;

/**
 * Standard Jalaali <-> Gregorian conversion algorithm (Borkowski)
 */

function div(a: number, b: number): number {
  return ~~(a / b);
}

function remainder(a: number, b: number): number {
  return a - ~~(a / b) * b;
}

/**
 * Check if a Jalali year is a leap year
 */
export function isJalaliLeapYear(jy: number): boolean {
  return jalaliCalLeap(jy) === 0;
}

function jalaliCalLeap(jy: number): number {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
    2192, 2262, 2324, 2394, 2456, 3178,
  ];
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm: number;
  let jump: number;
  let n: number;
  let i: number;

  if (jy < jp || jy >= breaks[bl - 1]) {
    // Standard 33-year cycle approximation for out of range
    const rem = remainder(jy, 33);
    const leapYears = [1, 5, 9, 13, 17, 22, 26, 30];
    return leapYears.includes(rem) ? 0 : 1;
  }

  for (i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) {
      break;
    }
    leapJ = leapJ + div(jump, 33) * 8 + div(remainder(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;

  leapJ = leapJ + div(n, 33) * 8 + div(remainder(n, 33) + 3, 4);
  if (remainder(jump!, 33) === 4 && jump! - n === 4) {
    leapJ += 1;
  }

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump! - n < 6) {
    n = n - jump! + div(jump! + 4, 33) * 33;
  }
  let leap = remainder(remainder(n + 1, 33) - 1, 4);
  if (leap === -1) {
    leap = 4;
  }

  return leap;
}

/**
 * Gregorian to Jalali
 */
export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number;
  if (gy > 1600) {
    jy = 979;
    gy -= 1600;
  } else {
    jy = 0;
    gy -= 621;
  }

  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) -
    80 +
    gd +
    g_d_m[gm - 1];

  jy += 33 * div(days, 12053);
  days %= 12053;

  jy += 4 * div(days, 1461);
  days %= 1461;

  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }

  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + div(days, 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + div(days - 186, 30);
    jd = 1 + ((days - 186) % 30);
  }

  return { jy, jm, jd };
}

/**
 * Jalali to Gregorian
 */
export function jalaliToGregorian(
  jy: number,
  jm: number,
  jd: number
): { gy: number; gm: number; gd: number } {
  let gy: number;
  if (jy > 979) {
    gy = 1600;
    jy -= 979;
  } else {
    gy = 621;
  }

  let days =
    365 * jy +
    div(jy, 33) * 8 +
    div(remainder(jy, 33) + 3, 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

  gy += 400 * div(days, 146097);
  days %= 146097;

  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days %= 36524;
    if (days >= 365) days++;
  }

  gy += 4 * div(days, 1461);
  days %= 1461;

  if (days > 365) {
    gy += div(days - 1, 365);
    days = (days - 1) % 365;
  }

  let gd = days + 1;
  const sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  let gm: number;
  for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) {
    gd -= sal_a[gm];
  }

  return { gy, gm, gd };
}

/**
 * Number of days in a specific Jalali month
 */
export function getDaysInJalaliMonth(jy: number, jm: number): number {
  if (jm >= 1 && jm <= 6) return 31;
  if (jm >= 7 && jm <= 11) return 30;
  if (jm === 12) {
    return isJalaliLeapYear(jy) ? 30 : 29;
  }
  return 30;
}

/**
 * Converts ISO string YYYY-MM-DD to Jalali Date
 */
export function isoToJalali(isoString: string): JalaliDate {
  const [gy, gm, gd] = isoString.split('-').map(Number);
  return gregorianToJalali(gy, gm, gd);
}

/**
 * Converts Jalali date components to ISO string YYYY-MM-DD
 */
export function jalaliToIso(jy: number, jm: number, jd: number): string {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
  const mm = String(gm).padStart(2, '0');
  const dd = String(gd).padStart(2, '0');
  return `${gy}-${mm}-${dd}`;
}

/**
 * Gets today's date in Tehran timezone (UTC+3:30) as Jalali and ISO
 */
export function getTehranToday(): {
  iso: string;
  jalali: JalaliDate;
} {
  // Use Intl to extract Tehran date parts accurately
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(new Date());
  const yearPart = parts.find((p) => p.type === 'year')?.value || '2026';
  const monthPart = parts.find((p) => p.type === 'month')?.value || '10';
  const dayPart = parts.find((p) => p.type === 'day')?.value || '18';

  const gy = parseInt(yearPart, 10);
  const gm = parseInt(monthPart, 10);
  const gd = parseInt(dayPart, 10);

  const iso = `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
  const jalali = gregorianToJalali(gy, gm, gd);

  return { iso, jalali };
}

/**
 * Format ISO date string into readable Persian string
 * Example: "1405-07-26" -> "۲۶ مهر ۱۴۰۵"
 */
export function formatJalaliDateFull(isoString: string): string {
  if (!isoString) return '';
  const { jy, jm, jd } = isoToJalali(isoString);
  const monthName = JALALI_MONTH_NAMES[jm - 1];
  return `${toPersianDigits(jd)} ${monthName} ${toPersianDigits(jy)}`;
}

/**
 * Format ISO date string into short Jalali string
 * Example: "۱۴۰۵/۰۷/۲۶"
 */
export function formatJalaliDateShort(isoString: string): string {
  if (!isoString) return '';
  const { jy, jm, jd } = isoToJalali(isoString);
  const m = String(jm).padStart(2, '0');
  const d = String(jd).padStart(2, '0');
  return toPersianDigits(`${jy}/${m}/${d}`);
}

/**
 * Returns Persian weekday for an ISO date
 * Saturday = شنبه, ..., Friday = جمعه
 */
export function getPersianWeekday(isoString: string): string {
  const [gy, gm, gd] = isoString.split('-').map(Number);
  const date = new Date(Date.UTC(gy, gm - 1, gd, 12, 0, 0));
  // JavaScript getUTCDay(): 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const day = date.getUTCDay();
  // Jalali weekdays start on Saturday:
  // Saturday (6) -> 0
  // Sunday (0) -> 1
  // Monday (1) -> 2
  // Tuesday (2) -> 3
  // Wednesday (3) -> 4
  // Thursday (4) -> 5
  // Friday (5) -> 6
  const jalaliIndex = (day + 1) % 7;
  return JALALI_WEEKDAYS[jalaliIndex];
}

/**
 * Calculates start and end ISO dates for a given Jalali Year and Month
 */
export function getJalaliMonthIsoRange(jy: number, jm: number): {
  startIso: string;
  endIso: string;
} {
  const daysInMonth = getDaysInJalaliMonth(jy, jm);
  const startIso = jalaliToIso(jy, jm, 1);
  const endIso = jalaliToIso(jy, jm, daysInMonth);
  return { startIso, endIso };
}

/**
 * Checks if a given ISO date falls within the current Shamsi month
 */
export function isDateInCurrentShamsiMonth(isoString: string): boolean {
  const today = getTehranToday();
  const dateJalali = isoToJalali(isoString);
  return (
    dateJalali.jy === today.jalali.jy && dateJalali.jm === today.jalali.jm
  );
}

/**
 * Checks if a given ISO date falls within today in Tehran
 */
export function isDateToday(isoString: string): boolean {
  const today = getTehranToday();
  return isoString === today.iso;
}

/**
 * Checks if a given ISO date falls within current Shamsi week (Saturday to Friday)
 */
export function isDateInCurrentShamsiWeek(isoString: string): boolean {
  const today = getTehranToday();
  const [gy, gm, gd] = today.iso.split('-').map(Number);
  const targetDate = new Date(isoString);
  const todayDate = new Date(Date.UTC(gy, gm - 1, gd, 12, 0, 0));

  // Determine Saturday of this week
  const jsDay = todayDate.getUTCDay(); // 0 is Sunday, 6 is Saturday
  const daysSinceSaturday = (jsDay + 1) % 7;
  const saturday = new Date(todayDate);
  saturday.setUTCDate(todayDate.getUTCDate() - daysSinceSaturday);

  const friday = new Date(saturday);
  friday.setUTCDate(saturday.getUTCDate() + 6);

  const satIso = saturday.toISOString().slice(0, 10);
  const friIso = friday.toISOString().slice(0, 10);

  return isoString >= satIso && isoString <= friIso;
}
