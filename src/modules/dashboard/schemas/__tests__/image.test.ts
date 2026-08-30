// @vitest-environment node
/**
 * THE ONE RULE THIS PROMPT COULD HAVE GOT WRONG QUIETLY: an image must be described, in
 * both languages, and the Persian description must NOT be filled in from the English.
 *
 * Both halves are asserted here because both are easy to "fix" into a regression:
 *
 *  - Dropping the requirement makes an undescribed photograph saveable, which is an
 *    accessibility regression on a site that until this prompt had no images to get wrong.
 *  - ADDING a fallback — copying `coverAltEn` into `coverAltFa` — looks like consistency and
 *    is the worse failure: the column is populated, so nothing flags it, and a Persian
 *    screen reader reads out an English sentence with Persian phonetics. `../image.ts`'s
 *    header carries the full argument, which prompt 14 generalized to every field.
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
  toProjectColumns,
} from '../project-form';
import { designWorkFormSchema } from '../design-work-form';

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
  // Required in both languages since prompt 14, so every valid payload carries one.
  titleFa: 'خانه قیطریه ۰۸',
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
    const row = toProjectColumns(parsed);

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

describe('NOTHING is filled in from the English — prompt 14 generalized the alt-text rule', () => {
  it('keeps every Persian value exactly as it was typed, including an empty one', () => {
    // Alt text used to be the ONE field that did not fall back; the rest were filled with
    // their English counterpart by this same function. Prompt 14 removed the fallback
    // everywhere, so this now asserts the general rule: whatever the editor typed is what
    // reaches the column, and a blank stays blank.
    //
    // Re-adding `fallbackText` to any line of `toProjectColumns` would pass every other
    // test in this repository and fail here.
    const parsed = projectSubmissionSchema.parse(
      values({
        titleFa: 'خانه قیطریه ۰۸',
        coverImage: PATH,
        coverAltEn: 'The courtyard from the street',
        coverAltFa: 'حیاط از خیابان',
        // An OPTIONAL prose pair with the Persian half blank. This is the case that used
        // to be silently copied and is the whole point of the assertion below.
        blurbEn: 'A courtyard house in Qeytarieh.',
        blurbFa: '',
      }),
    );
    const row = toProjectColumns(parsed);

    expect(row.coverAltFa).toBe('حیاط از خیابان');
    expect(row.coverAltEn).toBe('The courtyard from the street');
    expect(row.blurbFa).toBe('');
    expect(row.blurbEn).toBe('A courtyard house in Qeytarieh.');
  });

  it('REFUSES an empty Persian title rather than copying the English one', () => {
    // The other half, and the consequence stated in AGENTS.md: an editor can no longer save
    // an English-only record. The refusal names the Persian field, so `RecordForm` binds it
    // to that box rather than to the top of the form.
    const result = projectFormSchema.safeParse(values({ titleFa: '' }));

    expect(result.success).toBe(false);
    expect(failedFields(result)).toContain('titleFa');
  });

  it('treats a whitespace-only Persian title as empty on both schemas', () => {
    expect(projectFormSchema.safeParse(values({ titleFa: '   ' })).success).toBe(false);
    expect(projectSubmissionSchema.safeParse(values({ titleFa: '   ' })).success).toBe(false);
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
    const row = toProjectColumns(parsed);

    expect(row.galleryEn).toEqual([
      { path: PATH, alt: 'The courtyard' },
      { path: second, alt: 'The stair' },
    ]);
    expect(row.galleryFa).toEqual([
      { path: PATH, alt: 'حیاط' },
      { path: second, alt: 'پلکان' },
    ]);
    // The property that matters, stated directly: same paths, same order, both columns.
    expect(row.galleryFa.map(image => image.path)).toEqual(row.galleryEn.map(image => image.path));
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

/**
 * `requireTranslatedList` — THE RULE THAT MAKES DELETING `fallbackList` SAFE.
 *
 * `fallbackList` used to copy an empty Persian list wholesale from the English one on save.
 * Removing it without replacing it would have been a NEW way to blank a page section
 * silently — the failure this codebase has already produced twice by other means — so the
 * empty Persian list is refused instead, at the field, before anything is stored.
 *
 * Tested through the design-work editor, which carries two such lists, because a helper
 * that is correct and unwired is exactly the bug this file exists to catch.
 */
describe('a list translated in one language must be translated in both', () => {
  const work = (over: Record<string, unknown> = {}) => ({
    slug: 'kavan-identity',
    category: 'Branding',
    status: 'Completed',
    year: '2021',
    titleEn: 'Kavan Identity',
    titleFa: 'هویت کاوان',
    blurbEn: '',
    blurbFa: '',
    clientEn: '',
    clientFa: '',
    scopeEn: '',
    scopeFa: '',
    materialsEn: '',
    materialsFa: '',
    descriptionEn: '',
    descriptionFa: '',
    teamEn: [],
    teamFa: [],
    factsEn: [],
    factsFa: [],
    coverImage: '',
    coverAltEn: '',
    coverAltFa: '',
    gallery: [],
    ...over,
  });

  it('accepts two empty lists — nothing to translate is not a failure', () => {
    expect(designWorkFormSchema.safeParse(work()).success).toBe(true);
  });

  it('REFUSES an English list beside an empty Persian one, naming the Persian field', () => {
    const result = designWorkFormSchema.safeParse(work({ teamEn: ['Farhad Rastgar'] }));

    expect(result.success).toBe(false);
    // On `teamFa`, so `RecordForm` binds it to that editor rather than to the top of a form
    // six sections long.
    expect(failedFields(result)).toContain('teamFa');
  });

  it('accepts them once the Persian list has rows, whatever its length', () => {
    // Deliberately not a length check. An editor may legitimately translate three names as
    // two, and a rule that counted rows would refuse a correct record.
    const result = designWorkFormSchema.safeParse(
      work({ teamEn: ['Farhad Rastgar', 'Mahsa Aminzadeh'], teamFa: ['فرهاد رستگار'] }),
    );
    expect(result.success).toBe(true);
  });

  it('is ONE-DIRECTIONAL — a Persian list beside an empty English one is fine', () => {
    // English is what every remaining fallback on the site leans on, and an editor working
    // Persian-first is not doing anything wrong.
    const result = designWorkFormSchema.safeParse(work({ teamFa: ['فرهاد رستگار'] }));
    expect(result.success).toBe(true);
  });
});
