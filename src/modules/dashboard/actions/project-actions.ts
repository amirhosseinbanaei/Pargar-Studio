// src/modules/dashboard/actions/project-actions.ts
'use server';
/**
 * Every write to the `projects` table. Five actions, one shape.
 *
 * ─── THE FOUR RULES, IN THE ORDER THEY RUN ────────────────────────────────────────
 * Each of these appears in every action below without exception, and each is here because
 * skipping it produces a specific, expensive failure:
 *
 *  1. **RE-AUTHORIZE from the session.** A Server Action is a public HTTP endpoint with a
 *     stable id baked into the client bundle: it can be POSTed to with `curl`, without a
 *     browser, without a form, and without ever passing through `src/proxy.ts`. The proxy's
 *     redirect is a UX gate; THIS is the authorization. The check runs FIRST, before the
 *     parse, so an anonymous caller learns nothing about the shape the endpoint accepts and
 *     no parsing work is done for someone who was never allowed in. Never "fix" a 401 that
 *     surprises a test by moving this below the parse — mock the session instead.
 *  2. **RE-VALIDATE against the exact write schema.** The form validated these values a
 *     keystroke ago with a localized schema, and that proves nothing here. `strictObject`
 *     means an unexpected key is refused rather than tolerated, which is what stops a
 *     crafted POST from smuggling `sortOrder` or `id` into a mass assignment.
 *  2b. **CHECK THE TAXONOMY AGAINST THE TABLE.** `types`, `status` and `scale` were
 *     `z.enum(...)` until prompt 9 and are plain strings now, because the closed set became
 *     editable rows — a compile-time enum would reject a type the studio added five minutes
 *     ago. `checkTaxonomy` is that check, and it answers in the same 422 envelope naming the
 *     same field, so nothing downstream changed. See `@/common/schemas/enums`'s header.
 *  3. **CALL A SERVICE through `toActionResult`.** Never a repository, never a query. And
 *     never a hand-rolled try/catch: `toActionResult` is the one place a server-side throw
 *     becomes a result, so twelve actions cannot end up with twelve guesses at the shape.
 *  4. **PURGE THE EXACT TAGS, only on success.** See below.
 *
 * ─── THEY RETURN, THEY NEVER THROW ────────────────────────────────────────────────
 * An error thrown inside a Server Action is serialized and SANITIZED crossing the RPC
 * boundary: in production the client receives a generic `Error` with an opaque digest, and
 * the HTTP status, the response body and the field errors are all gone. Rollback can then
 * no longer tell "409, refetch" from "422, keep the form open", and a 422's field errors
 * can no longer be bound back onto the inputs that caused them. A plain object survives
 * serialization intact — that is the entire reason `ActionResult` is a value.
 *
 * ─── `updateTag`, NOT `revalidateTag` ─────────────────────────────────────────────
 * `updateTag` expires immediately and the SAME request reads fresh, which is what makes the
 * dashboard show the change the moment it is saved. `revalidateTag` serves the stale value
 * while it refreshes in the background — for a reader that is a good trade, and for an
 * editor it looks exactly like a save that did not work, so they save again.
 *
 * If a `revalidateTag` call is ever genuinely needed here, it must pass a cache-life profile
 * as its second argument. The single-argument form is deprecated on Next 16 and still
 * compiles, which is precisely why it survives code review.
 *
 * ─── THE TAG STRINGS COME FROM `cache-tags.ts` ────────────────────────────────────
 * Never as literals. A tag SET under one string and PURGED under another is a no-op:
 * nothing errors, the save succeeds, the dashboard is green, and the public page keeps
 * serving the old content until the next deploy. Silent staleness is the worst class of
 * caching bug because the only symptom is somebody eventually noticing.
 */
import { z } from 'zod';
import { updateTag } from 'next/cache';
import { CACHE_TAGS, projectTag } from '@/common/services/cache-tags';
import { toActionResult, type ActionResult } from '@/common/services/action-result';
import {
  createProject,
  deleteProject,
  getProjectRowById,
  moveProject,
  updateProject,
} from '@/common/services/project-service';
import { readSession } from '@/common/services/session';
import { checkTaxonomy } from '../lib/taxonomy-guard';
import { projectSubmissionSchema, withPersianFallback } from '../schemas/project-form';
import { reorderSubmissionSchema } from '../schemas/reorder';

