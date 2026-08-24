// src/common/services/cache-tags.ts
/**
 * THE CACHE TAG VOCABULARY. Every `cacheTag()` in this codebase and every `updateTag()` in
 * prompts 6 and 7 comes from this file.
 *
 * The failure it exists to prevent: a tag that is SET under one string and PURGED under
 * another. Nothing errors — `updateTag('project')` against a cache tagged `'projects'`
 * simply does nothing — so the dashboard saves, the toast is green, and the public page
 * keeps serving the old content until the next deploy. Silent staleness is the worst class
 * of caching bug because the only symptom is somebody eventually noticing.
 *
 * Making the strings functions rather than literals means a typo is a compile error at the
 * purge site instead of a no-op at runtime.
 *
 * ─── THE CONVENTION ───────────────────────────────────────────────────────────────
 * One COLLECTION tag per entity, plus one INSTANCE tag per record:
 *
 *   projects        project:<slug>
 *   design-works    design-work:<slug>
 *   media           media:<slug>
 *   studio          (singleton — no instance tag)
 *   contact         (singleton — no instance tag)
 *   contact-messages (not cached at all — see below)
 *
 * A write then purges precisely: editing one project purges `projects` (the index and the
 * filter taxonomy, which are derived from every row) and `project:<slug>` (its detail
 * page), and touches nothing else. The alternative — `revalidatePath('/')` — throws away
 * every cached page in the app to publish one paragraph.
 *
 * ─── contact-messages IS DECLARED BUT NEVER CACHED ────────────────────────────────
 * The inbox must be dynamic: a dashboard that shows a cached message list can show zero
 * unread while a message is sitting in the database. The tag exists so that a future
 * cached read — an unread COUNT in the shell, say — has a name to use, and so prompts 6
 * and 7 have one place to look for it.
 */

export const CACHE_TAGS = {
  projects: 'projects',
  designWorks: 'design-works',
  media: 'media',
  studio: 'studio',
  contact: 'contact',
  /** Declared for completeness; no read service caches it. */
  contactMessages: 'contact-messages',
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/** `project:qeytarieh-08-residence` */
export const projectTag = (slug: string) => `project:${slug}`;

/** `design-work:kavan-identity` */
export const designWorkTag = (slug: string) => `design-work:${slug}`;

/** `media:archdaily-qeytarieh-08-residence` */
export const mediaTag = (slug: string) => `media:${slug}`;
