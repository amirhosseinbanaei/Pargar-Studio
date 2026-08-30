// src/common/services/schema.ts
/**
 * The libSQL/SQLite table definitions — the shape of the database, and nothing else.
 *
 * This module is deliberately import-light (`drizzle-orm/sqlite-core` only): it is read
 * by `db.ts`, by every repository, by `drizzle-kit generate` and by the seed script,
 * which runs outside Next entirely. Anything else added here would be dragged into all
 * four.
 *
 * ─── BILINGUAL COLUMNS, NOT A TRANSLATIONS TABLE ──────────────────────────────────
 * Every translated field is a PAIR of columns on one row (`title_en`, `title_fa`), per
 * the decision recorded in AGENTS.md. The legacy site merged an English record with a
 * Persian overlay at render time (`legacy/js/core/i18n.js:154`), so English and Persian
 * were always one logical record; a join table would model a relationship that does not
 * exist, and would make every read a join for a site where both locales are always
 * authored together.
 *
 * ─── TAXONOMY VALUES ARE NOT TRANSLATED HERE ──────────────────────────────────────
 * `status`, `scale`, `types`, `category` and media `type` are single canonical English
 * columns. Their Persian is a UI dictionary, not content: `legacy/data/i18n.js:193-215`
 * maps `type.Residential` -> `مسکونی` for the whole interface. Storing a translated
 * status per record — as `legacy/data/works.fa.js` redundantly does for design works —
 * would give 76 places for one word to drift.
 *
 * STILL TRUE AFTER PROMPT 9, with one addition. A content row's taxonomy column is still a
 * single canonical English string and is still never per-locale. What prompt 9 added is
 * `taxonomy_terms` at the foot of this file: ONE row per option, carrying the per-locale
 * LABEL for that option. So the translation moved from the message catalog to a table an
 * editor can change — it did not move onto the 76 content rows, and the count of places one
 * word can drift is still one.
 *
 * ─── JSON COLUMNS ─────────────────────────────────────────────────────────────────
 * Stored as TEXT holding a JSON string, never `mode: 'json'`. drizzle's json mode
 * `JSON.parse`s and hands back `unknown`-shaped data that the caller must cast; a cast is
 * an unverifiable claim. These columns are parsed by the zod schemas in
 * `@/common/schemas/` instead, which is a claim the runtime enforces.
 *
 * ─── IMAGE COLUMNS (prompt 10) ────────────────────────────────────────────────────
 * A record that takes a picture carries a nullable TEXT `cover_image` holding the path
 * `/api/media` serves it from, plus a per-locale `cover_alt_en` / `cover_alt_fa` pair. The
 * path column is nullable and NULL is the correct value for every row that exists today:
 * 76 projects genuinely have no photograph, and a record with no image keeps the drawing
 * `common/lib/art/` generates from its slug.
 *
 * ALT TEXT IS A COLUMN PAIR because it is CONTENT — it is a sentence a reader hears in
 * their own language, so it translates like every other translated field and not like a
 * taxonomy value. It is nullable in the DATABASE and required by the WRITE schemas whenever
 * an image is present; the constraint is cross-field ("required if"), which SQLite cannot
 * express as a column type and which belongs with the other write rules regardless.
 *
 * A GALLERY is a per-locale pair of JSON columns, per the rule immediately below. See
 * `projects.gallery_en`.
 *
 * ─── TIMESTAMPS ───────────────────────────────────────────────────────────────────
 * Stored as INTEGER unix-epoch seconds (`mode: 'timestamp'`), which sorts correctly as a
 * number and needs no string-format agreement between writer and reader.
 */
import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** Applied to every row at insert; `updated_at` is re-stamped by the update repository. */
const NOW = sql`(unixepoch())`;

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(NOW),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(NOW),
};

/* ═══════════════════════════════════════════════════════════════════════════════
   projects — the 76-record archive, 2013–2025 (legacy/data/projects.js)
   ═══════════════════════════════════════════════════════════════════════════════ */

