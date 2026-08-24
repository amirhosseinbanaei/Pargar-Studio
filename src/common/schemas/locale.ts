// src/common/schemas/locale.ts
/**
 * The two locales this site is authored in, and the one function that collapses a
 * bilingual database row down to one of them.
 *
 * Content is stored as PER-LOCALE COLUMN PAIRS on a single row (`title_en`, `title_fa`) —
 * see `@/common/services/schema`. Repositories return that full bilingual row; a mapper
 * per resource, built on `pickLocale` below, produces the single-locale shape a page
 * renders. The mappers live beside the schemas rather than in a component, so "which
 * column does the Persian page read?" has exactly one answer per resource instead of one
 * per component.
 *
 * This module imports zod and nothing else — client components reach it through the form
 * schemas, and one `server-only` anywhere in that graph would break the client build.
 */
import { z } from 'zod';

/** Exported as an ARRAY as well as a schema: option lists and route params consume it. */
export const localeValues = ['en', 'fa'] as const;

export const localeSchema = z.enum(localeValues);

export type Locale = z.infer<typeof localeSchema>;

/** The right-to-left locale, which the shell needs for `dir` and for glyph splitting. */
export const RTL_LOCALE: Locale = 'fa';

/**
 * Choose the column for a locale.
 *
 * There is deliberately NO fallback branch here — no `fa || en`. The seed writes the
 * English value into the `_fa` column wherever a Persian translation is missing
 * (`scripts/seed.ts`), so by the time a row reaches this function both columns are
 * populated and a fallback would only mask a genuinely empty field written by the
 * dashboard. Degradation belongs at the point content is authored, not at every read.
 */
export function pickLocale<T>(locale: Locale, en: T, fa: T): T {
  return locale === 'fa' ? fa : en;
}
