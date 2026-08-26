// src/modules/dashboard/schemas/shared.ts
/**
 * Pieces shared by more than one of this module's write schemas.
 *
 * Design works and media both carry a year field with identical bounds, and every area
 * prompt 7 adds inherits `project-form.ts`'s "duplicate English into an empty Persian
 * column" fallback (AGENTS.md, prompt 6's resolved decision). Promoted here on the SECOND
 * consumer (`references/01-layering-and-boundaries.md`) — into a file inside `dashboard`,
 * not into `common/`, because nothing outside this module's write side needs any of it.
 */
import { z } from 'zod';

/**
 * The form side: validates the STRING a number input holds. See `project-form.ts` for why
 * this never transforms and never uses `z.coerce.number()` — the reasoning is identical and
 * is not repeated per resource.
 */
export function yearFieldAsString(min: number, max: number) {
  const message = `A four-digit year between ${min} and ${max}.`;
  return z
    .string()
    .regex(/^\d{4}$/, message)
    .refine(value => {
      const year = Number(value);
      return year >= min && year <= max;
    }, message);
}

/** The submission side: accept the string the form sends OR a number, and store a number. */
export function yearFieldAsNumber(min: number, max: number) {
  return z
    .union([z.number(), z.string().regex(/^\d+$/, 'expected a year')])
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));
}

/**
 * Fill an empty Persian TEXT column with its English counterpart. `.trim()` on the test
 * only, never on the stored value — see `project-form.ts`'s `withPersianFallback` for why
 * (several seeded Persian values carry meaningful zero-width non-joiners).
 */
export function fallbackText(fa: string, en: string): string {
  return fa.trim() === '' ? en : fa;
}

/**
 * The same idea one level up, for a translated LIST column (`team`, `facts`, `founders`…):
 * an untouched Persian array duplicates the English one wholesale rather than being saved
 * empty. Per-item content is not filled in — an editor who adds a row and leaves it blank
 * gets the blank row back, exactly as a lone Persian text field left blank would.
 */
export function fallbackList<T>(fa: readonly T[], en: readonly T[]): T[] {
  return fa.length === 0 ? [...en] : [...fa];
}
