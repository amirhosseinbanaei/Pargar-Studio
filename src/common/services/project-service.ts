// src/common/services/project-service.ts
/**
 * RING 3 — what a page calls to read projects.
 *
 * Imports its repository and nothing else. It never touches `db`, never builds a query,
 * and never parses a row: skipping ring 2 is exactly how an unvalidated row reaches a
 * component.
 *
 * ─── CACHING ──────────────────────────────────────────────────────────────────────
 * Every read here is a Cache Components function: `'use cache'` + `cacheLife` + `cacheTag`.
 *
 * `cacheLife('max')` — no timer. This is studio content: it changes when an editor saves
 * in the dashboard and at no other moment, and every dashboard write purges its tags
 * explicitly (prompt 6). A shorter profile would re-run the query on a schedule to
 * discover, almost always, that nothing had changed — while STILL needing the purge for
 * the case that matters, because a five-minute-stale project page after a save is a bug
 * regardless of the profile. See AGENTS.md.
 *
 * The tags come from `./cache-tags`, never as literals — a purge under a string that was
 * never set is a no-op, and a no-op purge is invisible.
 *
 * ─── LOCALE ───────────────────────────────────────────────────────────────────────
 * `locale` is a cache-key argument, so `en` and `fa` are cached separately. That is the
 * point of collapsing the bilingual row HERE rather than in a component: a page receives
 * exactly the strings it renders, and the other locale's copy is never serialized into the
 * RSC payload.
 */
import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { projectStatusValues, projectScaleValues, projectTypeValues } from '@/common/schemas/enums';
import {
  toLocaleProject,
  type Project,
  type ProjectCreate,
  type ProjectRow,
  type ProjectUpdate,
} from '@/common/schemas/project';
import type { Locale } from '@/common/schemas/locale';
import * as projectRepo from './project-repository';
import { CACHE_TAGS, projectTag } from './cache-tags';

/** The whole archive, in `sort_order` (seeded reverse-chronological). */
export async function listProjects(locale: Locale): Promise<Project[]> {
  'use cache';
  cacheLife('max');
  cacheTag(CACHE_TAGS.projects);

  const rows = await projectRepo.list();
  return rows.map(row => toLocaleProject(row, locale));
}

/**
 * `null`, not a throw, for a slug that does not exist. The route turns that into
 * `notFound()`; a service that threw would make the 404 path an exception path.
 *
 * Tagged with BOTH the collection and the instance: editing this project purges
 * `project:<slug>`, and deleting any project purges `projects`, which correctly drops a
 * detail page whose record no longer exists.
 */
export async function getProject(slug: string, locale: Locale): Promise<Project | null> {
  'use cache';
  cacheLife('max');
  cacheTag(CACHE_TAGS.projects, projectTag(slug));

  const row = await projectRepo.bySlug(slug);
  return row ? toLocaleProject(row, locale) : null;
}

/**
 * The filter taxonomy for the projects index — DERIVED from the rows that exist, not
 * hardcoded.
 *
 * This is what `legacy/data/projects.js:424` already did for `type`
 * (`TYPES.filter(t => PROJECTS.some(p => p.type.includes(t)))`) and this extends the same
 * rule to the other three axes. A hardcoded list goes stale in both directions: it offers
 * a filter that matches nothing the first time a category empties, and it silently hides a
 * project the first time the dashboard introduces a type nobody listed.
 *
 * Ordering is the canonical one from `@/common/schemas/enums` — the legacy arrays are in a
 * deliberate order, not alphabetical — with any value not in that list appended rather
 * than dropped, so an unknown value is visible instead of invisible.
 *
 * Labels are NOT here. `'Type'` and `'Residential'` are copy; the UI dictionary ported in
 * prompt 4 translates them.
 */