export const projects = sqliteTable(
  'projects',
  {
    /**
     * The legacy numeric id is kept as the primary key so a slug rename never orphans a
     * record. `autoIncrement` is on for rows the dashboard creates later; SQLite accepts
     * an explicit id on insert and advances its sequence past it, so the seed and the
     * dashboard can share one column.
     */
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull(),

    /** JSON string array — a project carries MORE THAN ONE type (`['Residential', 'Interior Design']`). */
    types: text('types').notNull(),
    status: text('status').notNull(),
    scale: text('scale').notNull(),
    year: integer('year').notNull(),
    /** Free text, not a number: the legacy values carry their unit and grouping (`'4,180 m²'`). */
    area: text('area').notNull(),
    /** Seeded from the legacy array order (reverse-chronological); the dashboard edits it. */
    sortOrder: integer('sort_order').notNull().default(0),

    titleEn: text('title_en').notNull(),
    titleFa: text('title_fa').notNull(),
    blurbEn: text('blurb_en').notNull(),
    blurbFa: text('blurb_fa').notNull(),
    descriptionEn: text('description_en').notNull(),
    descriptionFa: text('description_fa').notNull(),
    locationEn: text('location_en').notNull(),
    locationFa: text('location_fa').notNull(),
    clientEn: text('client_en').notNull(),
    clientFa: text('client_fa').notNull(),

    /**
     * The cover photograph's stored path, or NULL for a project with no photograph — which
     * is every row in the archive today. NULL is not a gap to fill: the card and the detail
     * page fall back to the drawing generated from the slug, which is what those pages have
     * always shown.
     */
    coverImage: text('cover_image'),
    /** Required whenever `cover_image` is set — enforced by the write schemas, not here. */
    coverAltEn: text('cover_alt_en'),
    coverAltFa: text('cover_alt_fa'),
    /**
     * The ordered gallery: a JSON string array of `{ path, alt }`, per locale.
     *
     * TEXT holding JSON, never `mode: 'json'` — the rule at the top of this file. The
     * ORDER is the array's order and is what the dashboard's arrow controls change.
     *
     * The two columns are INDEX-ALIGNED, the same convention `studio.founders` already
     * uses: item `i` is the same photograph in both, and only its `alt` differs. That
     * alignment is not left to an editor's care — the dashboard edits ONE list holding both
     * alt texts and splits it into these two columns on save, so the paths and the order
     * have exactly one author and cannot desync.
     */
    galleryEn: text('gallery_en'),
    galleryFa: text('gallery_fa'),

    ...timestamps,
  },
  table => [uniqueIndex('projects_slug_unique').on(table.slug)],
);

/* ═══════════════════════════════════════════════════════════════════════════════
   design_works — 9 records (legacy/data/works.js:10)
   ═══════════════════════════════════════════════════════════════════════════════ */

export const designWorks = sqliteTable(
  'design_works',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull(),
    category: text('category').notNull(),
    year: integer('year').notNull(),
    status: text('status').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),

    titleEn: text('title_en').notNull(),
    titleFa: text('title_fa').notNull(),
    blurbEn: text('blurb_en').notNull(),
    blurbFa: text('blurb_fa').notNull(),
    clientEn: text('client_en').notNull(),
    clientFa: text('client_fa').notNull(),
    scopeEn: text('scope_en').notNull(),
    scopeFa: text('scope_fa').notNull(),
    materialsEn: text('materials_en').notNull(),
    materialsFa: text('materials_fa').notNull(),
    descriptionEn: text('description_en').notNull(),
    descriptionFa: text('description_fa').notNull(),
    /** JSON string array of names. */
    teamEn: text('team_en').notNull(),
    teamFa: text('team_fa').notNull(),
    /** JSON array of `{ k, v }` — translated in full (legacy/data/works.fa.js:28). */
    factsEn: text('facts_en').notNull(),
    factsFa: text('facts_fa').notNull(),

    /** Same four columns as `projects`, same reasons — see there. */
    coverImage: text('cover_image'),
    coverAltEn: text('cover_alt_en'),
    coverAltFa: text('cover_alt_fa'),
    galleryEn: text('gallery_en'),
    galleryFa: text('gallery_fa'),

    ...timestamps,
  },
  table => [uniqueIndex('design_works_slug_unique').on(table.slug)],
);

/* ═══════════════════════════════════════════════════════════════════════════════
   media — 14 records (legacy/data/works.js:273)
   ═══════════════════════════════════════════════════════════════════════════════ */

