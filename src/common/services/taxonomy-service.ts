// src/common/services/taxonomy-service.ts
/**
 * RING 3 — what a page or an action calls to read and write the editable taxonomy.
 *
 * Same shape as `project-service.ts`: a cached, public half at the top, an uncached
 * bilingual half for the dashboard below the divider, and its repository is the only thing
 * it imports downward — with one deliberate exception, stated where it happens.
 *
 * ─── CACHING ──────────────────────────────────────────────────────────────────────
 * `'use cache'` + `cacheLife('max')` + `cacheTag(CACHE_TAGS.taxonomy)` on the public read.
 * No timer, for the reason recorded in `project-service.ts`: a term changes when an editor
 * saves and at no other moment, and every term write purges its tags explicitly. The tag
 * comes from `./cache-tags`, never as a literal — a purge under a string that was never set
 * is a no-op, and a no-op purge is invisible until somebody notices the site is stale.
 *
 * ─── WHY THIS SERVICE READS THREE OTHER REPOSITORIES ──────────────────────────────
 * `getTaxonomyUsage` and `deleteTaxonomyTerm` need to know how many CONTENT rows carry a
 * value, which is a question about `projects`, `design_works` and `media` rather than about
 * `taxonomy_terms`. That is the nature of a taxonomy: it is the one resource whose meaning
 * is defined by the rows that reference it. The reads still go downward — a service reading
 * repositories is the sanctioned direction, and the alternative (a service importing three
 * other services) would be sideways and would drag their caching decisions in with it.
 */
import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import {
  SUBJECT_AXES,
  taxonomySubjectEnum,
  type TaxonomyAxis,
  type TaxonomySubject,
  type TaxonomyTermRow,
} from '@/common/schemas/taxonomy';
import { planReorder } from '@/common/utils/reorder';
import * as taxonomyRepo from './taxonomy-repository';
import * as projectRepo from './project-repository';
import * as designWorkRepo from './design-work-repository';
import * as mediaRepo from './media-repository';
import { CACHE_TAGS } from './cache-tags';

/**
 * EVERY term for one subject, in editor order — hidden ones included.
 *
 * This is the only taxonomy read the public site makes, and it deliberately does NOT filter
 * on `visible`, even though the rails only ever offer visible terms. Filtering here was the
 * first implementation and it is wrong, which end-to-end verification caught and reading did
 * not: with only the visible terms in hand, a term an editor had just hidden is
 * indistinguishable from a value nobody ever declared, so `optionsForAxis`' append rule puts
 * it straight back on the rail carrying its raw English value. Hiding would demote a label
 * and change nothing else.
 *
 * So the flag travels with the row and `optionsForAxis` applies it, where the two cases can
 * be told apart. See that function's header for the three-way rule.
 *
 * A CALLER THAT CACHES THE COMPOSITION MUST TAG `CACHE_TAGS.taxonomy` ITSELF. Nesting a
 * cached function inside another does not lift the inner entry's tags onto the outer one:
 * purging `taxonomy-terms` would refresh this function's entry and leave the composed rail
 * exactly as stale as before. `getProjectFilters` spells both tags out for that reason.
 */
export async function getPublicTerms(subject: TaxonomySubject): Promise<TaxonomyTermRow[]> {
  'use cache';
  cacheLife('max');
  cacheTag(CACHE_TAGS.taxonomy);

  return taxonomyRepo.listBySubject(subject);
}

/* ═════════════════════════════════════════════════════════════════════════════════ *
 *  THE DASHBOARD HALF                                                                *
 *                                                                                     *
 *  Everything above this line is a cached read for the public site. Everything below  *
 *  is UNCACHED, for the two reasons `project-service.ts` states at its own divider:    *
 *  the dashboard needs BOTH locales at once — a term editor puts `labelEn` and         *
 *  `labelFa` side by side in one row, which is the whole point of a column pair — and  *
 *  it must never be shown a stale value. An editor shown the label they just replaced  *
 *  cannot tell a stale cache from a failed save, and will save again.                  *
 * ═════════════════════════════════════════════════════════════════════════════════ */

/**
 * Narrow a stored `subject` back to the union, or `null`.
 *
 * The read schema types it as a plain string on purpose (see `schemas/taxonomy.ts`), so
 * this is where that tolerance is paid for rather than cast away. A row naming a subject
 * this app does not have is treated as not found — it belongs to nothing on screen, so
 * there is no correct thing to do with a move or a delete of it, and a cast would have
 * asserted otherwise.
 */
function subjectOf(term: TaxonomyTermRow): TaxonomySubject | null {
  return taxonomySubjectEnum.safeParse(term.subject).data ?? null;
}

/** Every term for one subject, hidden ones included. The editor edits what is there. */
export async function listTaxonomyRows(subject: TaxonomySubject): Promise<TaxonomyTermRow[]> {
  return taxonomyRepo.listBySubject(subject);
}

/** How many content rows carry each value, per axis: `usage.status['Completed'] === 41`. */
export type TaxonomyUsage = Record<string, Record<string, number>>;

