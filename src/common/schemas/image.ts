// src/common/schemas/image.ts
/**
 * The contracts for an uploaded image, shared by every record that takes one.
 *
 * Four resources grew image columns in prompt 10 — `projects`, `design_works`, `media` and
 * `studio`'s founders — and all four store the same two things: a generated path, and a
 * sentence describing the picture in each language. Spelling that four times is four places
 * for one rule to be relaxed by accident, so it is spelled here and composed in.
 *
 * ─── THE READ SIDE DEGRADES; THE WRITE SIDE DOES NOT ──────────────────────────────
 * `helpers.ts` states the rule this file follows: strict about the shape, forgiving about
 * the leaves. A stored path that does not match the generated shape degrades to `null`
 * rather than throwing, and the page then renders the drawing it rendered before anybody
 * uploaded anything — a project card with no photograph is the normal state of 76 of them.
 * A `ZodError` there would blank the whole index over one bad column.
 *
 * The write side is exact: a path is refused unless it is one `/api/uploads` generated.
 *
 * ─── A PICTURE WITHOUT ALT TEXT IS NOT A USABLE PICTURE ───────────────────────────
 * `toLocaleImage` answers `null` unless BOTH the path and the alt text for THIS locale are
 * present, and that is the single most load-bearing decision in the file. The write schemas
 * make alt text required whenever an image is set, so the only way to reach that state is a
 * row edited outside the application — and the honest answer for one is to fall back to the
 * generated drawing rather than to publish an image no screen reader can describe. The
 * failure degrades to the thing the site already did well, in both languages, silently and
 * correctly.
 *
 * That is also why every consumer receives `{ path, alt } | null` rather than two fields:
 * "is there a usable image here" is then one check that cannot be half-done.
 */
import { z } from 'zod';
import { STORED_IMAGE_PATH_PATTERN } from '@/common/constants/uploads';
import { jsonArray, looseString } from './helpers';
import { pickLocale, type Locale } from './locale';

/* ─────────────────────────────────────────────────────────────────────────────
   READ
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * A stored path, or `null`.
 *
 * `.catch(null)` on a value that fails the shape, because a path `/api/media` would refuse
 * to serve is indistinguishable — to a reader — from no path at all, and one of those
 * blanks a route while the other shows a drawing.
 */
export const imagePath = z.string().regex(STORED_IMAGE_PATH_PATTERN).nullable().catch(null);

/**
 * The same two leaves, for a key INSIDE an existing JSON object rather than a column of
 * its own — `studio.founders[i].image`, and every gallery item.
 *
 * ─── THIS IS THE `studio.awards` BUG, AND IT WAS CAUGHT THE SAME WAY ──────────────
 * `looseString` and `imagePath` accept `null`; they do NOT accept a key that is ABSENT,
 * because `.nullable()` is deliberately not `.nullish()` (see `./helpers`). Every founder
 * object in the database was written before these keys existed, so on a stored row they are
 * absent — and `jsonArray` degrades a payload that fails its item schema to `[]` rather
 * than throwing, ON PURPOSE, so that one bad row cannot blank a page.
 *
 * The consequence, observed rather than theorised: adding these two keys without this
 * preprocess made EVERY founder fail to parse, `foundersEn` come back as `[]`, and the
 * founders section of `/en/studio` and `/fa/studio` disappear — with no error, no empty
 * state, and nothing in the four-command gate to notice. It is precisely the failure
 * AGENTS.md records for `studio.awards` in prompt 5, and precisely the warning that file
 * ends with: "the tolerance that keeps one bad row from blanking a page is also what hides
 * a schema that never matched."
 *
 * `undefined` is therefore normalized to the absent-value spelling BEFORE validation. Any
 * future key added to a stored JSON object needs the same treatment or the same bug.
 * `common/schemas/__tests__/image.test.ts` pins it.
 */
export const embeddedImagePath = z.preprocess(value => value ?? null, imagePath);
export const embeddedImageAlt = z.preprocess(value => value ?? '', looseString);

