// src/modules/dashboard/schemas/shared.ts
/**
 * Pieces shared by more than one of this module's write schemas.
 *
 * Design works and media both carry a year field with identical bounds. Promoted here on
 * the SECOND consumer (`references/01-layering-and-boundaries.md`) — into a file inside
 * `dashboard`, not into `common/`, because nothing outside this module's write side needs
 * any of it.
 *
 * ─── `fallbackText` AND `fallbackList` USED TO LIVE HERE. PROMPT 14 DELETED THEM ───
 * They implemented "duplicate English into an empty Persian column on save", the decision
 * AGENTS.md recorded for prompts 6 and 7 and which prompt 14 reverses. A required field is
 * required in both languages now: the Persian half of a required pair carries `.min(1)` in
 * its own form schema, and a Persian LIST left empty beside a non-empty English one is
 * refused by `requireTranslatedList` in `./image` rather than silently duplicated.
 *
 * The reasoning for both, and the consequence — an editor can no longer save an
 * English-only record — is in `./image`'s header and in AGENTS.md.
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
 * A required TEXT field — non-empty once whitespace is discounted, and never trimmed.
 *
 * ─── WHY NOT `.min(1)` ────────────────────────────────────────────────────────────
 * `.min(1)` counts characters, so `'   '` passes it. That was harmless while an empty
 * Persian column was filled from the English one on save — `fallbackText` did the trimming,
 * in its emptiness TEST — but prompt 14 removed the fallback, and a `.min(1)` required
 * field would accept three spaces and store them. A Persian page would then render a
 * whitespace title with nothing anywhere reporting it, which is exactly the silent failure
 * that whole change exists to prevent.
 *
 * ─── AND WHY IT DOES NOT TRIM ─────────────────────────────────────────────────────
 * `.refine`, deliberately not `.trim()`. Several stored Persian values carry meaningful
 * zero-width non-joiners (AGENTS.md), and a transform that trimmed on the way in would
 * damage them silently on every save. The test is on a trimmed COPY; the value that reaches
 * the column is whatever the editor typed.
 */
export function requiredText(message: string) {
  return z.string().refine(value => value.trim() !== '', message);
}
