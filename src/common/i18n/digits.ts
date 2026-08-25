// src/common/i18n/digits.ts
/**
 * Latin digits -> Persian digits, and nothing else.
 *
 * Ported from `legacy/data/i18n.js:280`. This is deliberately the ONLY place in the app
 * that produces a Persian numeral, and it runs at RENDER time.
 *
 * WHY IT IS NOT DONE AT WRITE TIME. The database stores Latin digits on purpose
 * (`legacy/data/projects.fa.part1.js:3` records the decision): `۱۳۹۲` cannot be sorted
 * against `2013`, cannot be compared in a `WHERE year > ?`, and cannot be matched against
 * a `?year=2013` query parameter. Storing the shaped form buys a locale-correct read at
 * the cost of every query that touches the value. Shaping at render costs one string pass
 * over text that is already being serialized.
 *
 * It is intentionally a pure string transform with no locale argument: the CALLER decides
 * whether Persian is in effect (`translator.num`), so this function stays testable and
 * usable for the one case that needs shaping without a translator in hand.
 */

/** U+06F0–U+06F9, the EXTENDED Arabic-Indic digits Persian uses — not U+0660–U+0669. */
export const DIGITS_FA = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;

/**
 * Replaces `0`–`9` and leaves everything else — separators, letters, the `m²` in an area
 * string — exactly as it was. That is what lets it run over a whole formatted string
 * ("1,240 m²") rather than over a bare number.
 */
export const faDigits = (value: string | number): string =>
  String(value).replace(/[0-9]/g, d => DIGITS_FA[Number(d)]);