/** One gallery entry, as stored in a `gallery_en` / `gallery_fa` JSON column. */
export const galleryItemSchema = z.object({
  path: embeddedImagePath,
  alt: embeddedImageAlt,
});

export type GalleryItem = z.infer<typeof galleryItemSchema>;

/** A gallery column: a JSON string in, a real array out, `[]` for anything unreadable. */
export const galleryColumn = jsonArray(galleryItemSchema);

/* ─────────────────────────────────────────────────────────────────────────────
   LOCALE MAPPING
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * What a component receives: a path to render and a sentence to describe it with, in the
 * locale being rendered — or `null`, meaning "there is no usable image here, draw one".
 */
export interface LocaleImage {
  /** Relative to the media route; `mediaUrl()` turns it into an `src`. */
  path: string;
  /** Never empty — see the header. */
  alt: string;
}

/** A cover column trio -> one usable image, or `null`. */
export function toLocaleImage(
  locale: Locale,
  path: string | null,
  altEn: string,
  altFa: string,
): LocaleImage | null {
  if (!path) return null;
  const alt = pickLocale(locale, altEn, altFa).trim();
  return alt ? { path, alt } : null;
}

/**
 * A gallery column pair -> the usable images, in stored order.
 *
 * The two columns are index-aligned by the write path, so this reads the requested locale's
 * array directly rather than zipping: the paths in it are the same paths, written from the
 * one list the dashboard edits. Items missing a path or an alt are DROPPED rather than
 * rendered as a hole, for the reason in the header — and dropping rather than substituting
 * keeps the gallery's order intact for everything that is complete.
 */
export function toLocaleGallery(
  locale: Locale,
  galleryEn: readonly GalleryItem[],
  galleryFa: readonly GalleryItem[],
): LocaleImage[] {
  return pickLocale(locale, galleryEn, galleryFa).flatMap(item => {
    const alt = item.alt.trim();
    return item.path && alt ? [{ path: item.path, alt }] : [];
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   THE UPLOAD ENDPOINT'S SUCCESS SHAPE
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * What `POST /api/uploads` returns on success.
 *
 * It lives HERE, in `common/`, rather than beside the route handler that produces it,
 * because the uploader in `modules/dashboard` consumes it and `modules → app` is not a
 * legal import direction (`eslint.config.mjs` enforces `app → modules → common`, one way).
 * Both ends import it from here, which is what makes the two halves of that request one
 * contract instead of two guesses.
 *
 * The DIMENSIONS are reported and not persisted. Every render box in this design is a
 * fixed-aspect frame with the image covering it — `next/image`'s `fill`, matching what the
 * generated SVGs already do with `preserveAspectRatio="slice"` — so no render needs an
 * intrinsic size, and a stored pair would be a second copy of a fact the file itself
 * carries and nothing reads. The uploader shows them beside the preview so a person can see
 * what the server thinks arrived. See AGENTS.md.
 */
export interface UploadedImage {
  /** The stored path, relative to `UPLOAD_DIR`. This is what goes in the column. */
  path: string;
  width: number;
  height: number;
  bytes: number;
}

/* ─────────────────────────────────────────────────────────────────────────────
   WRITE — exact, and the shape the dashboard's submission schemas compose
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * A path on the way IN.
 *
 * The browser sends a stored path back as an ordinary form value when the record is saved,
 * so this is a real boundary and not a formality: without the pattern a crafted submission
 * could put `../../etc/passwd` in the column and have every render of that page ask
 * `/api/media` for it. That route refuses it too — see `resolveStoredPath` — and a column
 * that can only hold a well-formed path is one fewer thing depending on it being right.
 */
export const imagePathWrite = z.string().regex(STORED_IMAGE_PATH_PATTERN).nullable();

/** A gallery entry on the way in. Alt text is REQUIRED — an item exists because someone
 *  added a photograph, and a photograph nobody described is the accessibility regression
 *  this whole prompt was careful not to introduce. */
export const galleryItemWriteSchema = z.strictObject({
  path: z.string().regex(STORED_IMAGE_PATH_PATTERN),
  alt: z.string().min(1),
});

export type GalleryItemWrite = z.infer<typeof galleryItemWriteSchema>;
