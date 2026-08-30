// @vitest-environment node
/**
 * THE BUG THIS FILE EXISTS TO PREVENT A SECOND TIME.
 *
 * Prompt 10 added `image` and `imageAlt` to `founderSchema`. Every founder object already in
 * the database was written before those keys existed, so on a stored row they are ABSENT —
 * and `looseString` / `imagePath` accept `null` but not a missing key, because `.nullable()`
 * is deliberately not `.nullish()` (`./helpers`).
 *
 * `jsonArray` then degrades the whole array to `[]` rather than throwing, ON PURPOSE, so
 * that one malformed row cannot blank a page. The result, observed in a browser during this
 * prompt's own verification and not by any test: every founder failed to parse, `foundersEn`
 * came back empty, and the founders section of `/en/studio` and `/fa/studio` DISAPPEARED —
 * no error, no empty state, and all four gate commands green.
 *
 * That is the identical shape of the `studio.awards` bug prompt 5 found, and it is what the
 * warning at the end of that section means: the tolerance that keeps one bad row from
 * blanking a page is also what hides a schema that never matched.
 *
 * So: any key added to a stored JSON object must tolerate its own absence, and these tests
 * assert that for the two the image layer added.
 */
import { describe, expect, it } from 'vitest';
import { contactRowSchema } from '../contact';
import { mediaRowSchema } from '../media';
import { studioRowSchema } from '../studio';
import { galleryColumn, toLocaleGallery, toLocaleImage } from '../image';

/** A founder exactly as the seed wrote it, before `image` / `imageAlt` existed. */
const LEGACY_FOUNDER = {
  name: 'Farhad Rastgar',
  role: 'Co-founder, Principal',
  born: 'Born 1978, Tabriz',
  bio: 'Studied at Tehran University.',
};

describe('a JSON object written before the image keys existed', () => {
  it('STILL PARSES — the whole studio page depends on it', () => {
    const founders = studioRowSchema.shape.foundersEn.parse(JSON.stringify([LEGACY_FOUNDER]));

    // The assertion that matters is the LENGTH. An empty array here is the bug: the page
    // renders, the gate passes, and two founders are simply gone.
    expect(founders).toHaveLength(1);
    expect(founders[0].name).toBe('Farhad Rastgar');
  });

  it('normalizes the absent keys to the same values an empty one would have', () => {
    const [founder] = studioRowSchema.shape.foundersEn.parse(JSON.stringify([LEGACY_FOUNDER]));

    // `null` is "no portrait", which makes the page draw the generated one. `''` is "nothing
    // described", which is the same thing seen from the alt side.
    expect(founder.image).toBeNull();
    expect(founder.imageAlt).toBe('');
  });

  it('still parses a founder that DOES carry a portrait', () => {
    const path = '2026/08/0123456789abcdef0123456789abcdef.jpg';
    const [founder] = studioRowSchema.shape.foundersEn.parse(
      JSON.stringify([{ ...LEGACY_FOUNDER, image: path, imageAlt: 'Farhad in the studio' }]),
    );

    expect(founder.image).toBe(path);
    expect(founder.imageAlt).toBe('Farhad in the studio');
  });
});

describe('a gallery column', () => {
  it('degrades a NULL column to an empty list — the state of every existing row', () => {
    expect(galleryColumn.parse(null)).toEqual([]);
  });

  it('degrades unparseable JSON to an empty list rather than throwing', () => {
    // A leaf must not blank a route. An empty gallery costs two plates; a thrown `ZodError`
    // costs the page.
    expect(galleryColumn.parse('{not json')).toEqual([]);
  });

  it('drops an item whose stored path is not one the upload endpoint generated', () => {
    // `imagePath` catches to `null`, and `toLocaleGallery` then drops it: a path
    // `/api/media` would refuse to serve is, to a reader, the same as no path at all — and
    // one of those blanks a route while the other shows a drawing.
    const parsed = galleryColumn.parse(JSON.stringify([{ path: '../../etc/passwd', alt: 'nope' }]));
    expect(toLocaleGallery('en', parsed, parsed)).toEqual([]);
  });
});

