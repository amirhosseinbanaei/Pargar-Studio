// src/modules/dashboard/schemas/studio-form.ts
/**
 * The studio editor's contract — the most structured record in the database, and the first
 * SINGLETON this module edits.
 *
 * ─── ONE SUBMIT FOR THE WHOLE RECORD ──────────────────────────────────────────────
 * Open decision, resolved (AGENTS.md): the form saves the manifesto, the founders, the
 * stats, the team, the alumni, the awards and the chapters together, in one action, rather
 * than one action per collection. `/studio` is read as a single page — the manifesto sits
 * above the founders which sit above the numbers — and a partial save would leave the
 * public page in a combination the editor never previewed: half the new founders visible
 * with the old manifesto still showing, because that save happened to land first. A whole-
 * record `PATCH` also matches how the write schema is shaped (`studioUpdateSchema` in
 * `common/schemas/studio.ts` is already a full-object partial, not per-field endpoints).
 *
 * ─── NO CREATE, NO DELETE — SEE THE ACTION, NOT THIS FILE ─────────────────────────
 * There is one row, planted by the seed, pinned to id 1 by a CHECK constraint. This module
 * has no `studioCreateSchema` counterpart for the same reason `studio-service.ts` has no
 * dashboard-facing `createStudio`: offering a create path here risks a second attempt at
 * row 1, which the database would refuse with a constraint error instead of a field-level
 * message a form ought to give.
 */
import { z } from 'zod';
import type { StudioRow, StudioUpdate } from '@/common/schemas/studio';
import {
  galleryField,
  imagePathField,
  requireGalleryAlt,
  requireTranslatedList,
  toGalleryColumns,
  toGalleryFormItems,
  toNullableAlt,
  toNullablePath,
} from './image';

/**
 * A founder, with their portrait.
 *
 * `image` and `imageAlt` are on BOTH the English and the Persian side because the two are
 * the same array shape and the storage is a per-locale column pair. Only `imageAlt` is
 * meaningfully different between them — see `withPersianFallback` below, which copies each
 * founder's `image` from the English array into the Persian one by index so the path has
 * exactly one author and the two arrays cannot disagree about which photograph a founder
 * has. The English editor is the only one that renders an uploader, for the same reason.
 */
const founderFormSchema = z.object({
  name: z.string(),
  role: z.string(),
  born: z.string(),
  bio: z.string(),
  image: imagePathField,
  imageAlt: z.string(),
});
const statFormSchema = z.object({ label: z.string(), value: z.string() });
const awardFormSchema = z.object({
  year: z.string(),
  title: z.string(),
  project: z.string(),
  body: z.string(),
});
const chapterFormSchema = z.object({ year: z.string(), text: z.string() });

/**
 * EVERY PICTURE ON THIS PAGE MUST BE DESCRIBED, AND EVERY LIST MUST EXIST IN BOTH.
 *
 * ─── THE FOUNDER-PORTRAIT HOLE PROMPT 14's SWEEP FOUND ────────────────────────────
 * Prompt 10 made alt text required wherever there is an image and applied
 * `requireAltWithImage` to four editors. This one was not among them, because its picture
 * is not a `coverImage` — it is `foundersEn[i].image`, a key inside a repeatable row — so a
 * founder could be saved with a portrait and no description, in either language, with
 * nothing refusing it. `StudioScreen` then quietly falls back to the GENERATED portrait
 * (it requires `founder.imageAlt.trim()` before rendering the photograph), so the symptom
 * was an uploaded picture that simply never appeared. Refused here now, per founder and
 * per language, on the same terms as every other image in the dashboard.
 *
 * ─── AND THE LISTS ────────────────────────────────────────────────────────────────
 * `fallbackList` used to fill an empty Persian list from the English one on save; prompt 14
 * deletes it, and this refuses the save instead. It matters most on this record: six of its
 * seven fields are lists, and an empty Persian one is a whole missing SECTION of
 * `/fa/studio` rather than a blank line — which is the failure this table has already
 * produced twice by other means (`awards`, `founders`).
 */
