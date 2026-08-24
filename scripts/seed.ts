// scripts/seed.ts — `npm run db:seed`
//
// Loads every piece of site content out of `legacy/data/` and writes it into the database:
// 76 projects, 9 design works, 14 media entries, and the studio and contact singletons,
// each in both locales.
//
// ─── WHY THIS FILE MAY IMPORT `legacy/` WHEN NOTHING ELSE MAY ─────────────────────
// AGENTS.md bans imports of `legacy/` from `src/`, and lint enforces that ban across
// `src/**`. This file is at `scripts/`, outside `src/`, which is the deliberate exception:
// it is a ONE-TIME migration whose entire job is to read that tree, it never ships in a
// bundle, and when prompt 7 deletes `legacy/` it deletes this script with it. The legacy
// modules are plain ESM with no DOM dependency, so they import cleanly under tsx.
//
// ─── THE PERSIAN OVERLAY, AND THE FALLBACK RULE ───────────────────────────────────
// English and Persian are separate files: `PROJECTS` holds the English records and
// `PROJECTS_FA` holds Persian objects keyed by the exact English slug. The legacy site
// merged them at render time with a spread (`legacy/js/core/i18n.js:154`), so a missing
// Persian key degraded to the English value rather than throwing.
//
// This script reproduces that rule at WRITE time: `fa(en, overlay, key)` writes the Persian
// string where one exists and THE ENGLISH STRING where one does not. Never null, never an
// empty string. Losing that would replace a graceful degradation with a blank Persian page,
// which is worse than untranslated text and much harder to notice.
//
// ─── STRINGS ARE COPIED VERBATIM ──────────────────────────────────────────────────
// Not translated, not paraphrased, not re-wrapped, not "fixed". The Persian content uses
// zero-width non-joiners that are meaningful (`می‌شود` is one word, `می شود` is two), and
// `legacy/data/projects.fa.part1.js:3` records that numbers deliberately stay in Latin
// digits because the interface converts them at render time. Any normalization here would
// silently corrupt content nobody can proofread from a diff.
//
// ─── IDEMPOTENCE ──────────────────────────────────────────────────────────────────
// Delete-then-insert inside ONE transaction. Re-running the script produces the same
// database, and a failure part-way through rolls back to the previous contents rather than
// leaving a half-populated site.
import { PROJECTS } from '../legacy/data/projects.js';
import { PROJECTS_FA } from '../legacy/data/projects.fa.js';
import { DESIGN_WORKS, MEDIA } from '../legacy/data/works.js';
import { DESIGN_FA, MEDIA_FA } from '../legacy/data/works.fa.js';
import { STUDIO, CONTACT } from '../legacy/data/studio.js';
import { STUDIO_FA, CONTACT_FA } from '../legacy/data/studio.fa.js';
import { db } from '../src/common/services/db';
import {
  contact,
  contactMessages,
  designWorks,
  media,
  projects,
  studio,
} from '../src/common/services/schema';

/* ─────────────────────────────────────────────────────────────────────────────
   The overlay rule
   ───────────────────────────────────────────────────────────────────────────── */

/** A Persian overlay: some subset of the English record's translatable keys. */
type Overlay = Record<string, unknown> | undefined;

/**
 * Look a record's overlay up by slug.
 *
 * The parameter is typed as an index signature rather than as the legacy module's inferred
 * literal type, which is what makes `map[slug]` legal without a cast: those modules are
 * untyped JavaScript, so TypeScript infers an exact object type with 76 literal keys and
 * rejects a lookup by `string`. Widening it HERE, in one function, keeps `as` out of every
 * call site — and a slug with no overlay simply returns `undefined`, which is the case the
 * fallback below exists for.
 */
function overlayFor(map: Record<string, Record<string, unknown>>, slug: string): Overlay {
  return map[slug];
}

/**
 * The Persian value for one field, falling back to the English one.
 *
 * This IS the legacy `{ ...record, ...translation }` spread, applied per field: a key the
 * overlay omits keeps the English value. Doing it field by field rather than by spreading
 * is what lets the two locales land in two different columns.
 */