export const media = sqliteTable(
  'media',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull(),
    /** Publication | Award | Lecture | Exhibition. */
    type: text('type').notNull(),
    year: integer('year').notNull(),
    /**
     * The related project's slug, or NULL for the four entries about the practice rather
     * than a building. Deliberately NOT a foreign key: a project may be un-published or
     * re-slugged from the dashboard, and a press cutting about it does not stop existing
     * when that happens. The join is resolved in the service, tolerating a miss.
     */
    projectSlug: text('project_slug'),
    sortOrder: integer('sort_order').notNull().default(0),

    titleEn: text('title_en').notNull(),
    titleFa: text('title_fa').notNull(),
    /**
     * Translated in some records and left in Latin script in others — `works.fa.js:283`
     * keeps "ArchDaily" as-is. Both columns exist even though many pairs are identical,
     * because which ones differ is content, not a rule.
     */
    outletEn: text('outlet_en').notNull(),
    outletFa: text('outlet_fa').notNull(),
    blurbEn: text('blurb_en').notNull(),
    blurbFa: text('blurb_fa').notNull(),
    /**
     * NULLABLE, and the only nullable text pair in the content model. Five of the fourteen
     * entries are awards and carry `author: null` in `legacy/data/works.js` — an award has
     * no byline, which is a fact about the record and not a missing value. Storing `''`
     * would erase the difference between "nobody wrote it" and "we forgot to enter who".
     */
    authorEn: text('author_en'),
    authorFa: text('author_fa'),
    excerptEn: text('excerpt_en').notNull(),
    excerptFa: text('excerpt_fa').notNull(),
    contextEn: text('context_en').notNull(),
    contextFa: text('context_fa').notNull(),
    /** JSON array of `{ k, v }`. */
    factsEn: text('facts_en').notNull(),
    factsFa: text('facts_fa').notNull(),

    /**
     * A COVER ONLY, and no gallery. A media entry is a press cutting or an award notice —
     * one image at most, and often none: with no cover of its own the card and the detail
     * page keep the drawing seeded from the RELATED PROJECT rather than from the entry, so
     * a cutting about a building carries the building's picture (AGENTS.md).
     */
    coverImage: text('cover_image'),
    coverAltEn: text('cover_alt_en'),
    coverAltFa: text('cover_alt_fa'),

    ...timestamps,
  },
  table => [uniqueIndex('media_slug_unique').on(table.slug)],
);

/* ═══════════════════════════════════════════════════════════════════════════════
   studio — ONE row, the editorial block (legacy/data/studio.js:25)
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Singleton. The id is pinned to 1 by a CHECK constraint rather than by convention, so a
 * second row is a database error and not a page that silently renders whichever row came
 * back first.
 */
export const studio = sqliteTable(
  'studio',
  {
    id: integer('id').primaryKey(),

    manifestoEn: text('manifesto_en').notNull(),
    manifestoFa: text('manifesto_fa').notNull(),
    /**
     * JSON `{ name, role, born, bio, image, imageAlt }[]`.
     *
     * A PORTRAIT LIVES INSIDE THE EXISTING STRUCTURE rather than in new columns, because a
     * founder is already a row of this array and a parallel `founder_portraits` column
     * would have to stay index-aligned with it by hand. `image` is the stored path (`''`
     * for a founder with no photograph, who keeps the generated portrait); `imageAlt` is
     * the per-locale sentence, which is per-locale for free because these two columns
     * already are.
     *
     * The IMAGE has one author: the dashboard offers the uploader on the English side only
     * and the save copies each `image` across to the Persian array by index. So the two
     * arrays can differ in their `imageAlt` — which is the point — and never in which
     * photograph a founder has.
     */
    foundersEn: text('founders_en').notNull(),
    foundersFa: text('founders_fa').notNull(),
    /** JSON `{ label, value }[]`. */
    statsEn: text('stats_en').notNull(),
    statsFa: text('stats_fa').notNull(),
    /** JSON `string[]` — 22 names. */
    teamEn: text('team_en').notNull(),
    teamFa: text('team_fa').notNull(),
    /** JSON `string[]` — 40 names. */
    alumniEn: text('alumni_en').notNull(),
    alumniFa: text('alumni_fa').notNull(),
    /** JSON `{ year, title, project, body }[]`. */
    awardsEn: text('awards_en').notNull(),
    awardsFa: text('awards_fa').notNull(),
    /** JSON `{ year, text }[]`. */
    chaptersEn: text('chapters_en').notNull(),
    chaptersFa: text('chapters_fa').notNull(),

    ...timestamps,
  },
  table => [check('studio_singleton', sql`${table.id} = 1`)],
);

/* ═══════════════════════════════════════════════════════════════════════════════
   contact — ONE row, the editable content of the public contact page
   (legacy/data/studio.js:165 + legacy/data/studio.fa.js:109)
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * Which fields are per-locale is NOT a guess: it mirrors `CONTACT_FA` exactly. That object
 * translates `address`, `district`, `city`, `country`, `hours`, `socials` and `careers`
 * and nothing else, so everything else is a single shared column.
 *
 * `socials` is per-locale despite being structured data, because the Persian layer
 * translates the platform NAMES (`اینستاگرام`) while keeping the handles identical.
 *
 * Singleton, pinned the same way `studio` is.
 */