export async function getProjectFilters(): Promise<{
  types: string[];
  statuses: string[];
  scales: string[];
  years: string[];
}> {
  'use cache';
  cacheLife('max');
  cacheTag(CACHE_TAGS.projects);

  const rows = await projectRepo.list();

  return {
    types: order(
      projectTypeValues,
      rows.flatMap(row => row.types),
    ),
    statuses: order(
      projectStatusValues,
      rows.map(row => row.status),
    ),
    scales: order(
      projectScaleValues,
      rows.map(row => row.scale),
    ),
    // Newest first, as strings: these are filter option VALUES compared against a query
    // parameter, and `String(year)` is what the URL carries.
    years: [...new Set(rows.map(row => row.year))].sort((a, b) => b - a).map(String),
  };
}

/**
 * Distinct values actually present, in canonical order, with unknowns appended.
 * Module-private: it is a detail of the taxonomy above, not part of the service surface.
 */
function order(canonical: readonly string[], present: readonly string[]): string[] {
  const seen = new Set(present);
  const known = canonical.filter(value => seen.has(value));
  const unknown = [...seen].filter(value => !canonical.includes(value)).sort();
  return [...known, ...unknown];
}

/* ═════════════════════════════════════════════════════════════════════════════════ *
 *  THE DASHBOARD HALF (prompt 6)                                                     *
 *                                                                                     *
 *  Everything above this line is a cached, locale-collapsed READ for the public site. *
 *  Everything below is bilingual and UNCACHED, because the dashboard is a different    *
 *  kind of consumer with two requirements the public reads cannot satisfy.            *
 * ═════════════════════════════════════════════════════════════════════════════════ */

/**
 * THE FIRST REQUIREMENT: BOTH LOCALES AT ONCE.
 *
 * `toLocaleProject` collapses a row to one language, which is exactly right for a page and
 * exactly wrong for an editor. The dashboard edits `titleEn` and `titleFa` side by side in
 * one form — that is the whole reason the schema uses per-locale columns instead of a
 * translations table (AGENTS.md), and it is what makes translating a project one save
 * rather than two. So these return the raw `ProjectRow`.
 *
 * THE SECOND REQUIREMENT: NO CACHE, EVER.
 *
 * No `'use cache'`, no `cacheLife`, no `cacheTag` anywhere below. An editor who saves and
 * is then shown the value they just replaced has no way to tell a stale cache from a failed
 * save, and will save again. The public reads are cached with `cacheLife('max')` precisely
 * BECAUSE the writes below purge their tags explicitly; caching the editor's own view of
 * the same data would put a second copy behind the same purge and get the timing wrong.
 *
 * There is nothing to tag here for the same reason `contact-message-service.ts` tags
 * nothing: a cache that does not exist has nothing to purge.
 */
export async function listProjectRows(): Promise<ProjectRow[]> {
  return projectRepo.list();
}

/**
 * `null`, not a throw, for a slug that does not exist — the edit route turns that into
 * `notFound()`. Keyed by SLUG rather than id so the dashboard's edit URL is the same
 * identifier the public detail page uses, and so a person can read the address bar and
 * know which project they are editing.
 */
export async function getProjectRow(slug: string): Promise<ProjectRow | null> {
  return projectRepo.bySlug(slug);
}

/**
 * The same row, found by id.
 *
 * The write actions need this and the routes do not: an action is handed the record's id,
 * and before it updates or deletes it must know the CURRENT slug in order to purge that
 * record's instance tag. On a rename the old slug exists nowhere else by the time the write
 * has landed, and a detail page cached under it would stay cached forever at a URL that no
 * longer resolves.
 *
 * It scans the list rather than adding a `byId` query to the repository, and that is a
 * deliberate trade at this size: the archive is 76 rows already in memory for every other
 * read on the page, and one more indexed lookup is not worth a repository function that
 * exists solely for it. Revisit if the table ever grows past a few thousand rows.
 */
export async function getProjectRowById(id: number): Promise<ProjectRow | null> {
  return (await projectRepo.list()).find(row => row.id === id) ?? null;
}

