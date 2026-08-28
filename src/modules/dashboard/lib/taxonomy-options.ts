// src/modules/dashboard/lib/taxonomy-options.ts
/**
 * Turning `taxonomy_terms` rows into the options a dashboard `<select>` or checkbox group
 * renders. Two functions, three consumers — the project, design-work and media forms.
 *
 * Promoted here on the SECOND consumer rather than copied a third time
 * (`references/01-layering-and-boundaries.md` §6). Written out per form they would be three
 * places for the same two decisions to drift: whether a hidden term is offered, and how a
 * value with no term is displayed. Both decisions have a reason and both are load-bearing.
 *
 * It stays in `modules/dashboard/lib/` and not in `common/utils/` because it carries English
 * INTERFACE COPY — `· hidden`, `· no term` — and the dashboard is the only English-only
 * surface in this app. `common/utils/taxonomy.ts` holds the copy-free half, which the public
 * rails share.
 */
import type { TaxonomyAxis, TaxonomyTermRow, TermOption } from '@/common/schemas/taxonomy';

/**
 * The declared options for one axis, in the dashboard's English.
 *
 * HIDDEN TERMS ARE INCLUDED, marked. Hiding takes an option off the PUBLIC rails; it does
 * not retract the value from the records that carry it, and those records must stay
 * editable — which is why the write-time check accepts a hidden term too (see
 * `unknownTermErrors`). Marking one costs a word; excluding it would cost a save that fails
 * on a field the editor never touched, on every older record using a retired term.
 */
export function axisOptions(terms: readonly TaxonomyTermRow[], axis: TaxonomyAxis): TermOption[] {
  return terms
    .filter(term => term.axis === axis)
    .map(term => ({
      value: term.value,
      label: term.visible ? term.labelEn : `${term.labelEn} · hidden`,
    }));
}

/**
 * A `TermOption` as the `ds/` controls want it — a label that is always a string.
 *
 * `label` is `null` only for a value the record itself carries that no term declares, which
 * `withCurrentValues` merges in. It is displayed, marked, rather than silently disappearing
 * from a control: an option a select cannot render is a field that comes back blank and gets
 * rewritten by the next save, on a value the editor never touched.
 */
export function toControlOptions(
  options: readonly TermOption[],
): Array<{ value: string; label: string }> {
  return options.map(option => ({
    value: option.value,
    label: option.label ?? `${option.value} · no term`,
  }));
}
