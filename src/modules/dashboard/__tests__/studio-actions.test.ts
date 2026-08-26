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

const VALID = {
  manifestoEn: 'We build for climate and craft.',
  manifestoFa: '',
  foundersEn: [{ name: 'A', role: 'Founder', born: '1980', bio: '' }],
  foundersFa: [],
  statsEn: [{ label: 'Projects', value: '76' }],
  statsFa: [],
  teamEn: ['Ada'],
  teamFa: [],
  alumniEn: [],
  alumniFa: [],
  awardsEn: [],
  awardsFa: [],
  chaptersEn: [],
  chaptersFa: [],
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

it('duplicates an empty Persian manifesto and list from the English side', async () => {
  await updateStudioAction(VALID);
  const [payload] = updateStudio.mock.calls[0] as [Record<string, unknown>];
  expect(payload.manifestoFa).toBe(VALID.manifestoEn);
  expect(payload.foundersFa).toEqual(VALID.foundersEn);
  expect(payload.teamFa).toEqual(VALID.teamEn);
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
