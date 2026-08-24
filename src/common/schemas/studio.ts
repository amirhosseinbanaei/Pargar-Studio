// src/common/schemas/studio.ts
/**
 * Contracts for the `studio` singleton — the editorial block at `legacy/data/studio.js:25`.
 *
 * One row, id 1. Every field is per-locale, because every field is prose or a list of
 * prose: the manifesto, the two founder biographies, the four statistics, twenty-two
 * current names, forty alumni, six awards and five chapters of the studio's history. The
 * Persian layer (`legacy/data/studio.fa.js`) translates all of them, names included.
 *
 * `BRAND` and `NAV` from the same legacy file are NOT stored here. They are the shell's
 * chrome — the wordmark, five nav labels and their captions — not editable content, and
 * prompt 4 ports them as constants beside the shell. Putting them in this table would make
 * the site's navigation a database read on every render for values that change when the
 * routing does, not when an editor decides.
 */
import { z } from 'zod';
import { jsonArray, looseString } from './helpers';
import { pickLocale, type Locale } from './locale';

/** The id every read and write pins to. Exported so the repository never spells it twice. */
export const STUDIO_ID = 1;

/* ── Nested shapes ────────────────────────────────────────────────────────────── */

export const founderSchema = z.object({
  name: looseString,
  role: looseString,
  born: looseString,
  bio: looseString,
});

export const statSchema = z.object({
  label: looseString,
  value: looseString,
});

export const awardSchema = z.object({
  /** A string, not a number: the legacy data writes years as `'2024'` throughout. */
  year: looseString,
  title: looseString,
  project: looseString,
  body: looseString,
});

export const chapterSchema = z.object({
  year: looseString,
  text: looseString,
});

export type Founder = z.infer<typeof founderSchema>;
export type Stat = z.infer<typeof statSchema>;
export type Award = z.infer<typeof awardSchema>;
export type Chapter = z.infer<typeof chapterSchema>;

/* ── READ ─────────────────────────────────────────────────────────────────────── */

export const studioRowSchema = z.object({
  id: z.number(),

  manifestoEn: looseString,
  manifestoFa: looseString,
  foundersEn: jsonArray(founderSchema),
  foundersFa: jsonArray(founderSchema),
  statsEn: jsonArray(statSchema),
  statsFa: jsonArray(statSchema),
  teamEn: jsonArray(z.string()),
  teamFa: jsonArray(z.string()),
  alumniEn: jsonArray(z.string()),
  alumniFa: jsonArray(z.string()),
  awardsEn: jsonArray(awardSchema),
  awardsFa: jsonArray(awardSchema),
  chaptersEn: jsonArray(chapterSchema),
  chaptersFa: jsonArray(chapterSchema),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type StudioRow = z.infer<typeof studioRowSchema>;

/* ── LOCALE MAPPER ────────────────────────────────────────────────────────────── */

export function toLocaleStudio(row: StudioRow, locale: Locale) {
  return {
    manifesto: pickLocale(locale, row.manifestoEn, row.manifestoFa),
    founders: pickLocale(locale, row.foundersEn, row.foundersFa),
    stats: pickLocale(locale, row.statsEn, row.statsFa),
    team: pickLocale(locale, row.teamEn, row.teamFa),
    alumni: pickLocale(locale, row.alumniEn, row.alumniFa),
    awards: pickLocale(locale, row.awardsEn, row.awardsFa),
    chapters: pickLocale(locale, row.chaptersEn, row.chaptersFa),
  };
}

export type Studio = ReturnType<typeof toLocaleStudio>;

/* ── WRITE ────────────────────────────────────────────────────────────────────── */

const founderWriteSchema = z.strictObject({
  name: z.string().min(1),
  role: z.string(),
  born: z.string(),
  bio: z.string(),
});

const statWriteSchema = z.strictObject({ label: z.string().min(1), value: z.string() });

const awardWriteSchema = z.strictObject({
  year: z.string().min(1),
  title: z.string().min(1),
  project: z.string(),
  body: z.string(),
});

const chapterWriteSchema = z.strictObject({ year: z.string().min(1), text: z.string() });

/**
 * There is no `create` for a singleton — the seed writes row 1 and the dashboard edits it —
 * so the write contract is the update, and every field is optional for the PATCH reason:
 * saving one section must not blank the six the editor did not open.
 */
export const studioUpdateSchema = z
  .strictObject({
    manifestoEn: z.string(),
    manifestoFa: z.string(),
    foundersEn: z.array(founderWriteSchema),
    foundersFa: z.array(founderWriteSchema),
    statsEn: z.array(statWriteSchema),
    statsFa: z.array(statWriteSchema),
    teamEn: z.array(z.string().min(1)),
    teamFa: z.array(z.string().min(1)),
    alumniEn: z.array(z.string().min(1)),
    alumniFa: z.array(z.string().min(1)),
    awardsEn: z.array(awardWriteSchema),
    awardsFa: z.array(awardWriteSchema),
    chaptersEn: z.array(chapterWriteSchema),
    chaptersFa: z.array(chapterWriteSchema),
  })
  .partial();

export type StudioUpdate = z.infer<typeof studioUpdateSchema>;

/** The full row shape the seed inserts, before ids and timestamps. */
export const studioCreateSchema = studioUpdateSchema.required();

export type StudioCreate = z.infer<typeof studioCreateSchema>;