/**
 * The count beside every term in the editor, and the number an in-use delete refuses with.
 *
 * A count is the only thing that makes "can I delete this?" answerable without leaving the
 * page — and counting the values the ROWS carry rather than the terms that exist is what
 * makes it also answer "is anything using a value I never declared?", which is the case the
 * rails degrade for.
 *
 * Counted in memory over rows the repositories already parse: 76 projects, 9 design works
 * and 14 media entries. A `GROUP BY` per axis would be three more queries and a second
 * definition of what "uses" means for a JSON array column. Revisit at a few thousand rows.
 */
export async function getTaxonomyUsage(subject: TaxonomySubject): Promise<TaxonomyUsage> {
  const usage: TaxonomyUsage = Object.fromEntries(
    SUBJECT_AXES[subject].map(axis => [axis, {} as Record<string, number>]),
  );

  const tally = (axis: TaxonomyAxis, values: readonly string[]) => {
    const bucket = usage[axis];
    for (const value of values) bucket[value] = (bucket[value] ?? 0) + 1;
  };

  if (subject === 'project') {
    const rows = await projectRepo.list();
    for (const row of rows) {
      // `types` is an ARRAY column: a project counts once against each type it carries.
      // Counting it as one value — or as the joined string — is the same mistake that
      // makes a multi-type project vanish from a type filter, which prompt 4 pinned a test
      // against on the read side.
      tally('type', row.types);
      tally('status', [row.status]);
      tally('scale', [row.scale]);
    }
    return usage;
  }

  if (subject === 'design') {
    const rows = await designWorkRepo.list();
    for (const row of rows) {
      tally('category', [row.category]);
      tally('status', [row.status]);
    }
    return usage;
  }

  const rows = await mediaRepo.list();
  for (const row of rows) tally('type', [row.type]);
  return usage;
}

/* ── The write-time taxonomy check ──────────────────────────────────────────────── */

/** One field of a submission, and the axis its value or values must exist on. */
export interface TaxonomyCheck {
  /** The FORM field name — `status`, `types`, `category`. It is what a 422 must name. */
  field: string;
  axis: TaxonomyAxis;
  values: readonly string[];
}

/**
 * THE WRITE-PATH ENFORCEMENT, in the place that replaced `z.enum`.
 *
 * A Server Action is a public HTTP endpoint and the parse is the only thing standing in
 * front of the database, so something still has to stop a crafted POST writing an arbitrary
 * status. That check cannot be a compile-time enum any more (see `@/common/schemas/enums`),
 * and it cannot live in a zod schema at all, because it needs to read a table — so it lives
 * here, where a service can, and the action reports what it returns.
 *
 * Returns the canonical `{ field: [message] }` envelope every other 422 in this app uses, so
 * `RecordForm` binds it onto the offending input with no new branch anywhere. An empty
 * object means everything checked out.
 *
 * ─── IT CHECKS AGAINST ALL TERMS, VISIBLE OR NOT ──────────────────────────────────
 * Deliberately not `getVisibleTerms`. Hiding a term takes an option off the public rails; it
 * does not retract the value from the records that already carry it, and those records must
 * stay editable and saveable. Checking against the visible set would make every save of an
 * older project fail on a field the editor never touched.
 */
export async function unknownTermErrors(
  subject: TaxonomySubject,
  checks: readonly TaxonomyCheck[],
): Promise<Record<string, string[]>> {
  const terms = await taxonomyRepo.listBySubject(subject);
  const declared = new Set(terms.map(term => `${term.axis} ${term.value}`));

  const errors: Record<string, string[]> = {};
  for (const check of checks) {
    const unknown = check.values.filter(value => !declared.has(`${check.axis} ${value}`));
    if (unknown.length > 0) {
      // Names the values AND where to add them. A bare "invalid" would leave an editor
      // guessing which of three types was the problem.
      errors[check.field] = [
        `${unknown.map(value => `“${value}”`).join(', ')} ${
          unknown.length === 1 ? 'is not a' : 'are not'
        } ${check.axis} term. Add it in the taxonomy editor above the list first.`,
      ];
    }
  }
  return errors;
}

/* ── Writes ────────────────────────────────────────────────────────────────────────
   Thin, like every other service's writes. The ACTION re-authorizes, re-validates and
   purges the two cache tags; the REPOSITORY parses the row back. What is here is the
   arithmetic neither of them can do: where a new term goes, what "one position up" means,
   and whether a delete is allowed at all.
   ──────────────────────────────────────────────────────────────────────────────────── */

/** A create either lands or collides with the unique index on (subject, axis, value). */
export type TaxonomyCreateOutcome =
  { status: 'created'; term: TaxonomyTermRow } | { status: 'duplicate'; term: TaxonomyTermRow };

/**
 * Add a term to an axis, placed LAST.
 *
 * Last rather than first, which is the opposite of `createProject` — and the difference is
 * the point. A project is an archive entry and the newest belongs at the top; an option list
 * has an authored order that a reader learns, and dropping a new option at the head of it
 * displaces every position they already know. The arrows move it from there.
 *
 * The duplicate is checked HERE rather than left to the unique index, so the editor gets a
 * field-level message naming the existing term instead of an opaque constraint error. The
 * index is still the backstop for the race between this read and the insert — see the
 * repository.
 */
