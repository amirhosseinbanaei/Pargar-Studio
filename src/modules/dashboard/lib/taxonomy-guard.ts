// src/modules/dashboard/lib/taxonomy-guard.ts
/**
 * The write-time taxonomy check, as one clause a content action can drop in.
 *
 * ─── WHY IT IS HERE AND NOT IN EACH ACTION FILE ───────────────────────────────────
 * Three actions files need the identical five lines, and this is a PLAIN module rather than
 * a sixth export from any of them. Every export from a `'use server'` file becomes a public
 * POST endpoint with a stable id in the client bundle, so a helper exported "just for reuse"
 * from `project-actions.ts` would be an endpoint that reports whether an arbitrary string is
 * a term — reachable by anyone, with no session behind it. Importing a plain module into
 * three `'use server'` files publishes nothing.
 *
 * ─── WHAT IT REPLACED ─────────────────────────────────────────────────────────────
 * `z.enum(projectStatusValues)` in the submission schema. That was the only thing standing
 * between a crafted POST and an arbitrary status, and it stopped being usable the moment
 * terms became editable: a status added five minutes ago would be rejected as invalid by
 * code that shipped last week. The check is a table lookup now, in the service, and this is
 * where its answer becomes the same `{ ok: false, status: 422, body: fieldErrors }` envelope
 * every other validation failure in the app already uses — so `RecordForm` binds it onto the
 * offending input with no new branch anywhere.
 *
 * IT RUNS AFTER THE SCHEMA PARSE, NOT INSTEAD OF IT. The schema still refuses an unexpected
 * key, a missing field and an empty string; this only answers "is that string a term".
 */
import 'server-only';
import { toActionResult, type ActionResult } from '@/common/services/action-result';
import { unknownTermErrors, type TaxonomyCheck } from '@/common/services/taxonomy-service';
import type { TaxonomySubject } from '@/common/schemas/taxonomy';

/**
 * `null` when every value checks out; otherwise the failure result to return as-is.
 *
 * The call site reads `const invalid = await checkTaxonomy(...); if (invalid) return invalid;`
 * — the same shape as the `requireSession()` gate above it, and a shape the compiler checks.
 *
 * A database failure during the lookup comes back as the normalized result `toActionResult`
 * produces rather than as a throw, because this runs inside an action and an action never
 * throws for an expected failure.
 */
export async function checkTaxonomy(
  subject: TaxonomySubject,
  checks: readonly TaxonomyCheck[],
): Promise<ActionResult<never> | null> {
  const errors = await toActionResult(() => unknownTermErrors(subject, checks));
  if (!errors.ok) return errors;
  if (Object.keys(errors.data).length === 0) return null;
  return { ok: false, status: 422, body: errors.data };
}
