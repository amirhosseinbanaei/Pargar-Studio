// src/modules/dashboard/actions/taxonomy-actions.ts
'use server';
/**
 * Every write to the `taxonomy_terms` table. Five actions, one shape — the same shape
 * `project-actions.ts` states clause for clause, in the same order, for the same reasons.
 * Read that file's header first; this one records only what is different here.
 *
 * ─── THE FOUR RULES, UNCHANGED ────────────────────────────────────────────────────
 *  1. `readSession()` FIRST, before any parse, so an anonymous caller learns nothing about
 *     the shape the endpoint accepts and no work is done for someone never allowed in.
 *  2. Re-validate against an exact `strictObject` submission schema, answering 422 with
 *     `fieldErrors`.
 *  3. Call a SERVICE through `toActionResult` — never a repository, never a hand-rolled catch.
 *  4. Purge the exact tags, from `cache-tags.ts`, on success only.
 *
 * And they RETURN, never throw: a throw is sanitized crossing the RPC boundary and the
 * status and body the editor branches on would be gone.
 *
 * ─── WHAT IS DIFFERENT: EVERY PURGE IS A PAIR ─────────────────────────────────────
 * A term write invalidates two things, and missing either one is visible to a reader:
 *
 *   `taxonomy-terms`             the option list itself
 *   the SUBJECT's collection tag the rail that composes it with the rows, and the grid
 *
 * The public rails are one cached entry per rail built from BOTH tables (see
 * `getProjectFilters`), so purging only `taxonomy-terms` refreshes an inner read nobody
 * renders directly and leaves the rail exactly as stale as before — the save succeeds, the
 * toast is green, and the retired option is still on the site. `purgeTaxonomy` below is the
 * pair, spelled once, and `taxonomySubjectTag` is what makes the second half impossible to
 * get wrong.
 *
 * ─── NOTHING THAT IS NOT AN ACTION IS EXPORTED ────────────────────────────────────
 * Every export from a `'use server'` file becomes a public POST endpoint with a stable id
 * baked into the client bundle. `requireSession` and `purgeTaxonomy` are module-private for
 * that reason — a `purgeTaxonomy` endpoint would let anyone make the site regenerate at will.
 */
import { z } from 'zod';
import { updateTag } from 'next/cache';
import { CACHE_TAGS, taxonomySubjectTag } from '@/common/services/cache-tags';
import { toActionResult, type ActionResult } from '@/common/services/action-result';
import {
  createTaxonomyTerm,
  deleteTaxonomyTerm,
  listTaxonomyRows,
  moveTaxonomyTerm,
  setTaxonomyTermVisible,
  updateTaxonomyTerm,
} from '@/common/services/taxonomy-service';
import { readSession } from '@/common/services/session';
import {
  taxonomySubjectEnum,
  type TaxonomySubject,
  type TaxonomyTermRow,
} from '@/common/schemas/taxonomy';
import {
  taxonomyTermCreateSubmissionSchema,
  taxonomyTermUpdateSubmissionSchema,
  taxonomyTermVisibilitySubmissionSchema,
} from '../schemas/taxonomy-form';
import { reorderSubmissionSchema } from '../schemas/reorder';

/* ────────────────────────────────────────────────────────────────────────────────
   Shared preconditions — NEITHER IS EXPORTED. See the header.
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * The 401 gate, spelled once. Any session status other than `'valid'` is a 401: anonymous,
 * expired, malformed and forged all get the same answer, because telling someone their
 * signature parsed but their expiry did not is telling them their forgery is close.
 */
async function requireSession(): Promise<{ ok: false; status: number } | null> {
  const session = await readSession();
  return session.status === 'valid' ? null : { ok: false, status: 401 };
}

/** The two-tag purge. Never one without the other — see the header. */
function purgeTaxonomy(subject: TaxonomySubject): void {
  updateTag(CACHE_TAGS.taxonomy);
  updateTag(taxonomySubjectTag(subject));
}

/**
 * The subject a term belongs to, read back from the row the write returned.
 *
 * Every action below purges from THIS rather than from an argument, and that is deliberate:
 * the subject decides which public collection is invalidated, so taking it from the caller
 * would let a crafted POST purge — or fail to purge — the wrong one. The row is the record.
 */
function subjectOf(term: TaxonomyTermRow): TaxonomySubject | null {
  return taxonomySubjectEnum.safeParse(term.subject).data ?? null;
}

/* ────────────────────────────────────────────────────────────────────────────────
   Create
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * Add a term to one axis of one subject.
 *
 * A duplicate `(subject, axis, value)` answers **409**, not 422, and names the field. The
 * distinction matters to the editor: a 422 means "what you typed is malformed", a 409 means
 * "this already exists" — and the second is the one where the useful next action is to go
 * and look at the term that is already there rather than to retype what you just wrote.
 */
export async function createTaxonomyTermAction(
  input: unknown,
): Promise<ActionResult<{ id: number }>> {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = taxonomyTermCreateSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  const result = await toActionResult(() => createTaxonomyTerm({ ...parsed.data, visible: true }));
  if (!result.ok) return result;

  if (result.data.status === 'duplicate') {
    // Named on `value`, so `RecordForm` binds it to the input that caused it rather than
    // dropping it into the form-level region.
    return {
      ok: false,
      status: 409,
      body: { value: [`“${parsed.data.value}” is already a ${parsed.data.axis} term.`] },
    };
  }

  purgeTaxonomy(parsed.data.subject);
  return { ok: true, data: { id: result.data.term.id } };
}