/* ────────────────────────────────────────────────────────────────────────────────
   Shared preconditions

   NEITHER OF THESE IS EXPORTED. Every export from a `'use server'` file becomes a public
   POST endpoint with a stable id baked into the client bundle, so exporting a helper "just
   for reuse" publishes it — and `purgeProject` in particular would be an endpoint anyone
   could call to make the site regenerate any page it likes.
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * The 401 gate, spelled once so no action can forget a clause of it.
 *
 * It returns the failure result rather than a boolean, so the call site reads
 * `const denied = await requireSession(); if (denied) return denied;` — a shape the compiler
 * checks. A `if (!(await isAuthorized())) return { ok: false, status: 401 }` would put the
 * status literal back in five places.
 *
 * ANY session status other than `'valid'` is a 401: anonymous, expired, malformed and
 * forged all get the same answer. The distinction is useful to the server (`readSession`
 * keeps it) and must never be useful to the caller — telling someone their signature parsed
 * but their expiry did not is telling them their forgery is close.
 */
async function requireSession(): Promise<{ ok: false; status: number } | null> {
  const session = await readSession();
  return session.status === 'valid' ? null : { ok: false, status: 401 };
}

/**
 * Purge everything a change to one project invalidates.
 *
 * `projects` covers the archive index AND the derived filter taxonomy — `getProjectFilters`
 * is computed from every row, so adding a project with a type nobody had used before must
 * make that option appear. `project:<slug>` covers the detail page.
 *
 * `previousSlug` is the half that is easy to miss and expensive to miss. A rename leaves the
 * OLD instance tag holding a cached detail page under a URL that no longer resolves;
 * purging only the new slug leaves that page cached forever. Passing both is the whole fix,
 * and it is why `updateProjectAction` reads the record before it writes it.
 */
function purgeProject(slug: string, previousSlug?: string): void {
  updateTag(CACHE_TAGS.projects);
  updateTag(projectTag(slug));
  if (previousSlug && previousSlug !== slug) updateTag(projectTag(previousSlug));
}

/* ────────────────────────────────────────────────────────────────────────────────
   Create
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * `input` is `unknown` on purpose. Typing it as the form's values would be a comment rather
 * than a check — the caller controls what it sends, and the parse below is what makes the
 * type true.
 *
 * Returns the new record's slug so the form can navigate to its edit page. It does NOT
 * `redirect()` itself: the form is tier 2, so it resets its own state first, and an action
 * that sometimes redirects and sometimes returns a failure has to keep `redirect()` outside
 * every `try` forever.
 */
export async function createProjectAction(input: unknown): Promise<ActionResult<{ slug: string }>> {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = projectSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  /*
   * THE TAXONOMY CHECK — clause 2b in the header. Not a schema rule any more, because the
   * closed set is editable rows; same 422 envelope, same field names.
   */
  const invalid = await checkTaxonomy('project', [
    { field: 'types', axis: 'type', values: parsed.data.types },
    { field: 'status', axis: 'status', values: [parsed.data.status] },
    { field: 'scale', axis: 'scale', values: [parsed.data.scale] },
  ]);
  if (invalid) return invalid;

  const result = await toActionResult(() => createProject(withPersianFallback(parsed.data)));
  // Inside `if (result.ok)`: purging on a failed write throws away a valid cache and makes
  // every reader pay for a refetch that changes nothing.
  if (result.ok) purgeProject(result.data.slug);

  return result.ok ? { ok: true, data: { slug: result.data.slug } } : result;
}

/* ────────────────────────────────────────────────────────────────────────────────
   Update
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * `id` is the RECORD, not the caller. That distinction is what the "never accept an
 * identity as an argument" rule is about: an action must never take a user, tenant or owner
 * id, because the caller controls every argument and the session is the only input it cannot
 * forge. Which project to edit is legitimately the caller's to choose — there is one
 * administrator and every project is theirs.
 */