function fa<T extends string | null>(english: T, overlay: Overlay, key: string): string | T {
  const value = overlay?.[key];
  return typeof value === 'string' ? value : english;
}

/** The same rule for a list-valued field, JSON-encoded for its TEXT column. */
function faJson(english: unknown, overlay: Overlay, key: string): string {
  const value = overlay?.[key];
  return JSON.stringify(value === undefined ? english : value);
}

/* ─────────────────────────────────────────────────────────────────────────────
   Row builders — one per table, each a pure function of the legacy data
   ───────────────────────────────────────────────────────────────────────────── */

function projectRows() {
  return PROJECTS.map((project, index) => {
    const tr = overlayFor(PROJECTS_FA, project.slug);
    return {
      // The legacy numeric id is kept as the primary key so a later slug rename never
      // orphans a record, and so a hand-written cross-reference still resolves.
      id: project.id,
      slug: project.slug,
      // `type` in the legacy record, `types` in the column: it was always a LIST
      // (`['Residential', 'Interior Design']`) and the singular name misled every reader.
      types: JSON.stringify(project.type),
      status: project.status,
      scale: project.scale,
      year: project.year,
      area: project.area,
      // Array position, which is reverse-chronological. The dashboard edits it from there;
      // nothing downstream depends on insertion order.
      sortOrder: index,

      titleEn: project.title,
      titleFa: fa(project.title, tr, 'title'),
      blurbEn: project.blurb,
      blurbFa: fa(project.blurb, tr, 'blurb'),
      descriptionEn: project.description,
      descriptionFa: fa(project.description, tr, 'description'),
      locationEn: project.location,
      locationFa: fa(project.location, tr, 'location'),
      clientEn: project.client,
      clientFa: fa(project.client, tr, 'client'),
    };
  });
}

function designWorkRows() {
  return DESIGN_WORKS.map((work, index) => {
    const tr = overlayFor(DESIGN_FA, work.slug);
    return {
      id: work.id,
      slug: work.slug,
      category: work.category,
      year: work.year,
      // Canonical English. `DESIGN_FA` also carries a translated `status`, deliberately not
      // stored: it duplicates the `status.*` entry in the interface dictionary, and nine
      // copies of one word is nine places for it to drift.
      status: work.status,
      sortOrder: index,

      titleEn: work.title,
      titleFa: fa(work.title, tr, 'title'),
      blurbEn: work.blurb,
      blurbFa: fa(work.blurb, tr, 'blurb'),
      clientEn: work.client,
      clientFa: fa(work.client, tr, 'client'),
      scopeEn: work.scope,
      scopeFa: fa(work.scope, tr, 'scope'),
      materialsEn: work.materials,
      materialsFa: fa(work.materials, tr, 'materials'),
      descriptionEn: work.description,
      descriptionFa: fa(work.description, tr, 'description'),
      teamEn: JSON.stringify(work.team),
      teamFa: faJson(work.team, tr, 'team'),
      factsEn: JSON.stringify(work.facts),
      factsFa: faJson(work.facts, tr, 'facts'),
    };
  });
}

function mediaRows() {
  return MEDIA.map((entry, index) => {
    const tr = overlayFor(MEDIA_FA, entry.slug);
    return {
      id: entry.id,
      slug: entry.slug,
      type: entry.type,
      year: entry.year,
      // `null` for the four entries about the practice rather than a building.
      projectSlug: entry.project ?? null,
      sortOrder: index,

      titleEn: entry.title,
      titleFa: fa(entry.title, tr, 'title'),
      // Translated in some records, left in Latin script in others — `works.fa.js:283`
      // keeps "ArchDaily". The fallback handles both without a rule.
      outletEn: entry.outlet,
      outletFa: fa(entry.outlet, tr, 'outlet'),
      blurbEn: entry.blurb,
      blurbFa: fa(entry.blurb, tr, 'blurb'),
      authorEn: entry.author,
      authorFa: fa(entry.author, tr, 'author'),
      excerptEn: entry.excerpt,
      excerptFa: fa(entry.excerpt, tr, 'excerpt'),
      contextEn: entry.context,
      contextFa: fa(entry.context, tr, 'context'),
      factsEn: JSON.stringify(entry.facts),
      factsFa: faJson(entry.facts, tr, 'facts'),
    };
  });
}

