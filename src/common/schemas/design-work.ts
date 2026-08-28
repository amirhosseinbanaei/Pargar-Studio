// src/common/schemas/design-work.ts
/**
 * Contracts for the `design_works` table — 9 records ported from `legacy/data/works.js:10`.
 *
 * Persian translates MORE here than it does for a project: title, blurb, client, scope,
 * materials, description, `team` and `facts` — including the facts table, which
 * `legacy/data/works.fa.js:28` translates key AND value. `category`, `year` and `status`
 * are single columns (the taxonomy dictionary translates them; see `./enums`).
 *
 * `legacy/data/works.fa.js` also carries a translated `status`. It is deliberately NOT
 * stored: it duplicates the `status.Completed` entry that the interface dictionary already
 * holds, and nine copies of one word is nine places for it to drift.
 */
import { z } from 'zod';
import { jsonArray, looseString } from './helpers';
import { pickLocale, type Locale } from './locale';
import { factSchema, factWriteSchema } from './fact';

/* ── READ ─────────────────────────────────────────────────────────────────────── */

export const designWorkRowSchema = z.object({
  id: z.number(),
  slug: z.string().min(1),
  category: z.string(),
  year: z.number(),
  status: z.string(),
  sortOrder: z.number(),

  titleEn: looseString,
  titleFa: looseString,
  blurbEn: looseString,
  blurbFa: looseString,
  clientEn: looseString,
  clientFa: looseString,
  scopeEn: looseString,
  scopeFa: looseString,
  materialsEn: looseString,
  materialsFa: looseString,
  descriptionEn: looseString,
  descriptionFa: looseString,
  teamEn: jsonArray(z.string()),
  teamFa: jsonArray(z.string()),
  factsEn: jsonArray(factSchema),
  factsFa: jsonArray(factSchema),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type DesignWorkRow = z.infer<typeof designWorkRowSchema>;

/* ── LOCALE MAPPER ────────────────────────────────────────────────────────────── */

export function toLocaleDesignWork(row: DesignWorkRow, locale: Locale) {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    year: row.year,
    status: row.status,
    sortOrder: row.sortOrder,
    title: pickLocale(locale, row.titleEn, row.titleFa),
    blurb: pickLocale(locale, row.blurbEn, row.blurbFa),
    client: pickLocale(locale, row.clientEn, row.clientFa),
    scope: pickLocale(locale, row.scopeEn, row.scopeFa),
    materials: pickLocale(locale, row.materialsEn, row.materialsFa),
    description: pickLocale(locale, row.descriptionEn, row.descriptionFa),
    team: pickLocale(locale, row.teamEn, row.teamFa),
    facts: pickLocale(locale, row.factsEn, row.factsFa),
  };
}

export type DesignWork = ReturnType<typeof toLocaleDesignWork>;

/* ── WRITE ────────────────────────────────────────────────────────────────────── */

export const designWorkCreateSchema = z.strictObject({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase words separated by single hyphens'),
  /**
   * A TAXONOMY COLUMN, and no longer a `z.enum` — see `@/common/schemas/enums`'s header.
   * The closed set moved into `taxonomy_terms` in prompt 9, so a value added five minutes
   * ago must be accepted here; what rejects an arbitrary string is the runtime check
   * `unknownTermErrors` in `services/taxonomy-service.ts`, which the write ACTION runs
   * before it calls a service and reports as a 422 naming this field.
   */
  category: z.string().min(1),
  year: z.number().int().min(1900).max(2200),
  status: z.string().min(1),
  sortOrder: z.number().int().default(0),

  titleEn: z.string().min(1),
  titleFa: z.string().min(1),
  blurbEn: z.string(),
  blurbFa: z.string(),
  clientEn: z.string(),
  clientFa: z.string(),
  scopeEn: z.string(),
  scopeFa: z.string(),
  materialsEn: z.string(),
  materialsFa: z.string(),
  descriptionEn: z.string(),
  descriptionFa: z.string(),
  teamEn: z.array(z.string().min(1)),
  teamFa: z.array(z.string().min(1)),
  factsEn: z.array(factWriteSchema),
  factsFa: z.array(factWriteSchema),
});

export type DesignWorkCreate = z.infer<typeof designWorkCreateSchema>;

export const designWorkUpdateSchema = designWorkCreateSchema.partial();

export type DesignWorkUpdate = z.infer<typeof designWorkUpdateSchema>;