/* ────────────────────────────────────────────────────────────────────────────────
   Update — the labels, and only the labels
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * Change what a term SAYS.
 *
 * `value` is not in the submission schema, so a POST carrying one is refused by
 * `strictObject` rather than silently ignored — which is the difference between an immutable
 * field and one nobody happens to send. See that schema for why it is immutable.
 */
export async function updateTaxonomyTermAction(input: unknown): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = taxonomyTermUpdateSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  const { id, ...labels } = parsed.data;
  const result = await toActionResult(() => updateTaxonomyTerm(id, labels));
  if (!result.ok) return result;

  // `null` — deleted from another tab between opening this row and saving it. A 404 rather
  // than a cheerful success: reporting "saved" for a write that touched nothing is the
  // failure this whole contract exists to make impossible.
  if (result.data === null) return { ok: false, status: 404 };

  const subject = subjectOf(result.data);
  if (subject) purgeTaxonomy(subject);
  return { ok: true, data: undefined };
}

/* ────────────────────────────────────────────────────────────────────────────────
   Visibility — the non-destructive retire
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * Take an option off the public rails, or put it back.
 *
 * ITS OWN ACTION RATHER THAN A FIELD ON THE UPDATE, for the reason the reorder is its own
 * action: this sends an INTENT. Folding it into the label update would make a toggle post
 * the labels too, so flipping a switch would clobber an edit somebody made in another tab
 * between the two page loads — and the person flipping the switch would never know.
 *
 * This is the control an in-use delete points at. It changes no content row, so every record
 * using the term stays reachable and rendered; it only stops the option being offered.
 */
export async function setTaxonomyTermVisibilityAction(input: unknown): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = taxonomyTermVisibilitySubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  const result = await toActionResult(() =>
    setTaxonomyTermVisible(parsed.data.id, parsed.data.visible),
  );
  if (!result.ok) return result;
  if (result.data === null) return { ok: false, status: 404 };

  const subject = subjectOf(result.data);
  if (subject) purgeTaxonomy(subject);
  return { ok: true, data: undefined };
}

/* ────────────────────────────────────────────────────────────────────────────────
   Delete — refused while anything uses it
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * Delete a term, unless records are using it.
 *
 * **409 WITH THE COUNT**, and the count is the whole point. There is no foreign key from a
 * content row to a term — deliberately, so that a row carrying an unknown value degrades
 * rather than disappears — which means the database would accept this delete silently and
 * orphan every row using it: the records keep the value, the value keeps rendering, and the
 * only symptom is an option missing from a rail that nobody can explain.
 *
 * So the service counts first and this refuses, in the same `{ ok: false, status, body }`
 * envelope as every other failure, with the number in the body under a named key. The editor
 * branches on the STATUS and reads that key — never on the sentence — and points the person
 * at the visible toggle, which is what they actually wanted: the option gone from the site,
 * the records intact.
 */
export async function deleteTaxonomyTermAction(input: unknown): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = z.number().int().positive().safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  /**
   * READ BEFORE DELETE, and the only reason is the cache tag — the same reason
   * `deleteProjectAction` reads its row first. After the delete there is no row to learn the
   * subject from, and the subject is what decides which collection tag is purged alongside
   * `taxonomy-terms`.
   */
  const result = await toActionResult(async () => {
    const before = await findTermById(parsed.data);
    const outcome = await deleteTaxonomyTerm(parsed.data);
    return { before, outcome };
  });
  if (!result.ok) return result;

  const { before, outcome } = result.data;

  if (outcome.status === 'in-use') {
    return { ok: false, status: 409, body: { count: outcome.count } };
  }
  if (outcome.status === 'missing') return { ok: false, status: 404 };

  const subject = before ? subjectOf(before) : null;
  if (subject) purgeTaxonomy(subject);
  return { ok: true, data: undefined };
}

/* ────────────────────────────────────────────────────────────────────────────────
   Reorder
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * Move one term within its own axis.
 *
 * The term and the term it now FOLLOWS, never a list of ids in a new order — the same
 * intent-not-an-order rule `moveProjectAction` states, in the shape a drag needs. `null`
 * means first ON THIS AXIS, not first in the table: the axis is the list the editor sees and
 * the only one an anchor is looked up in. See `moveTaxonomyTerm` in the service.
 */
export async function moveTaxonomyTermAction(input: unknown): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = reorderSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  const result = await toActionResult(() => moveTaxonomyTerm(parsed.data.id, parsed.data.afterId));
  if (!result.ok) return result;

  /**
   * `null` is "nothing moved" — an unknown id, an anchor no longer on this axis, or a drop
   * that travelled nowhere. All three are a no-op rather than a failure: reaching here means
   * a stale page or a hand-made request, and the client refreshes onto the truth either way.
   * Nothing changed, so nothing is purged.
   */
  if (result.data === null) return { ok: true, data: undefined };

  purgeTaxonomy(result.data.subject);
  return { ok: true, data: undefined };
}

/* ────────────────────────────────────────────────────────────────────────────────
   A module-private lookup, not an endpoint
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * The term one id names, or `null`.
 *
 * It scans the three subjects rather than adding a `byId` read to the service's public
 * surface, because only this file needs it and every export here is a public endpoint. The
 * table is a few dozen rows.
 */
async function findTermById(id: number): Promise<TaxonomyTermRow | null> {
  const subjects = taxonomySubjectEnum.options;
  const lists = await Promise.all(subjects.map(subject => listTaxonomyRows(subject)));
  return lists.flat().find(term => term.id === id) ?? null;
}