export async function createTaxonomyTerm(input: {
  subject: TaxonomySubject;
  axis: TaxonomyAxis;
  value: string;
  labelEn: string;
  labelFa: string;
  visible: boolean;
}): Promise<TaxonomyCreateOutcome> {
  const existing = await taxonomyRepo.listBySubject(input.subject);

  const collision = existing.find(term => term.axis === input.axis && term.value === input.value);
  if (collision) return { status: 'duplicate', term: collision };

  const onAxis = existing.filter(term => term.axis === input.axis);
  const last = onAxis.length === 0 ? -1 : Math.max(...onAxis.map(term => term.sortOrder));

  const term = await taxonomyRepo.create({ ...input, sortOrder: last + 1 });
  return { status: 'created', term };
}

/**
 * Change what a term SAYS, never what it is.
 *
 * `value` is not a parameter and cannot become one without the transaction described in
 * AGENTS.md's resolved decision: a rename has to rewrite every content row holding the old
 * string in the same transaction, and a partial rename is data corruption behind a green
 * toast. `null` when the id is gone — a concurrent delete, not an error.
 */
export async function updateTaxonomyTerm(
  id: number,
  input: { labelEn: string; labelFa: string },
): Promise<TaxonomyTermRow | null> {
  return taxonomyRepo.update(id, input);
}

/** The non-destructive way to take an option off the site. `null` when the id is gone. */
export async function setTaxonomyTermVisible(
  id: number,
  visible: boolean,
): Promise<TaxonomyTermRow | null> {
  return taxonomyRepo.update(id, { visible });
}

/**
 * What happened to a delete. Three outcomes, because two of them are not failures of the
 * same kind: `missing` is a stale page, `in-use` is a refusal with a reason and a number.
 */
export type TaxonomyDeleteOutcome =
  { status: 'deleted' } | { status: 'missing' } | { status: 'in-use'; count: number };

/**
 * Delete a term, unless records are using it.
 *
 * DELETING AN IN-USE TERM WOULD SILENTLY ORPHAN ROWS. Nothing would break loudly — there is
 * no foreign key, by design — and that is exactly the problem: the records keep their value,
 * the value keeps rendering, and the only symptom is that the option is gone from the rail
 * and nobody can explain why. So it is refused, with the count, and the editor points at the
 * visible toggle, which does what the person actually wanted without touching a row.
 *
 * The count comes from `getTaxonomyUsage`, so the number in the refusal is the same number
 * the editor was already showing beside the term.
 */
export async function deleteTaxonomyTerm(id: number): Promise<TaxonomyDeleteOutcome> {
  const term = await taxonomyRepo.byId(id);
  if (!term) return { status: 'missing' };

  const subject = subjectOf(term);
  if (!subject) return { status: 'missing' };

  const usage = await getTaxonomyUsage(subject);
  const count = usage[term.axis]?.[term.value] ?? 0;
  if (count > 0) return { status: 'in-use', count };

  return (await taxonomyRepo.remove(id)) ? { status: 'deleted' } : { status: 'missing' };
}

/**
 * Move one term WITHIN ITS OWN AXIS.
 *
 * Within its axis is the whole subtlety: the table holds every axis of every subject, so the
 * row physically above a project `status` term may be a project `type` term. Reordering
 * against the table's order rather than the axis's would move two options that never appear
 * in the same list — which is also why the anchor is looked up among the SIBLINGS below and
 * an `afterId` naming a term on another axis is rejected as unknown.
 *
 * The action sends `{ id, afterId }` — the term and the term it now follows, `null` for
 * first. `planReorder` in `common/utils/reorder.ts` carries the reasoning for that shape and
 * for renumbering by index rather than swapping two values; the tie-repair half matters more
 * here than anywhere else, because every term starts at the column default of 0 and ties are
 * the NORMAL state of a freshly seeded axis.
 *
 * `null` for an unknown id, an anchor no longer on this axis, or a drop that travelled
 * nowhere. All three are "nothing happened" rather than failures.
 */
export async function moveTaxonomyTerm(
  id: number,
  afterId: number | null,
): Promise<{ moved: TaxonomyTermRow; subject: TaxonomySubject } | null> {
  const term = await taxonomyRepo.byId(id);
  if (!term) return null;

  const subject = subjectOf(term);
  if (!subject) return null;

  const siblings = (await taxonomyRepo.listBySubject(subject)).filter(
    row => row.axis === term.axis,
  );

  const plan = planReorder(siblings, id, afterId);
  if (!plan) return null;

  // Write only what changed: two rows on a settled axis, more on one with ties to repair.
  await Promise.all(
    plan.writes.map(write => taxonomyRepo.update(write.row.id, { sortOrder: write.sortOrder })),
  );

  return { moved: plan.moved, subject };
}
