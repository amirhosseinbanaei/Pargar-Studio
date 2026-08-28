// src/modules/dashboard/schemas/image.ts
/**
 * The image half of every record editor: what the form holds, what the action re-validates,
 * and the one rule that is neither a column type nor a field type.
 *
 * Four editors grew images in prompt 10 and all four compose these pieces, for the reason
 * `shared.ts` already gives for `withPersianFallback`'s helpers: a rule spelled four times
 * is a rule that gets relaxed in one of them.
 *
 * ═══ ALT TEXT IS REQUIRED WHENEVER THERE IS AN IMAGE ══════════════════════════════
 * `requireAltWithImage` below is that rule, and it is applied to BOTH the form schema (so
 * the editor is told before they submit, on the field itself) and the submission schema (so
 * a hand-written POST is refused, because the form's validation proves nothing about one).
 *
 * It is cross-field — "required IF" — which is why it is a `superRefine` here rather than a
 * `.min(1)` on the column or on the field. A record with no photograph has nothing to
 * describe, and marking the alt fields required unconditionally would make every one of the
 * 76 existing projects unsaveable until somebody wrote a sentence about an image that does
 * not exist.
 *
 * ═══ AND PERSIAN ALT TEXT DOES *NOT* FALL BACK TO ENGLISH ═════════════════════════
 * This is the ONE deliberate exception to the "Persian is optional, filled from English on
 * save" decision that AGENTS.md records for prompts 6 and 7, and it is worth stating plainly
 * because the next person to touch `withPersianFallback` will otherwise "fix" it:
 *
 *   Falling back is right for PROSE. A Persian page showing an untranslated English
 *   paragraph is imperfect but readable, and blocking publication on translation was the
 *   worse trade.
 *
 *   Falling back is wrong for ALT TEXT. Alt text is not read, it is HEARD — by a Persian
 *   screen reader, which will pronounce an English sentence with Persian phonetics and
 *   produce noise. There is no partial credit: the listener gets nothing either way, and
 *   the copied sentence additionally hides the omission from anyone auditing the page,
 *   because the column is populated.
 *
 * So both alt fields are required together, and neither is auto-filled — not from the other
 * locale, and not from the filename, which describes a camera's numbering scheme rather than
 * a building.
 */
import { z } from 'zod';
import { galleryItemWriteSchema, type GalleryItemWrite } from '@/common/schemas/image';
import { STORED_IMAGE_PATH_PATTERN } from '@/common/constants/uploads';

/* ────────────────────────────────────────────────────────────────────────────────
   What the FORM holds
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * A path field, as react-hook-form holds it: a STRING, `''` for "no image".
 *
 * Not `string | null`, because `''` is what an empty controlled input is everywhere else in
 * these forms and mixing the two spellings of "nothing" across sixteen fields is how a
 * `defaultValues` object ends up with one `undefined` in it — the uncontrolled-to-controlled
 * flip `references/07-forms.md` warns about. The submission schema converts `''` to `null`
 * on the way to a nullable column, exactly where `year` converts a string to a number.
 */
export const imagePathField = z
  .string()
  .refine(
    value => value === '' || STORED_IMAGE_PATH_PATTERN.test(value),
    'That is not an uploaded image path.',
  );

/**
 * ONE GALLERY ROW, HOLDING BOTH LANGUAGES.
 *
 * The database stores `gallery_en` and `gallery_fa` as two index-aligned arrays, per the
 * per-locale column-pair rule. The FORM deliberately does not: it holds one list in which a
 * row carries the path and both alt texts, and `toGalleryColumns` splits it on save.
 *
 * That is the whole reason the two columns cannot desync. With two independent editors an
 * editor could add a photograph to the English gallery and not the Persian one, or reorder
 * one and not the other, and item `i` would stop being the same picture in both — a bug
 * with no symptom in the language most people test in. One list makes the alignment
 * structural rather than a convention somebody has to honour.
 */
export const galleryFormItemSchema = z.object({
  path: z.string().regex(STORED_IMAGE_PATH_PATTERN, 'That is not an uploaded image path.'),
  altEn: z.string(),
  altFa: z.string(),
});

export type GalleryFormItem = z.infer<typeof galleryFormItemSchema>;

export const galleryField = z.array(galleryFormItemSchema);