function requireStudioImages(
  values: Pick<
    StudioFormValues,
    | 'foundersEn'
    | 'foundersFa'
    | 'statsEn'
    | 'statsFa'
    | 'teamEn'
    | 'teamFa'
    | 'alumniEn'
    | 'alumniFa'
    | 'awardsEn'
    | 'awardsFa'
    | 'chaptersEn'
    | 'chaptersFa'
    | 'gallery'
  >,
  ctx: z.RefinementCtx,
): void {
  requireGalleryAlt(values.gallery, ctx);

  // Both sides, because `imageAlt` is a genuine per-locale column and the path is copied
  // across by index on save — so a Persian founder row carries the same photograph and
  // needs its own sentence for it.
  for (const side of ['foundersEn', 'foundersFa'] as const) {
    values[side].forEach((founder, index) => {
      if (founder.image.trim() !== '' && founder.imageAlt.trim() === '') {
        ctx.addIssue({
          code: 'custom',
          path: [side, index, 'imageAlt'],
          message: `Describe ${founder.name.trim() || `founder ${index + 1}`}'s portrait — an undescribed photograph is not rendered at all.`,
        });
      }
    });
  }

  requireTranslatedList(values.foundersEn, values.foundersFa, ctx, 'foundersFa', 'founders');
  requireTranslatedList(values.statsEn, values.statsFa, ctx, 'statsFa', 'stats');
  requireTranslatedList(values.teamEn, values.teamFa, ctx, 'teamFa', 'team');
  requireTranslatedList(values.alumniEn, values.alumniFa, ctx, 'alumniFa', 'alumni');
  requireTranslatedList(values.awardsEn, values.awardsFa, ctx, 'awardsFa', 'awards');
  requireTranslatedList(values.chaptersEn, values.chaptersFa, ctx, 'chaptersFa', 'chapters');
}

/* ────────────────────────────────────────────────────────────────────────────────
   The form schema — carries copy. Every field lenient: this is a whole-record save
   of an already-published page, not a gate on publishing a new one.
   ──────────────────────────────────────────────────────────────────────────────── */

export const studioFormSchema = z
  .object({
    manifestoEn: z.string(),
    manifestoFa: z.string(),
    foundersEn: z.array(founderFormSchema),
    foundersFa: z.array(founderFormSchema),
    statsEn: z.array(statFormSchema),
    statsFa: z.array(statFormSchema),
    teamEn: z.array(z.string()),
    teamFa: z.array(z.string()),
    alumniEn: z.array(z.string()),
    alumniFa: z.array(z.string()),
    awardsEn: z.array(awardFormSchema),
    awardsFa: z.array(awardFormSchema),
    chaptersEn: z.array(chapterFormSchema),
    chaptersFa: z.array(chapterFormSchema),
    /** The page's own gallery (prompt 14) — the hero band plus the band below it. */
    gallery: galleryField,
  })
  .superRefine(requireStudioImages);

export type StudioFormValues = z.infer<typeof studioFormSchema>;

export const STUDIO_FORM_FIELDS = [
  'manifestoEn',
  'manifestoFa',
  'foundersEn',
  'foundersFa',
  'statsEn',
  'statsFa',
  'teamEn',
  'teamFa',
  'alumniEn',
  'alumniFa',
  'awardsEn',
  'awardsFa',
  'chaptersEn',
  'chaptersFa',
  'gallery',
] as const satisfies ReadonlyArray<keyof StudioFormValues>;

function toFounderFormValue(founder: StudioRow['foundersEn'][number]) {
  return { ...founder, image: founder.image ?? '' };
}

