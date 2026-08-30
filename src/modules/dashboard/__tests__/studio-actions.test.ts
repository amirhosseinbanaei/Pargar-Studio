// @vitest-environment node
/**
 * The one write to the `studio` singleton. No slug, no reorder — the assertions specific to
 * this shape are: no id argument at all, a `null` service result (the database has not
 * been seeded) is a 404 rather than a false "Saved", and only `CACHE_TAGS.studio` is ever
 * purged, since a singleton has no instance tag to go with it.
 */
import { beforeEach, expect, it, vi } from 'vitest';
import { CACHE_TAGS } from '@/common/services/cache-tags';
import type { StudioRow } from '@/common/schemas/studio';

const updateTag = vi.fn();
const updateStudio = vi.fn();
const readSession = vi.fn();

vi.mock('next/cache', () => ({ updateTag: (...args: unknown[]) => updateTag(...args) }));
vi.mock('@/common/services/studio-service', () => ({
  updateStudio: (...args: unknown[]) => updateStudio(...args),
}));
vi.mock('@/common/services/session', () => ({ readSession: () => readSession() }));

const { updateStudioAction } = await import('../actions/studio-actions');

/**
 * Every list is populated on BOTH sides, which it did not have to be before prompt 14:
 * `fallbackList` used to fill an empty Persian list from the English one on save, and
 * `requireTranslatedList` refuses that save now. `manifestoFa` is a prose field and stays
 * empty here on purpose — prose is still optional in both languages, and the assertion
 * below is that it is stored empty rather than filled in.
 */
const VALID = {
  manifestoEn: 'We build for climate and craft.',
  manifestoFa: '',
  // No portrait — the founders keep the generated one, drawn from the English name. That is
  // the one place prompt 14 left the art layer rendering for a record; see `StudioScreen`.
  foundersEn: [{ name: 'A', role: 'Founder', born: '1980', bio: '', image: '', imageAlt: '' }],
  foundersFa: [{ name: 'الف', role: '', born: '', bio: '', image: '', imageAlt: '' }],
  statsEn: [{ label: 'Projects', value: '76' }],
  statsFa: [{ label: 'پروژه‌ها', value: '۷۶' }],
  teamEn: ['Ada'],
  teamFa: ['آدا'],
  alumniEn: [],
  alumniFa: [],
  awardsEn: [],
  awardsFa: [],
  chaptersEn: [],
  chaptersFa: [],
  // The page's own gallery, new in prompt 14. `strictObject` requires the key.
  gallery: [],
};

const row = (overrides: Partial<StudioRow> = {}): StudioRow =>
  ({
    id: 1,
    manifestoEn: 'We build for climate and craft.',
    manifestoFa: 'ما برای اقلیم و صنعتگری می‌سازیم.',
    foundersEn: [],
    foundersFa: [],
    statsEn: [],
    statsFa: [],
    teamEn: [],
    teamFa: [],
    alumniEn: [],
    alumniFa: [],
    awardsEn: [],
    awardsFa: [],
    chaptersEn: [],
    chaptersFa: [],
    galleryEn: [],
    galleryFa: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }) as StudioRow;

beforeEach(() => {
  vi.clearAllMocks();
  readSession.mockResolvedValue({ status: 'valid', session: { sub: 'admin', iat: 0, exp: 0 } });
  updateStudio.mockResolvedValue(row());
});

it('refuses an unauthenticated save with 401 and touches nothing', async () => {
  readSession.mockResolvedValue({ status: 'anonymous' });

  const result = await updateStudioAction(VALID);

  expect(result).toEqual({ ok: false, status: 401 });
  expect(updateStudio).not.toHaveBeenCalled();
  expect(updateTag).not.toHaveBeenCalled();
});

it('rejects an unknown key', async () => {
  const result = await updateStudioAction({ ...VALID, id: 2 });
  expect(result.ok).toBe(false);
  expect(updateStudio).not.toHaveBeenCalled();
});

/**
 * ~~duplicates an empty Persian manifesto and list from the English side~~ REVERSED IN
 * PROMPT 14. Kept and inverted rather than deleted: `fallbackText` / `fallbackList` are
 * exactly the kind of helper somebody re-adds for consistency, and this is what would fail.
 */
