// src/common/i18n/tehran-time.ts
/**
 * The footer clock's formatter, shared by the server render and the client tick.
 *
 * Ported from `legacy/js/main.js:152`. Iran Standard Time is UTC+03:30 and has had no
 * daylight saving since 2022, but the zone is still named rather than expressed as a fixed
 * offset: a hardcoded `+03:30` is a number that was once wrong twice a year and would be
 * wrong again the day the rule changes, whereas `Asia/Tehran` is a rule the platform
 * maintains.
 *
 * The formatter is LOCALE-DEPENDENT, and both halves matter: `fa-IR` for the digit shaping
 * the `arabext` numbering system supplies (U+06F0–U+06F9, the extended Arabic-Indic set
 * Persian uses), and `en-GB` for the 24-hour Latin form. `hour12: false` is stated
 * explicitly because the default differs by locale.
 *
 * ONE FUNCTION, TWO CALLERS, and that is the point: the server computes the first value so
 * the clock is correct in the HTML, and the client re-computes it every 30 seconds. If the
 * two used different formatters, the first tick would visibly rewrite a correct value.
 */
import type { Locale } from '@/common/schemas/locale';

export function tehranTimeFormatter(locale: Locale): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tehran',
    numberingSystem: locale === 'fa' ? 'arabext' : 'latn',
  });
}

/** `HH:MM IRST` / `HH:MM به وقت تهران`. */
export function formatTehranTime(date: Date, locale: Locale, suffix: string): string {
  return `${tehranTimeFormatter(locale).format(date)} ${suffix}`;
}
