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
import { fallbackList, fallbackText } from './shared';
import { imagePathField, toNullableAlt, toNullablePath } from './image';

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

/* ────────────────────────────────────────────────────────────────────────────────
   The form schema — carries copy. Every field lenient: this is a whole-record save
   of an already-published page, not a gate on publishing a new one.
   ──────────────────────────────────────────────────────────────────────────────── */

export const studioFormSchema = z.object({
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
});

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
  };
}

/* ────────────────────────────────────────────────────────────────────────────────
   The submission schema — carries no copy
   ──────────────────────────────────────────────────────────────────────────────── */

export const studioSubmissionSchema = z.strictObject({
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
});

export type StudioSubmission = z.output<typeof studioSubmissionSchema>;

export function withPersianFallback(input: StudioSubmission): StudioUpdate {
  /**
   * THE PORTRAIT PATH IS COPIED ACROSS, THE DESCRIPTION IS NOT.
   *
   * `image` has one author — the English founders editor, which is where the uploader is —
   * so it is written into the Persian array by INDEX here rather than being edited twice.
   * That is what stops the two arrays disagreeing about which photograph a founder has,
   * which is a bug with no symptom in English.
   *
   * `imageAlt` is deliberately NOT copied and deliberately not run through `fallbackList`'s
   * per-item logic: it is alt text, and the one translated field in this codebase that must
   * not fall back to English. `../schemas/image`'s header carries that argument in full —
   * alt text is heard rather than read, and an English sentence spoken by a Persian screen
   * reader is noise that also hides the omission from an audit.
   *
   * `fallbackList` still applies to the founders list AS A WHOLE, unchanged: a Persian
   * array left entirely empty is filled from the English one, which is what stops an
   * untranslated studio page rendering with no founders at all.
   */
  const foundersFa = fallbackList(input.foundersFa, input.foundersEn).map((founder, index) => ({
    ...founder,
    image: input.foundersEn[index]?.image ?? founder.image,
  }));

  return {
    manifestoEn: input.manifestoEn,
    manifestoFa: fallbackText(input.manifestoFa, input.manifestoEn),
    foundersEn: input.foundersEn.map(toFounderColumn),
    foundersFa: foundersFa.map(toFounderColumn),
    statsEn: input.statsEn,
    statsFa: fallbackList(input.statsFa, input.statsEn),
    teamEn: input.teamEn,
    teamFa: fallbackList(input.teamFa, input.teamEn),
    alumniEn: input.alumniEn,
    alumniFa: fallbackList(input.alumniFa, input.alumniEn),
    awardsEn: input.awardsEn,
    awardsFa: fallbackList(input.awardsFa, input.awardsEn),
    chaptersEn: input.chaptersEn,
    chaptersFa: fallbackList(input.chaptersFa, input.chaptersEn),
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