export const contact = sqliteTable(
  'contact',
  {
    id: integer('id').primaryKey(),

    /* Shared — identical in both locales, and wrong to duplicate. A postcode or an email
       address translated per locale is a second value that can drift from the real one. */
    postcode: text('postcode').notNull(),
    phone: text('phone').notNull(),
    /** The `tel:` target: digits only, no spaces or punctuation. */
    phoneHref: text('phone_href').notNull(),
    email: text('email').notNull(),
    press: text('press').notNull(),
    /**
     * Stored as TEXT, not REAL. A latitude is an exact decimal the studio typed, and a
     * float round-trip turns `35.8112` into `35.811199999999999` in a map URL.
     */
    lat: text('lat').notNull(),
    lng: text('lng').notNull(),

    /* Per-locale — present in CONTACT_FA. */
    addressEn: text('address_en').notNull(),
    addressFa: text('address_fa').notNull(),
    districtEn: text('district_en').notNull(),
    districtFa: text('district_fa').notNull(),
    cityEn: text('city_en').notNull(),
    cityFa: text('city_fa').notNull(),
    countryEn: text('country_en').notNull(),
    countryFa: text('country_fa').notNull(),
    hoursEn: text('hours_en').notNull(),
    hoursFa: text('hours_fa').notNull(),
    careersEn: text('careers_en').notNull(),
    careersFa: text('careers_fa').notNull(),
    /** JSON `{ name, handle }[]`. */
    socialsEn: text('socials_en').notNull(),
    socialsFa: text('socials_fa').notNull(),

    ...timestamps,
  },
  table => [check('contact_singleton', sql`${table.id} = 1`)],
);

/* ═══════════════════════════════════════════════════════════════════════════════
   contact_messages — the INBOUND side: submissions from the public form
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * The other half of "contacts": `contact` above is editable page CONTENT, this is the
 * inbox. Written by the public form in prompt 5, read by the dashboard in prompt 7.
 *
 * No per-locale columns, deliberately: a visitor writes in whichever language they choose
 * and there is nothing to translate. `read_at` is nullable because "unread" is the absence
 * of a read time, not a boolean that can disagree with one.
 */
export const contactMessages = sqliteTable('contact_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(NOW),
  readAt: integer('read_at', { mode: 'timestamp' }),
});

/* ═══════════════════════════════════════════════════════════════════════════════
   index_cards — the WORDS AND THE PICTURE on each of the five columns (prompt 13)
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * FIVE ROWS, FOREVER, KEYED ON THE NAV IDS. This is a bounded reversal of the decision in
 * `common/constants/site.ts`, and the boundary is the whole design.
 *
 * That file says the wordmark and the five section ids are CHROME: they are referenced by
 * the route tree, by `.col[data-id]` in the ported CSS and by the shell transition, so
 * making them editable would let a dashboard save delete a route. That reasoning is
 * correct and stands. `id`, `path`, `art` and `seed` are still constants and nobody can
 * edit them.
 *
 * What is NOT chrome is the words on the card and the picture behind it, and that is what
 * this table holds. `section_id` is the PRIMARY KEY and it is one of the five NAV ids: the
 * table can never gain a sixth row that means anything, and deleting a row deletes CONTENT,
 * never a route — the column keeps rendering, from the message catalog.
 *
 * ─── EVERY COLUMN DEGRADES, AND THE ROW ITSELF IS OPTIONAL ────────────────────────
 * `title_*` and `caption_*` are `NOT NULL DEFAULT ''` rather than nullable, because `''`
 * is what an empty form control holds and one spelling of "nothing" is enough. An empty
 * value — or a missing row entirely — falls back to `nav.<id>` / `cap.<id>` in the message
 * catalog, which is exactly what the columns showed before this table existed. That is why
 * seeding it is a convenience rather than a requirement, and why a column can never render
 * blank. See `index-card-service.ts`.
 *
 * ─── THE IMAGE TRIO IS PROMPT 10'S, UNCHANGED ─────────────────────────────────────
 * The same three columns `projects`, `design_works` and `media` carry, so the uploader,
 * the stored-path pattern, the alt rule and `/api/media` all apply with nothing added.
 * A column with no picture keeps its generated drawing — the decision recorded for records
 * in prompt 10, taken the same way here for the same reason.
 */
