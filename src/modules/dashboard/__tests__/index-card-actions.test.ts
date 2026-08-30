// @vitest-environment node
/**
 * The one write to an index card, plus the schema-agreement check
 * `schema-agreement.test.ts` performs for projects.
 *
 * The assertions specific to this shape are: `sectionId` is refused unless it is one of the
 * five NAV ids (the route's `notFound()` proves nothing about a POST that never passed
 * through it); only `CACHE_TAGS.indexCards` is purged; a section with no row is UPSERTED
 * rather than 404'd; and — the one that differs from every other editor in this module —
 * an empty Persian field is NOT filled in from the English, because the column degrades to
 * the message catalog instead and that is real Persian rather than an English word.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_TAGS } from '@/common/services/cache-tags';
import { NAV } from '@/common/constants/site';
import type { IndexCardRow } from '@/common/schemas/index-card';
import {
  EMPTY_INDEX_CARD_FORM,
  INDEX_CARD_FORM_FIELDS,
  INDEX_CARD_LOCALE_FIELDS,
  indexCardFormSchema,
  indexCardSubmissionSchema,
  toIndexCardColumns,
} from '../schemas/index-card-form';

const updateTag = vi.fn();
const updateIndexCard = vi.fn();
const readSession = vi.fn();

vi.mock('next/cache', () => ({ updateTag: (...args: unknown[]) => updateTag(...args) }));
vi.mock('@/common/services/index-card-service', () => ({
  updateIndexCard: (...args: unknown[]) => updateIndexCard(...args),
}));
vi.mock('@/common/services/session', () => ({ readSession: () => readSession() }));

const { updateIndexCardAction } = await import('../actions/index-card-actions');

const PATH = '2026/08/0123456789abcdef0123456789abcdef.jpg';

const VALID = {
  sectionId: 'projects',
  titleEn: 'Work',
  titleFa: '',
  captionEn: 'The archive',
  captionFa: '',
  coverImage: '',
  coverAltEn: '',
  coverAltFa: '',
};

const row = (overrides: Partial<IndexCardRow> = {}): IndexCardRow =>
  ({
    sectionId: 'projects',
    titleEn: 'Work',
    titleFa: '',
    captionEn: '',
    captionFa: '',
    coverImage: null,
    coverAltEn: '',
    coverAltFa: '',
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
    ...overrides,
  }) as IndexCardRow;

beforeEach(() => {
  vi.clearAllMocks();
  readSession.mockResolvedValue({ status: 'valid', session: { sub: 'admin', iat: 0, exp: 0 } });
  updateIndexCard.mockResolvedValue(row());
});

describe('the action', () => {
  it('refuses an unauthenticated save with 401 and touches nothing', async () => {
    readSession.mockResolvedValue({ status: 'anonymous' });

    const result = await updateIndexCardAction(VALID);

    expect(result).toEqual({ ok: false, status: 401 });
    expect(updateIndexCard).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('refuses a section that is not one of the five, even from a hand-written POST', async () => {
    // The route answers `notFound()` for this; an action is reachable with `curl` and never
    // passes through a route, so it has to answer for itself.
    const result = await updateIndexCardAction({ ...VALID, sectionId: 'shop' });

    expect(result.ok).toBe(false);
    expect(updateIndexCard).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('accepts every id NAV actually declares', async () => {
    for (const section of NAV) {
      vi.clearAllMocks();
      updateIndexCard.mockResolvedValue(row({ sectionId: section.id }));
      const result = await updateIndexCardAction({ ...VALID, sectionId: section.id });
      expect({ id: section.id, ok: result.ok }).toEqual({ id: section.id, ok: true });
    }
  });

  it('rejects an unknown key', async () => {
    const result = await updateIndexCardAction({ ...VALID, path: '/shop' });
    expect(result.ok).toBe(false);
    expect(updateIndexCard).not.toHaveBeenCalled();
  });

  it('saves and purges only the index-cards tag', async () => {
    const result = await updateIndexCardAction(VALID);

    expect(result).toEqual({ ok: true, data: undefined });
    expect(updateIndexCard).toHaveBeenCalledWith('projects', expect.any(Object));
    expect(updateTag).toHaveBeenCalledWith(CACHE_TAGS.indexCards);
    expect(updateTag).toHaveBeenCalledTimes(1);
  });

  it('refuses a picture with no Persian description, ON the Persian field', async () => {
    const result = await updateIndexCardAction({
      ...VALID,
      coverImage: PATH,
      coverAltEn: 'The archive index column',
      coverAltFa: '',
    });

    expect(result.ok).toBe(false);
    // Bound by field name, so `RecordForm` puts the editor in the Persian box rather than
    // showing "the submitted data is not valid" at the top of the form.
    expect(result).toMatchObject({ status: 422, body: { coverAltFa: expect.any(Array) } });
    expect(updateIndexCard).not.toHaveBeenCalled();
  });
});

describe('toIndexCardColumns', () => {
  it('does NOT fill an empty Persian column from the English one', () => {
    /**
     * The deliberate divergence from every other editor in this module. `withPersianFallback`
     * exists because a blank Persian page is worse than an untranslated one — but here an
     * empty column is not blank, it renders `nav.<id>` from the message catalog, which is
     * authored Persian. Copying "Work" in would replace good Persian with English AND
     * populate the column, so nothing afterwards could tell the translation was never done.
     */
    const columns = toIndexCardColumns(indexCardSubmissionSchema.parse(VALID));

    expect(columns.titleFa).toBe('');
    expect(columns.captionFa).toBe('');
  });

  it('normalizes an empty picture and alt to null, never to an empty string', () => {
    // `null` is "no picture"; `''` is a path that fails its own pattern — the same outcome
    // by accident rather than by design, in a column whose meaning is "a path".
    const columns = toIndexCardColumns(indexCardSubmissionSchema.parse(VALID));

    expect(columns.coverImage).toBeNull();
    expect(columns.coverAltEn).toBeNull();
    expect(columns.coverAltFa).toBeNull();
  });

  it('never emits sectionId — the row it writes is named by the argument', () => {
    expect(toIndexCardColumns(indexCardSubmissionSchema.parse(VALID))).not.toHaveProperty(
      'sectionId',
    );
  });
});

