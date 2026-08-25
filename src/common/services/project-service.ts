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
import { toLocaleProject, type Project } from '@/common/schemas/project';
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