export async function updateProjectAction(
  id: number,
  input: unknown,
): Promise<ActionResult<{ slug: string }>> {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = projectSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  /*
   * THE TAXONOMY CHECK — clause 2b in the header. Not a schema rule any more, because the
   * closed set is editable rows; same 422 envelope, same field names.
   */
  const invalid = await checkTaxonomy('project', [
    { field: 'types', axis: 'type', values: parsed.data.types },
    { field: 'status', axis: 'status', values: [parsed.data.status] },
    { field: 'scale', axis: 'scale', values: [parsed.data.scale] },
  ]);
  if (invalid) return invalid;

  /**
   * READ BEFORE WRITE, and the only reason is the cache tag.
   *
   * A slug change has to purge BOTH `project:<old>` and `project:<new>`, and after the
   * update has landed the old slug exists nowhere — not in the row, not in the payload, not
   * in the URL the form posted from. Purging only the new one leaves the detail page cached
   * under a URL that no longer resolves, indefinitely, with `cacheLife('max')` behind it.
   * One extra read buys the one fact the purge cannot reconstruct.
   */
  const result = await toActionResult(async () => {
    const before = await getProjectRowById(id);
    if (!before) return null;
    const after = await updateProject(id, withPersianFallback(parsed.data));
    return after ? { after, previousSlug: before.slug } : null;
  });
  if (!result.ok) return result;

  /**
   * `null` means the row is gone — deleted from another tab between loading this form and
   * saving it. A 404 rather than a success: reporting "saved" for a write that touched
   * nothing is the failure this whole contract exists to make impossible.
   */
  if (result.data === null) return { ok: false, status: 404 };

  purgeProject(result.data.after.slug, result.data.previousSlug);
  return { ok: true, data: { slug: result.data.after.slug } };
}

/* ────────────────────────────────────────────────────────────────────────────────
   Delete
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * Deletes the row outright. There is no `deleted_at` column and no undo window — that would
 * be a schema change, and it is recorded as a decision in AGENTS.md rather than left
 * implied. The confirmation dialog in front of this is the only safety net, which is
 * exactly why it names the project it is about to remove.
 *
 * The slug is looked up BEFORE the delete, because after it there is no row to read it from
 * and the instance tag would go unpurged — leaving `/en/projects/<slug>` cached and serving
 * a project that no longer exists.
 */
export async function deleteProjectAction(id: number): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = z.number().int().positive().safeParse(id);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  const result = await toActionResult(async () => {
    const row = await getProjectRowById(parsed.data);
    if (!row) return null;
    return (await deleteProject(parsed.data)) ? row.slug : null;
  });

  if (!result.ok) return result;
  // Already gone. A 404 rather than a cheerful success, so a stale list that still shows
  // the row says so instead of quietly appearing to delete it a second time.
  if (result.data === null) return { ok: false, status: 404 };

  purgeProject(result.data);
  return { ok: true, data: undefined };
}

/* ────────────────────────────────────────────────────────────────────────────────
   Reorder
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * Move one project to the position a drag or a keyboard move left it in.
 *
 * The SERVER computes what that means. The payload is the record that moved and the record it
 * now FOLLOWS — see `../schemas/reorder` for why that beats an index and why it is not the
 * whole ordering, and `moveProject` in the service for the renumbering itself.
 *
 * EVERY renumbered row's instance tag is purged, not just the moved one's. A drag from
 * position 3 to position 17 rewrites `sortOrder` on fourteen rows in between, and a cached
 * read of any of them is now describing a row that changed. Purging a tag that did not
 * strictly need it costs one regeneration; missing one costs a page that is wrong until the
 * next deploy.
 */
export async function moveProjectAction(input: unknown): Promise<ActionResult> {
  const denied = await requireSession();
  if (denied) return denied;

  const parsed = reorderSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  const result = await toActionResult(() => moveProject(parsed.data.id, parsed.data.afterId));
  if (!result.ok) return result;

  /**
   * `null` is "nothing moved" — an unknown id, an anchor deleted in another tab, or a drop
   * back where the row already was. All three are a no-op rather than a failure: reaching
   * here means a stale page or a hand-made request, and neither deserves an error screen.
   * The client refreshes on this success and sees the order the database actually holds,
   * which is exactly what a stale drop needs. Nothing changed, so nothing is purged.
   */
  if (result.data === null) return { ok: true, data: undefined };

  updateTag(CACHE_TAGS.projects);
  for (const row of result.data.changed) updateTag(projectTag(row.slug));
  return { ok: true, data: undefined };
}