/* ────────────────────────────────────────────────────────────────────────────────
   The rule
   ──────────────────────────────────────────────────────────────────────────────── */

/** The subset of a form's values this rule reads. Structural, so every editor satisfies it. */
export interface ImageBearingValues {
  coverImage: string;
  coverAltEn: string;
  coverAltFa: string;
  gallery?: readonly GalleryFormItem[];
}

/**
 * "An image must be described, in both languages."
 *
 * Applied with `.superRefine`, so each message lands on the FIELD that is empty — `path:
 * ['coverAltFa']` — rather than at the form level. That is what makes the refusal
 * actionable: `RecordForm` binds the 422 by field name and moves focus to it, so an editor
 * who saves a project with an English caption and no Persian one is put in the Persian box
 * with the reason underneath it, instead of reading "the submitted data is not valid" at
 * the top of a form three screens long.
 *
 * A gallery row's message keys on `['gallery', index, 'altFa']`. `z.flattenError` collapses
 * that to the top-level `gallery` key, which is the field the uploader list renders — so a
 * server-side refusal still reaches a control the editor can see, even though it cannot
 * point at the individual row.
 */
export function requireAltWithImage(
  values: ImageBearingValues,
  ctx: z.RefinementCtx,
  /** Names the thing in the message: "cover image", "portrait". */
  subject = 'cover image',
): void {
  if (values.coverImage.trim() !== '') {
    if (values.coverAltEn.trim() === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['coverAltEn'],
        message: `Describe the ${subject} in English — a picture with no alt text is invisible to anyone who cannot see it.`,
      });
    }
    if (values.coverAltFa.trim() === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['coverAltFa'],
        message: `Describe the ${subject} in Persian. It is not filled in from the English — a Persian screen reader would read out an English sentence.`,
      });
    }
  }

  values.gallery?.forEach((item, index) => {
    if (item.altEn.trim() === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['gallery', index, 'altEn'],
        message: `Image ${index + 1} needs an English description.`,
      });
    }
    if (item.altFa.trim() === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['gallery', index, 'altFa'],
        message: `Image ${index + 1} needs a Persian description.`,
      });
    }
  });
}

/* ────────────────────────────────────────────────────────────────────────────────
   Form values -> columns
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * `''` -> `null`, so an empty control writes an empty column rather than an empty string.
 *
 * The difference matters on the read side: `imagePath` treats `null` as "no image" and would
 * treat `''` as a path that fails its pattern — the same outcome by accident rather than by
 * design, and one that puts an empty string in a column whose meaning is "a path".
 */
export function toNullablePath(value: string): string | null {
  return value.trim() === '' ? null : value;
}

/** Same, for an alt column that is only meaningful beside an image. */
export function toNullableAlt(value: string): string | null {
  return value.trim() === '' ? null : value;
}

/**
 * The one form list -> the two index-aligned columns.
 *
 * Both arrays are built from the same source in the same order in one expression, which is
 * what makes "item `i` is the same photograph in both" a property of this function rather
 * than something to verify.
 */
export function toGalleryColumns(items: readonly GalleryFormItem[]): {
  galleryEn: GalleryItemWrite[];
  galleryFa: GalleryItemWrite[];
} {
  return {
    galleryEn: items.map(item =>
      galleryItemWriteSchema.parse({ path: item.path, alt: item.altEn }),
    ),
    galleryFa: items.map(item =>
      galleryItemWriteSchema.parse({ path: item.path, alt: item.altFa }),
    ),
  };
}

/**
 * The two columns -> the one form list, for an edit form's `defaultValues`.
 *
 * ENGLISH DRIVES THE LIST. The paths and the order are read from `galleryEn` and the Persian
 * alt is looked up BY INDEX, so a row that exists in only one column — which the write path
 * cannot produce, but a hand-edited database can — degrades to a missing Persian caption
 * that the editor is then required to fill in, rather than to a form that silently drops the
 * image or renders two lists of different lengths.
 */
export function toGalleryFormItems(
  galleryEn: ReadonlyArray<{ path: string | null; alt: string }>,
  galleryFa: ReadonlyArray<{ path: string | null; alt: string }>,
): GalleryFormItem[] {
  return galleryEn.flatMap((item, index) =>
    item.path ? [{ path: item.path, altEn: item.alt, altFa: galleryFa[index]?.alt ?? '' }] : [],
  );
}