it('stores an empty Persian manifesto EMPTY rather than filling it from the English', async () => {
  await updateStudioAction(VALID);
  const [payload] = updateStudio.mock.calls[0] as [Record<string, unknown>];
  expect(payload.manifestoFa).toBe('');

  /**
   * The founders list is compared against the COLUMN form rather than against `VALID`,
   * because the two image fields are normalized on the way in: `''` means "no portrait" in
   * a form and `null` means it in a column, and a column whose meaning is "a path" must not
   * hold an empty string.
   */
  expect(payload.foundersFa).toEqual([
    { name: 'الف', role: '', born: '', bio: '', image: null, imageAlt: null },
  ]);
});

it('REFUSES an English list beside an empty Persian one, on this record most of all', async () => {
  // Six of this record's seven fields are lists, and an empty Persian one is a whole
  // missing SECTION of `/fa/studio` rather than a blank line — the failure this table has
  // already produced twice by other means (`awards`, `founders`).
  const result = await updateStudioAction({ ...VALID, teamFa: [], statsFa: [] });

  expect(result).toEqual({
    ok: false,
    status: 422,
    body: expect.objectContaining({ teamFa: expect.any(Array), statsFa: expect.any(Array) }),
  });
  expect(updateStudio).not.toHaveBeenCalled();
});

it('REFUSES a founder portrait nobody described — the gap prompt 14 closed', async () => {
  // Prompt 10 made alt text required wherever there is an image but never wired the rule
  // into this editor, so an undescribed portrait saved cleanly and `StudioScreen` then fell
  // back to the GENERATED one — an uploaded photograph that simply never appeared.
  const result = await updateStudioAction({
    ...VALID,
    foundersEn: [
      {
        name: 'A',
        role: 'Founder',
        born: '1980',
        bio: '',
        image: '2026/08/0123456789abcdef0123456789abcdef.jpg',
        imageAlt: '',
      },
    ],
  });

  expect(result).toEqual({
    ok: false,
    status: 422,
    body: expect.objectContaining({ foundersEn: expect.any(Array) }),
  });
  expect(updateStudio).not.toHaveBeenCalled();
});

it('copies each founder’s PORTRAIT across by index, and never their description', async () => {
  /**
   * The portrait is one fact and the sentence describing it is two. The uploader is on the
   * English editor only, so the path is written into the Persian array here — which is what
   * stops the two index-aligned arrays disagreeing about which photograph a founder has, a
   * bug with no symptom in English.
   *
   * The alt text is the opposite and is never copied — once the ONE translated field in
   * this codebase that did not fall back, and since prompt 14 simply ordinary. See
   * `../schemas/image.ts`'s header.
   */
  const path = '2026/08/0123456789abcdef0123456789abcdef.jpg';
  await updateStudioAction({
    ...VALID,
    foundersEn: [
      {
        name: 'A',
        role: 'Founder',
        born: '1980',
        bio: '',
        image: path,
        imageAlt: 'A in the studio',
      },
    ],
    foundersFa: [
      { name: 'الف', role: '', born: '', bio: '', image: '', imageAlt: 'الف در استودیو' },
    ],
  });

  const [payload] = updateStudio.mock.calls[0] as [Record<string, unknown>];
  const foundersFa = payload.foundersFa as Array<{ image: string | null; imageAlt: string | null }>;

  expect(foundersFa[0].image).toBe(path);
  expect(foundersFa[0].imageAlt).toBe('الف در استودیو');
});

it('saves and purges only the studio tag — there is no instance tag for a singleton', async () => {
  const result = await updateStudioAction(VALID);

  expect(result).toEqual({ ok: true, data: undefined });
  expect(updateTag).toHaveBeenCalledWith(CACHE_TAGS.studio);
  expect(updateTag).toHaveBeenCalledTimes(1);
});

it('answers 404 rather than a false success when the database has not been seeded', async () => {
  updateStudio.mockResolvedValue(null);

  const result = await updateStudioAction(VALID);

  expect(result).toEqual({ ok: false, status: 404 });
  expect(updateTag).not.toHaveBeenCalled();
});