describe('the two schemas agree', () => {
  /**
   * The same assertion `schema-agreement.test.ts` makes for projects, and for the same
   * reason: two schemas are the right design — one carries user-facing copy, the other must
   * not — so the answer is to assert they judge every payload identically rather than to
   * merge them. `sectionId` is stripped for the form side, which does not hold it.
   */
  /** The form does not hold `sectionId` — the route does, and the action takes it. */
  const withoutSection = (payload: Record<string, unknown>): Record<string, unknown> => {
    const copy = { ...payload };
    delete copy.sectionId;
    return copy;
  };

  const verdicts = (payload: Record<string, unknown>) => ({
    form: indexCardFormSchema.safeParse(withoutSection(payload)).success,
    submission: indexCardSubmissionSchema.safeParse(payload).success,
  });

  const cases: Array<[string, Record<string, unknown>]> = [
    ['a complete valid card', VALID],
    ['an empty English title', { ...VALID, titleEn: '' }],
    ['a whitespace-only English title', { ...VALID, titleEn: '   ' }],
    ['an empty Persian title', { ...VALID, titleFa: '' }],
    ['an empty caption on both sides', { ...VALID, captionEn: '', captionFa: '' }],
    [
      'a picture described in both languages',
      { ...VALID, coverImage: PATH, coverAltEn: 'a', coverAltFa: 'ب' },
    ],
    ['a picture with no English description', { ...VALID, coverImage: PATH, coverAltFa: 'ب' }],
    ['a picture with no Persian description', { ...VALID, coverImage: PATH, coverAltEn: 'a' }],
    ['a picture with no description at all', { ...VALID, coverImage: PATH }],
    ['alt text with no picture', { ...VALID, coverAltEn: 'a', coverAltFa: 'ب' }],
    [
      'a cover path that was not generated by /api/uploads',
      { ...VALID, coverImage: '../../etc/passwd' },
    ],
  ];

  for (const [name, payload] of cases) {
    it(`judges ${name} the same way`, () => {
      const { form, submission } = verdicts(payload);
      expect({ form, submission }).toEqual({ form: submission, submission });
    });
  }

  it('the SUBMISSION schema rejects an unknown key and the FORM schema strips it', () => {
    const withExtra = { ...VALID, seed: 'kavan-shop' };
    expect(indexCardSubmissionSchema.safeParse(withExtra).success).toBe(false);

    const parsed = indexCardFormSchema.safeParse(withoutSection(withExtra));
    expect(parsed.success).toBe(true);
    expect(parsed.data).not.toHaveProperty('seed');
  });
});

describe('the form’s own metadata', () => {
  it('lists every field the schema declares, so applyFieldErrors can bind all of them', () => {
    expect([...INDEX_CARD_FORM_FIELDS].sort()).toEqual(
      Object.keys(indexCardFormSchema.shape).sort(),
    );
  });

  it('names both halves of every translated pair, and both are real fields', () => {
    for (const pair of INDEX_CARD_LOCALE_FIELDS) {
      expect(INDEX_CARD_FORM_FIELDS).toContain(pair.en);
      expect(INDEX_CARD_FORM_FIELDS).toContain(pair.fa);
      expect(pair.en.slice(0, -2)).toBe(pair.fa.slice(0, -2));
    }
  });

  it('seeds every field with a non-undefined default, so no input mounts uncontrolled', () => {
    for (const field of INDEX_CARD_FORM_FIELDS) {
      expect(EMPTY_INDEX_CARD_FORM[field]).toBeDefined();
    }
  });
});