function studioRow() {
  return {
    id: 1,
    manifestoEn: STUDIO.manifesto,
    manifestoFa: fa(STUDIO.manifesto, STUDIO_FA, 'manifesto'),
    foundersEn: JSON.stringify(STUDIO.founders),
    foundersFa: faJson(STUDIO.founders, STUDIO_FA, 'founders'),
    statsEn: JSON.stringify(STUDIO.stats),
    statsFa: faJson(STUDIO.stats, STUDIO_FA, 'stats'),
    teamEn: JSON.stringify(STUDIO.team),
    teamFa: faJson(STUDIO.team, STUDIO_FA, 'team'),
    alumniEn: JSON.stringify(STUDIO.alumni),
    alumniFa: faJson(STUDIO.alumni, STUDIO_FA, 'alumni'),
    awardsEn: JSON.stringify(STUDIO.awards),
    awardsFa: faJson(STUDIO.awards, STUDIO_FA, 'awards'),
    chaptersEn: JSON.stringify(STUDIO.chapters),
    chaptersFa: faJson(STUDIO.chapters, STUDIO_FA, 'chapters'),
  };
}

function contactRow() {
  return {
    id: 1,

    // Shared — `CONTACT_FA` translates none of these, and a second copy of an email address
    // is a second value that can drift from the real one.
    postcode: CONTACT.postcode,
    phone: CONTACT.phone,
    phoneHref: CONTACT.phoneHref,
    email: CONTACT.email,
    press: CONTACT.press,
    // Stringified rather than stored as a float: `35.8112` must survive a round trip into a
    // map URL exactly as the studio typed it.
    lat: String(CONTACT.coordinates.lat),
    lng: String(CONTACT.coordinates.lng),

    // Per-locale — exactly the seven keys `legacy/data/studio.fa.js:109` translates.
    addressEn: CONTACT.address,
    addressFa: fa(CONTACT.address, CONTACT_FA, 'address'),
    districtEn: CONTACT.district,
    districtFa: fa(CONTACT.district, CONTACT_FA, 'district'),
    cityEn: CONTACT.city,
    cityFa: fa(CONTACT.city, CONTACT_FA, 'city'),
    countryEn: CONTACT.country,
    countryFa: fa(CONTACT.country, CONTACT_FA, 'country'),
    hoursEn: CONTACT.hours,
    hoursFa: fa(CONTACT.hours, CONTACT_FA, 'hours'),
    careersEn: CONTACT.careers,
    careersFa: fa(CONTACT.careers, CONTACT_FA, 'careers'),
    socialsEn: JSON.stringify(CONTACT.socials),
    socialsFa: faJson(CONTACT.socials, CONTACT_FA, 'socials'),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   The write
   ───────────────────────────────────────────────────────────────────────────── */

async function main() {
  const rows = {
    projects: projectRows(),
    designWorks: designWorkRows(),
    media: mediaRows(),
    studio: studioRow(),
    contact: contactRow(),
  };

  await db.transaction(async tx => {
    // Delete-then-insert, inside the transaction, is what makes a re-run produce the same
    // database instead of a unique-constraint error or a second copy of every record.
    //
    // `contact_messages` is NOT touched. It holds mail from real visitors, which this
    // script did not write and has no business destroying — re-seeding the site's content
    // must never empty its inbox.
    await tx.delete(projects);
    await tx.delete(designWorks);
    await tx.delete(media);
    await tx.delete(studio);
    await tx.delete(contact);

    await tx.insert(projects).values(rows.projects);
    await tx.insert(designWorks).values(rows.designWorks);
    await tx.insert(media).values(rows.media);
    await tx.insert(studio).values(rows.studio);
    await tx.insert(contact).values(rows.contact);
  });

  const messages = await db.$count(contactMessages);

  console.log(
    [
      `projects          ${rows.projects.length}`,
      `design_works      ${rows.designWorks.length}`,
      `media             ${rows.media.length}`,
      `studio            1`,
      `contact           1`,
      `contact_messages  ${messages} (left untouched)`,
    ].join('\n'),
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
