// @vitest-environment node
/**
 * THE ONE RULE THIS PROMPT COULD HAVE GOT WRONG QUIETLY: an image must be described, in
 * both languages, and the Persian description must NOT be filled in from the English.
 *
 * Both halves are asserted here because both are easy to "fix" into a regression:
 *
 *  - Dropping the requirement makes an undescribed photograph saveable, which is an
 *    accessibility regression on a site that until this prompt had no images to get wrong.
 *  - ADDING a fallback — copying `coverAltEn` into `coverAltFa` the way every other Persian
 *    field is filled — looks like consistency and is the worse failure: the column is
 *    populated, so nothing flags it, and a Persian screen reader reads out an English
 *    sentence with Persian phonetics. `../image.ts`'s header carries the full argument.
 *
 * The schemas are checked through the PROJECT editor rather than in isolation, because the
 * rule reaching the real form and submission schemas is the thing worth pinning — a helper
 * that is correct and unwired is the bug this file is meant to catch.
 */
import { describe, expect, it } from 'vitest';
import {
  EMPTY_PROJECT_FORM,
  projectFormSchema,
  projectSubmissionSchema,
  withPersianFallback,
} from '../project-form';

const PATH = '2026/08/0123456789abcdef0123456789abcdef.jpg';

/** A minimal valid project, with whatever image state the case is about. */
const values = (over: Partial<typeof EMPTY_PROJECT_FORM> = {}) => ({
  ...EMPTY_PROJECT_FORM,
  slug: 'qeytarieh-08-residence',
  types: ['Residential'],
  status: 'Completed',
  scale: 'Medium',
  year: '2021',
  titleEn: 'Qeytarieh 08 Residence',
  ...over,
});

/** The field keys a failed parse named. */
const failedFields = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[] }[] };
}) => (result.error?.issues ?? []).map(issue => issue.path.join('.'));

describe('a record with no image', () => {
  it('is valid — which is the state of the entire archive', () => {
    // 76 projects have no photograph and most never will. Requiring alt text
    // unconditionally would make every one of them unsaveable until somebody described an
    // image that does not exist.
    expect(projectFormSchema.safeParse(values()).success).toBe(true);
  });

  it('stores NULL rather than an empty string in every image column', () => {
    // `null` means "no image"; `''` would be a path that fails its own pattern — the same
    // outcome by accident rather than by design, in a column whose meaning is "a path".
    const parsed = projectSubmissionSchema.parse(values());
    const row = withPersianFallback(parsed);

    expect(row.coverImage).toBeNull();
    expect(row.coverAltEn).toBeNull();
    expect(row.coverAltFa).toBeNull();
    expect(row.galleryEn).toEqual([]);
  });
});

describe('a cover image with missing alt text', () => {
  it('is REFUSED when the Persian description is empty, naming that field', () => {
    // The verification step this exists for: "saving with an image and an empty Persian alt
    // text is refused, with the error bound to that field". `RecordForm` binds a 422 by
    // field NAME and moves focus to it, so the path here is what makes the refusal
    // actionable rather than a sentence at the top of a long form.
    const result = projectFormSchema.safeParse(
      values({ coverImage: PATH, coverAltEn: 'The courtyard from the street', coverAltFa: '' }),
    );

    expect(result.success).toBe(false);
    expect(failedFields(result)).toContain('coverAltFa');
    expect(failedFields(result)).not.toContain('coverAltEn');
  });

  it('is refused when the English description is empty', () => {
    const result = projectFormSchema.safeParse(
      values({ coverImage: PATH, coverAltEn: '', coverAltFa: 'حیاط از خیابان' }),
    );

    expect(result.success).toBe(false);
    expect(failedFields(result)).toContain('coverAltEn');
  });

  it('treats whitespace as empty', () => {
    const result = projectFormSchema.safeParse(
      values({ coverImage: PATH, coverAltEn: 'A', coverAltFa: '   ' }),
    );
    expect(result.success).toBe(false);
  });

  it('is refused by the SUBMISSION schema too, not only by the form', () => {
    // The form's validation proves nothing about a hand-written POST — the action is a
    // public HTTP endpoint. Both schemas carry the rule for the same reason both carry
    // every other one.
    const result = projectSubmissionSchema.safeParse(
      values({ coverImage: PATH, coverAltEn: 'Described', coverAltFa: '' }),
    );
    expect(result.success).toBe(false);
  });
});

describe('the Persian alt text is NOT filled in from the English', () => {
  it('keeps the two descriptions distinct on the way to the columns', () => {
    // Every other Persian text column left blank is filled with its English counterpart by
    // this same function. Alt text is the deliberate exception, and this asserts that the
    // exception survives — a `fallbackText` added to these three lines would pass every
    // other test in the repository.
    const parsed = projectSubmissionSchema.parse(
      values({
        coverImage: PATH,
        coverAltEn: 'The courtyard from the street',
        coverAltFa: 'حیاط از خیابان',
        // A prose field left blank, to show the contrast in the same assertion.
        blurbEn: 'A courtyard house in Qeytarieh.',
        blurbFa: '',
      }),
    );
    const row = withPersianFallback(parsed);

    expect(row.coverAltFa).toBe('حیاط از خیابان');
    expect(row.coverAltEn).toBe('The courtyard from the street');
    // The contrast: prose DOES fall back, and must keep doing so.
    expect(row.blurbFa).toBe('A courtyard house in Qeytarieh.');
  });
});

describe('the gallery', () => {
  it('requires a description on every item, in both languages', () => {
    const result = projectFormSchema.safeParse(
      values({ gallery: [{ path: PATH, altEn: 'The stair', altFa: '' }] }),
    );

    expect(result.success).toBe(false);
    expect(failedFields(result)).toContain('gallery.0.altFa');
  });

  it('splits ONE form list into two index-aligned columns', () => {
    // The reason the form does not mirror the storage: with two independent editors an
    // editor could add a photograph to one language and not the other, and item `i` would
    // stop being the same picture in both — a bug with no symptom in English.
    const second = '2026/08/11111111111111111111111111111111.png';
    const parsed = projectSubmissionSchema.parse(
      values({
        gallery: [
          { path: PATH, altEn: 'The courtyard', altFa: 'حیاط' },
          { path: second, altEn: 'The stair', altFa: 'پلکان' },
        ],
      }),
    );
    const row = withPersianFallback(parsed);

    expect(row.galleryEn).toEqual([
      { path: PATH, alt: 'The courtyard' },
      { path: second, alt: 'The stair' },
    ]);
    expect(row.galleryFa).toEqual([
      { path: PATH, alt: 'حیاط' },
      { path: second, alt: 'پلکان' },
    ]);
    // The property that matters, stated directly: same paths, same order, both columns.
    expect(row.galleryFa.map(item => item.path)).toEqual(row.galleryEn.map(item => item.path));
  });
});

describe('the stored path is validated on the way IN', () => {
  it('refuses a path the upload endpoint did not generate', () => {
    // The browser sends the path back as an ordinary form value on save, so this is a real
    // boundary: without it a crafted submission could put a traversal in the column and
    // have every render of the page ask `/api/media` for it.
    for (const bad of ['../../etc/passwd', '/etc/passwd', 'photo.jpg', '2026/08/nope.jpg']) {
      expect(projectSubmissionSchema.safeParse(values({ coverImage: bad })).success).toBe(false);
    }
  });
});