export function toStudioFormValues(row: StudioRow): StudioFormValues {
  return {
    manifestoEn: row.manifestoEn,
    manifestoFa: row.manifestoFa,
    // `image: null` -> `''`: the form holds a path as a string, and a controlled input
    // handed `null` mounts uncontrolled — the flip `references/07-forms.md` warns about.
    foundersEn: row.foundersEn.map(toFounderFormValue),
    foundersFa: row.foundersFa.map(toFounderFormValue),
    statsEn: row.statsEn,
    statsFa: row.statsFa,
    teamEn: row.teamEn,
    teamFa: row.teamFa,
    alumniEn: row.alumniEn,
    alumniFa: row.alumniFa,
    awardsEn: row.awardsEn,
    awardsFa: row.awardsFa,
    chaptersEn: row.chaptersEn,
    chaptersFa: row.chaptersFa,
    gallery: toGalleryFormItems(row.galleryEn, row.galleryFa),
  };
}

/* ────────────────────────────────────────────────────────────────────────────────
   The submission schema — carries no copy
   ──────────────────────────────────────────────────────────────────────────────── */

export const studioSubmissionSchema = z
  .strictObject({
    manifestoEn: z.string(),
    manifestoFa: z.string(),
    foundersEn: z.array(founderFormSchema),
    foundersFa: z.array(founderFormSchema),
    statsEn: z.array(statFormSchema),
    statsFa: z.array(statFormSchema),
    teamEn: z.array(z.string()),
    teamFa: z.array(z.string()),
    alumniEn: z.array(z.string()),
    alumniFa: z.array(z.string()),
    awardsEn: z.array(awardFormSchema),
    awardsFa: z.array(awardFormSchema),
    chaptersEn: z.array(chapterFormSchema),
    chaptersFa: z.array(chapterFormSchema),
    gallery: galleryField,
  })
  .superRefine(requireStudioImages);

export type StudioSubmission = z.output<typeof studioSubmissionSchema>;

/** The parsed submission -> the write payload. Nothing is copied between locales; see
 *  `project-form.ts`'s `toProjectColumns`. */
export function toStudioColumns(input: StudioSubmission): StudioUpdate {
  /**
   * THE PORTRAIT PATH IS STILL COPIED ACROSS, AND IT IS THE ONLY THING THAT IS.
   *
   * `image` has one author — the English founders editor, which is where the uploader is —
   * so it is written into the Persian array by INDEX rather than edited twice. That is not
   * a Persian fallback and did not go with them: it stops the two arrays disagreeing about
   * WHICH PHOTOGRAPH a founder has, which is a bug with no symptom in English. What is
   * per-locale is the sentence describing it, and that is never copied.
   *
   * The `fallbackList` that used to fill an empty Persian founders array from the English
   * one is gone. `requireStudioImages` refuses that save instead — see its header.
   */
  const foundersFa = input.foundersFa.map((founder, index) => ({
    ...founder,
    image: input.foundersEn[index]?.image ?? founder.image,
  }));

  return {
    manifestoEn: input.manifestoEn,
    manifestoFa: input.manifestoFa,
    foundersEn: input.foundersEn.map(toFounderColumn),
    foundersFa: foundersFa.map(toFounderColumn),
    statsEn: input.statsEn,
    statsFa: input.statsFa,
    teamEn: input.teamEn,
    teamFa: input.teamFa,
    alumniEn: input.alumniEn,
    alumniFa: input.alumniFa,
    awardsEn: input.awardsEn,
    awardsFa: input.awardsFa,
    chaptersEn: input.chaptersEn,
    chaptersFa: input.chaptersFa,
    ...toGalleryColumns(input.gallery),
  };
}

/**
 * `''` -> `null` on the two image fields, for the same reason every other image column does
 * it: `null` is "no portrait" and `''` is a path that fails its own pattern — the same
 * outcome by accident rather than by design.
 */
function toFounderColumn(founder: StudioSubmission['foundersEn'][number]) {
  return {
    name: founder.name,
    role: founder.role,
    born: founder.born,
    bio: founder.bio,
    image: toNullablePath(founder.image),
    imageAlt: toNullableAlt(founder.imageAlt),
  };
}
