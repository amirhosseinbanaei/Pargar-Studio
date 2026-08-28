// src/common/utils/taxonomy.ts
/**
 * Turning terms plus the values rows actually carry into a rail's option list.
 *
 * Pure, and deliberately so: this is the exact rule the public filter rails degrade by, it
 * is easy to get subtly wrong in a way nothing else in the gate would notice, and it is
 * testable in milliseconds with no database and no React tree.
 *
 * ─── IT IS `project-service.ts`'s `order()` HELPER, WITH TERMS AS THE CANON ────────
 * Before prompt 9 the canonical order came from a frozen array in `enums.ts` and the rule
 * was: keep the canonical values that some row actually uses, in canonical order, then
 * append anything else the rows carry rather than dropping it. Both halves survive, with the
 * terms table as the canon:
 *
 *  - **Presence still gates.** A term nothing uses is not offered. That is the decision
 *    AGENTS.md recorded in prompt 2 — a hardcoded list "offers a filter matching nothing the
 *    first time a category empties" — and making a term visible does not repeal it. The
 *    `visible` flag is a VETO over that set, not a way to force an empty option onto a rail:
 *    an option beside a `0` is a control that teaches the reader to ignore controls.
 *  - **An UNDECLARED value is APPENDED, never dropped.** A row whose status has no term at
 *    all still filters, still counts, and still appears in the rail carrying its raw value.
 *    A value that vanishes from every rail is a set of records nobody can filter to, and
 *    `enums.ts` has argued since prompt 2 that an unrecognized value must stay visible rather
 *    than be substituted or blanked.
 *
 * ─── WHY THIS TAKES EVERY TERM AND FILTERS `visible` ITSELF ───────────────────────
 * It would be tidier for the service to hand over only the visible terms, and it is WRONG —
 * caught by end-to-end verification, not by reading. With only the visible ones in hand, a
 * term an editor had just hidden looks identical to a value nobody ever declared, so the
 * append rule puts it straight back onto the rail with its raw English value. Hiding a term
 * would then demote its label and change nothing else.
 *
 * The two cases have to be told apart, and only the full term list can tell them apart:
 *
 *   declared + visible + used   → offered, with its label
 *   declared + HIDDEN           → not offered at all, whatever the rows say
 *   not declared at all + used  → appended, unlabelled, so its records stay reachable
 */
import { termLabel, type TaxonomyTermRow, type TermOption } from '@/common/schemas/taxonomy';
import type { Locale } from '@/common/schemas/locale';

/**
 * The option list for one axis.
 *
 * `terms` must be EVERY term for this subject and axis — hidden ones included, see the
 * header — ordered by `sortOrder`. Ordering is the query's job, because this function must
 * not be able to disagree with the order the editor's arrows write.
 *
 * `present` is every value the rows carry on that axis, repeats included; a project's `types`
 * column contributes several per row.
 *
 * `locale` defaults to English rather than being required, because the ordering and the
 * inclusion rules — the parts worth testing and the parts that break a rail — are the same in
 * both languages, and every real caller passes one.
 */
export function optionsForAxis(
  terms: readonly TaxonomyTermRow[],
  present: readonly string[],
  locale: Locale = 'en',
): TermOption[] {
  const used = new Set(present);
  // Every DECLARED value, hidden ones included — a hidden term is declared, so it must not
  // fall through to the append branch below and reappear as a raw value.
  const declared = new Set(terms.map(term => term.value));

  const known: TermOption[] = terms
    .filter(term => term.visible && used.has(term.value))
    .map(term => ({ value: term.value, label: termLabel(term, locale) }));

  // Sorted, because there is no authored order for a value nobody declared — and an order
  // that changes with whichever row was read first would make two identical requests
  // produce two different rails.
  const unknown: TermOption[] = [...used]
    .filter(value => !declared.has(value))
    .sort()
    .map(value => ({ value, label: null }));

  return [...known, ...unknown];
}

/**
 * The option list for a dashboard SELECT: every declared term, plus whatever this record
 * already holds.
 *
 * Different rule from the rail above, for a different job. A rail describes what a reader
 * can usefully filter to; a form describes what this record may be set to, and it must not
 * silently drop a value the record already carries — a select whose value is not among its
 * options renders blank, and saving that form would then quietly rewrite the field the
 * editor never touched.
 */
export function withCurrentValues(
  options: readonly TermOption[],
  current: readonly string[],
): TermOption[] {
  const declared = new Set(options.map(option => option.value));
  const extra = [...new Set(current)]
    .filter(value => value !== '' && !declared.has(value))
    .sort()
    .map(value => ({ value, label: null }));
  return [...options, ...extra];
}
