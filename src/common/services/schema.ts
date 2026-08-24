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
 * ─── JSON COLUMNS ─────────────────────────────────────────────────────────────────
 * Stored as TEXT holding a JSON string, never `mode: 'json'`. drizzle's json mode
 * `JSON.parse`s and hands back `unknown`-shaped data that the caller must cast; a cast is
 * an unverifiable claim. These columns are parsed by the zod schemas in
 * `@/common/schemas/` instead, which is a claim the runtime enforces.
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
    /** JSON `{ name, role, born, bio }[]`. */
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
