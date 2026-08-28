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
 *   taxonomy-terms  (one tag for every subject — see below)
 *
 * A write then purges precisely: editing one project purges `projects` (the index and the
 * filter taxonomy, which are derived from every row) and `project:<slug>` (its detail
 * page), and touches nothing else. The alternative — `revalidatePath('/')` — throws away
 * every cached page in the app to publish one paragraph.
 *
 * ─── taxonomy-terms IS PURGED IN PAIRS ────────────────────────────────────────────
 * Prompt 9 made every closed axis a row in `taxonomy_terms`, and one tag covers all three
 * subjects: the table is small, every editor screen reads the whole subject at once, and a
 * per-subject tag would be three names to forget instead of one.
 *
 * THE RULE THAT MATTERS IS THE SECOND TAG. A term write purges `taxonomy-terms` AND the
 * COLLECTION tag of the subject the term belongs to — `projects`, `design-works` or
 * `media` — because the public filter rails are a composition of both tables: the option
 * list comes from the terms and the counts beside it come from the rows, and both are
 * cached in one entry per rail. Purging only `taxonomy-terms` updates nothing the reader
 * can see; purging only the collection tag updates the grid while the rail above it keeps
 * offering the option that was just retired. `taxonomySubjectTag` below exists so the pair
 * cannot be spelled by hand and got wrong.
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
  /** Every editable taxonomy axis, for every subject. Purged in a PAIR — see above. */
  taxonomy: 'taxonomy-terms',
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/** `project:qeytarieh-08-residence` */
export const projectTag = (slug: string) => `project:${slug}`;

/** `design-work:kavan-identity` */
export const designWorkTag = (slug: string) => `design-work:${slug}`;

/** `media:archdaily-qeytarieh-08-residence` */
export const mediaTag = (slug: string) => `media:${slug}`;

/**
 * The COLLECTION tag of the content table a taxonomy subject names.
 *
 * This is the second half of the two-tag purge rule above, expressed as a total function so
 * a new subject cannot be added without deciding which collection it invalidates. It maps a
 * `subject` — the discriminator on `taxonomy_terms`, not a table name — onto the tag the
 * rows it describes are cached under.
 */
export const taxonomySubjectTag = (subject: 'project' | 'design' | 'media'): CacheTag =>
  subject === 'project'
    ? CACHE_TAGS.projects
    : subject === 'design'
      ? CACHE_TAGS.designWorks
      : CACHE_TAGS.media;