export const indexCards = sqliteTable('index_cards', {
  /** One of the five ids in `NAV`. Not an autoincrement id: the identity is the section. */
  sectionId: text('section_id').primaryKey(),

  titleEn: text('title_en').notNull().default(''),
  titleFa: text('title_fa').notNull().default(''),
  captionEn: text('caption_en').notNull().default(''),
  captionFa: text('caption_fa').notNull().default(''),

  /** The trio from prompt 10 — see `projects.cover_image` for all of it. */
  coverImage: text('cover_image'),
  coverAltEn: text('cover_alt_en'),
  coverAltFa: text('cover_alt_fa'),

  ...timestamps,
});

/* ═══════════════════════════════════════════════════════════════════════════════
   taxonomy_terms — every closed axis, for every subject, in ONE table (prompt 9)
   ═══════════════════════════════════════════════════════════════════════════════ */

/**
 * The editable replacement for the frozen arrays in `@/common/schemas/enums.ts`.
 *
 * Until prompt 9 every taxonomy was an `as const` array in code and the write schemas
 * enforced it with `z.enum`, so adding a category, retiring one, reordering the options or
 * changing a Persian label were all code edits and a deploy — from a dashboard that exists
 * so the studio would not need one. A term is a row now, and the arrays survive only as
 * this table's seed source (that file's header says so).
 *
 * ─── ONE TABLE, NOT ONE PER SUBJECT ───────────────────────────────────────────────
 * `subject` + `axis` discriminate: project type/status/scale, design category/status, media
 * type. The axes differ but the SHAPE does not — a value, two labels, a position, a flag —
 * so three tables would be three migrations, three repositories and three editors for one
 * change, and the editor component would still have to branch on which one it was reading.
 *
 * ─── THE UNIQUE INDEX IS LOAD-BEARING ─────────────────────────────────────────────
 * (`subject`, `axis`, `value`) is the identity of a term: it is the triple a content row's
 * stored string resolves against. Without the index two rows can claim one value, and then
 * the option list renders it twice, the usage count is attributed to whichever was read
 * first, and deleting one leaves the other — with no error anywhere. A UNIQUE constraint
 * turns all of that into one loud failure at the moment of the second insert.
 *
 * ─── THERE IS DELIBERATELY NO FOREIGN KEY ─────────────────────────────────────────
 * A content row stores the canonical English STRING, not a term id, for exactly the reason
 * `media.project_slug` above gives: a term may be hidden, or may be deleted from a database
 * shell, or may never have existed for a value some older row carries — and a row holding
 * an unrecognized value must DEGRADE (render its raw value, still be filterable) rather
 * than disappear or fail a foreign-key check. `enums.ts` has argued that since prompt 2 and
 * the read schemas type these columns as a plain string to make it true.
 *
 * ─── `labelEn` / `labelFa` ARE CONTENT, NOT INTERFACE COPY ────────────────────────
 * This is the one place the "taxonomy values are NOT translated here" note above is
 * qualified. The stored VALUE is still one canonical English string per row and is still
 * not per-locale; what is per-locale is the label an editor may now change, which is why it
 * is a column pair like every other translated field rather than a key in the message
 * catalog. The catalog stays as the fallback for a value with no term.
 */
export const taxonomyTerms = sqliteTable(
  'taxonomy_terms',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** `project` | `design` | `media` — which content table's rows carry this value. */
    subject: text('subject').notNull(),
    /** `type` | `status` | `scale` | `category` — which column of that table. */
    axis: text('axis').notNull(),
    /**
     * The canonical English string a content row actually stores — `'Interior Design'`,
     * `'Under Construction'`. IMMUTABLE after creation (AGENTS.md): renaming it would have
     * to rewrite every content row holding the old string inside the same transaction, and
     * a partial rename is data corruption behind a green toast. The labels carry any change.
     */
    value: text('value').notNull(),
    labelEn: text('label_en').notNull(),
    labelFa: text('label_fa').notNull(),
    /**
     * The order options appear in, within one (`subject`, `axis`) group. Seeded from the
     * position in the `enums.ts` array, which is deliberate and not alphabetical, and
     * renumbered from the index by `moveTaxonomyTerm` for the same reason `moveProject`
     * does it: a swap is a silent no-op the moment two rows share a value.
     */
    sortOrder: integer('sort_order').notNull().default(0),
    /**
     * Shown on the public filter rails. `false` retires an option WITHOUT touching the rows
     * that use it — they stay reachable and rendered, which is what makes this the
     * non-destructive answer to "can I get rid of this?" and the thing an in-use delete
     * points at.
     */
    visible: integer('visible', { mode: 'boolean' }).notNull().default(true),

    ...timestamps,
  },
  table => [
    uniqueIndex('taxonomy_terms_identity_unique').on(table.subject, table.axis, table.value),
  ],
);