/**
 * PROMPT 14 ADDED `gallery_en` / `gallery_fa` TO THREE MORE TABLES, and every row in all
 * three predates them. An `ALTER TABLE ... ADD COLUMN` with no default leaves NULL, so the
 * first read of every existing media entry, of the studio row and of the contact row hands
 * these schemas a NULL where a JSON string is declared.
 *
 * That is exactly the ban at the foot of AGENTS.md, and the reason it is a ban is that the
 * failure is SILENT: `jsonArray` degrades a payload it cannot read to `[]` so one bad row
 * cannot blank a page, which also means a schema that never matched looks like a record
 * with no pictures. It has cost this project two vanished page sections already.
 *
 * `galleryColumn` was built to tolerate it and the block above proves that in the abstract.
 * These three assert it through each table's own row schema, by name, because a column
 * declared with the wrong leaf is the mistake this catches and it is per-table.
 */
describe('the three columns prompt 14 added to rows that predate them', () => {
  it('media: a NULL gallery column reads as an empty gallery, not a failed row', () => {
    expect(mediaRowSchema.shape.galleryEn.parse(null)).toEqual([]);
    expect(mediaRowSchema.shape.galleryFa.parse(null)).toEqual([]);
  });

  it('studio: same — and this is the table that has silently blanked twice', () => {
    expect(studioRowSchema.shape.galleryEn.parse(null)).toEqual([]);
    expect(studioRowSchema.shape.galleryFa.parse(null)).toEqual([]);
  });

  it('contact: the gallery AND the cover trio it never had before', () => {
    expect(contactRowSchema.shape.galleryEn.parse(null)).toEqual([]);
    expect(contactRowSchema.shape.galleryFa.parse(null)).toEqual([]);
    // `imagePath` catches to `null` and `looseString` normalizes to `''`, so a row written
    // before these five columns existed reads as "no picture" rather than throwing.
    expect(contactRowSchema.shape.coverImage.parse(null)).toBeNull();
    expect(contactRowSchema.shape.coverAltEn.parse(null)).toBe('');
    expect(contactRowSchema.shape.coverAltFa.parse(null)).toBe('');
  });

  it('reads a real stored gallery back on all three, in order', () => {
    // The other half of the same check: tolerating NULL is worthless if the column cannot
    // also read a gallery an editor actually saved.
    const stored = JSON.stringify([
      { path: '2026/08/0123456789abcdef0123456789abcdef.jpg', alt: 'The street' },
      { path: '2026/08/11111111111111111111111111111111.png', alt: 'The stair' },
    ]);

    for (const shape of [
      mediaRowSchema.shape.galleryEn,
      studioRowSchema.shape.galleryEn,
      contactRowSchema.shape.galleryEn,
    ]) {
      const parsed = shape.parse(stored);
      expect(parsed).toHaveLength(2);
      expect(parsed.map(item => item.alt)).toEqual(['The street', 'The stair']);
    }
  });
});

describe('an image is only usable when it is also DESCRIBED', () => {
  const path = '2026/08/0123456789abcdef0123456789abcdef.jpg';

  it('answers null when the alt text for THIS locale is missing', () => {
    // The write schemas make alt text required alongside an image, so reaching this state
    // needs a row edited outside the application. The honest answer for one is the generated
    // drawing rather than a photograph no screen reader can describe — it degrades to the
    // thing the site already did well.
    expect(toLocaleImage('fa', path, 'Described in English', '')).toBeNull();
    expect(toLocaleImage('en', path, '', 'توصیف شده')).toBeNull();
  });

  it('answers the locale’s own sentence when both are present', () => {
    expect(toLocaleImage('fa', path, 'The courtyard', 'حیاط')).toEqual({ path, alt: 'حیاط' });
    expect(toLocaleImage('en', path, 'The courtyard', 'حیاط')).toEqual({
      path,
      alt: 'The courtyard',
    });
  });

  it('answers null when there is no path at all — the state of the whole archive', () => {
    expect(toLocaleImage('en', null, 'unused', 'unused')).toBeNull();
  });

  it('treats whitespace-only alt text as no alt text', () => {
    expect(toLocaleImage('en', path, '   ', '   ')).toBeNull();
  });
});