/* ── Writes ────────────────────────────────────────────────────────────────────────
   Thin by design. The rules that make a write correct live on either side of this ring:
   the ACTION re-authorizes, re-validates against the exact write schema and purges the
   cache tags; the REPOSITORY encodes the JSON column and parses the row back. A service
   that grew its own copy of either would be a third place to keep in sync.

   No `updateTag` here, and that is deliberate rather than an oversight. Purging is the
   ACTION's job (`references/04-actions-and-mutations.md` §8): only the action knows
   whether the write is part of a larger operation, and only the action knows the OLD slug
   a rename has to purge alongside the new one. A service that purged on its own would
   also purge on every call made from a script or a future batch job, where there is no
   request to serve fresh.
   ──────────────────────────────────────────────────────────────────────────────────── */

/**
 * `sortOrder` is NOT part of the input, and that is the point: position is not a field an
 * editor types, it is the result of the reorder control below. A form that offered a
 * "sort order" number would let one save silently push another project out of place.
 *
 * A new project is placed FIRST. `sortOrder` is the legacy array position and the archive
 * is ordered reverse-chronologically (AGENTS.md), so the newest work belongs at the top —
 * of the dashboard list and of `/en/projects` alike. It is done by taking one less than the
 * current minimum rather than by renumbering all 77 rows, which costs one extra read
 * instead of seventy-six extra writes; `moveProject` renumbers from zero the first time
 * anything is dragged, so the negative value is transient.
 */
export async function createProject(input: Omit<ProjectCreate, 'sortOrder'>): Promise<ProjectRow> {
  const rows = await projectRepo.list();
  const leading = rows.length === 0 ? 0 : Math.min(...rows.map(row => row.sortOrder)) - 1;
  return projectRepo.create({ ...input, sortOrder: leading });
}

/** `null` when the id no longer exists — a concurrent delete, not an error. */
export async function updateProject(id: number, input: ProjectUpdate): Promise<ProjectRow | null> {
  return projectRepo.update(id, input);
}

/** `true` if a row was deleted, `false` if the id was already gone. */
export async function deleteProject(id: number): Promise<boolean> {
  return projectRepo.remove(id);
}

/**
 * Move one project one position within the archive's order, and return the row it moved.
 *
 * THE ORDER IS COMPUTED HERE, NOT SENT BY THE CLIENT. The action receives an id and a
 * direction, and this function reads the current order and works out what that means. The
 * alternative — the client posting the full list of ids in its new order — is what a drag
 * interface would want, and it is strictly worse for a pair of arrow buttons: the payload
 * carries 76 numbers that must be re-validated, and a list the client assembled from a
 * page it loaded five minutes ago silently reverts every change made in between.
 *
 * WHY IT RENUMBERS FROM THE INDEX RATHER THAN SWAPPING TWO VALUES. Swapping the two rows'
 * `sortOrder` values is one update fewer and is wrong the moment two rows share a value —
 * the swap is then a no-op and the arrow button appears broken with nothing in the logs.
 * Renumbering by position is total: it repairs ties as a side effect, and only the rows
 * whose number actually changed are written, so the common case is still two updates.
 *
 * Returns `null` when the id is unknown, or when the move has nowhere to go (already first
 * and asked to move up). Both are "nothing happened", not failures — the caller renders the
 * boundary arrows disabled anyway, and a 404 for clicking a disabled button is noise.
 */
export async function moveProject(
  id: number,
  direction: 'up' | 'down',
): Promise<{ moved: ProjectRow; displaced: ProjectRow } | null> {
  // `list()` is already ordered by `sortOrder`, which is what makes index arithmetic
  // meaningful here rather than a guess about how the rows arrived.
  const rows = await projectRepo.list();
  const from = rows.findIndex(row => row.id === id);
  if (from === -1) return null;

  const to = direction === 'up' ? from - 1 : from + 1;
  if (to < 0 || to >= rows.length) return null;

  const reordered = [...rows];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);

  // Write only what changed. On a single move that is the two rows that traded places,
  // even though the loop considers all of them — and on a list with pre-existing ties it
  // is however many it takes to make the order unambiguous again.
  await Promise.all(
    reordered.flatMap((row, index) =>
      row.sortOrder === index ? [] : [projectRepo.update(row.id, { sortOrder: index })],
    ),
  );

  return { moved, displaced: rows[to] };
}
