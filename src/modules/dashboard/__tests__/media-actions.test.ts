// @vitest-environment node
/**
 * The media write actions. Covers what is specific to this resource — the related-project
 * select's `''` -> `null` transform — plus the same authorization and tag-purge shape every
 * action in this module carries. See `project-actions.test.ts` for the fuller narration.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_TAGS, mediaTag } from '@/common/services/cache-tags';
import type { MediaRow } from '@/common/schemas/media';

const updateTag = vi.fn();
const createMediaEntry = vi.fn();
const updateMediaEntry = vi.fn();
const deleteMediaEntry = vi.fn();
const moveMediaEntry = vi.fn();
const getMediaRowById = vi.fn();
const readSession = vi.fn();

vi.mock('next/cache', () => ({
  updateTag: (...args: unknown[]) => updateTag(...args),
  revalidateTag: vi.fn(),
}));

vi.mock('@/common/services/media-service', () => ({
  createMediaEntry: (...args: unknown[]) => createMediaEntry(...args),
  updateMediaEntry: (...args: unknown[]) => updateMediaEntry(...args),
  deleteMediaEntry: (...args: unknown[]) => deleteMediaEntry(...args),
  moveMediaEntry: (...args: unknown[]) => moveMediaEntry(...args),
  getMediaRowById: (...args: unknown[]) => getMediaRowById(...args),
}));

vi.mock('@/common/services/session', () => ({ readSession: () => readSession() }));

const { createMediaAction, deleteMediaAction, moveMediaAction, updateMediaAction } =
  await import('../actions/media-actions');

const VALID = {
  slug: 'archdaily-qeytarieh-08',
  type: 'Publication',
  year: '2021',
  projectSlug: '',
  titleEn: 'Qeytarieh 08 on ArchDaily',
  titleFa: '',
  outletEn: 'ArchDaily',
  outletFa: '',
  blurbEn: '',
  blurbFa: '',
  authorEn: '',
  authorFa: '',
  excerptEn: '',
  excerptFa: '',
  contextEn: '',
  contextFa: '',
  factsEn: [],
  factsFa: [],
};

const row = (overrides: Partial<MediaRow> = {}): MediaRow =>
  ({
    id: 5,
    slug: 'archdaily-qeytarieh-08',
    type: 'Publication',
    year: 2021,
    projectSlug: null,
    sortOrder: 0,
    titleEn: 'Qeytarieh 08 on ArchDaily',
    titleFa: '',
    outletEn: 'ArchDaily',
    outletFa: '',
    blurbEn: '',
    blurbFa: '',
    authorEn: '',
    authorFa: '',
    excerptEn: '',
    excerptFa: '',
    contextEn: '',
    contextFa: '',
    factsEn: [],
    factsFa: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }) as MediaRow;

beforeEach(() => {
  vi.clearAllMocks();
  readSession.mockResolvedValue({ status: 'valid', session: { sub: 'admin', iat: 0, exp: 0 } });
  createMediaEntry.mockResolvedValue(row());
  updateMediaEntry.mockResolvedValue(row());
  deleteMediaEntry.mockResolvedValue(true);
  moveMediaEntry.mockResolvedValue(null);
  getMediaRowById.mockResolvedValue(row());
});

describe('authorization', () => {
  it('refuses every write with 401 when unauthenticated, and touches nothing', async () => {
    readSession.mockResolvedValue({ status: 'anonymous' });

    const results = await Promise.all([
      createMediaAction(VALID),
      updateMediaAction(5, VALID),
      deleteMediaAction(5),
      moveMediaAction({ id: 5, direction: 'up' }),
    ]);

    for (const result of results) expect(result).toEqual({ ok: false, status: 401 });
    expect(createMediaEntry).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });
});

describe('the related-project field', () => {
  it('converts the select’s empty sentinel to null', async () => {
    await createMediaAction({ ...VALID, projectSlug: '' });
    const [payload] = createMediaEntry.mock.calls[0] as [Record<string, unknown>];
    expect(payload.projectSlug).toBeNull();
  });

  it('passes a chosen project slug through unchanged', async () => {
    await createMediaAction({ ...VALID, projectSlug: 'qeytarieh-08-residence' });
    const [payload] = createMediaEntry.mock.calls[0] as [Record<string, unknown>];
    expect(payload.projectSlug).toBe('qeytarieh-08-residence');
  });
});

describe('validation', () => {
  it('rejects a type outside the taxonomy', async () => {
    const result = await createMediaAction({ ...VALID, type: 'Podcast' });
    expect(result.ok).toBe(false);
    expect(createMediaEntry).not.toHaveBeenCalled();
  });

  it('rejects an unknown key', async () => {
    const result = await createMediaAction({ ...VALID, sortOrder: -1 });
    expect(result.ok).toBe(false);
  });
});

describe('the write path', () => {
  it('creates and purges the collection and the new instance tag', async () => {
    createMediaEntry.mockResolvedValue(row({ slug: 'new-press' }));

    const result = await createMediaAction({ ...VALID, slug: 'new-press' });

    expect(result).toEqual({ ok: true, data: { slug: 'new-press' } });
    expect(updateTag).toHaveBeenCalledWith(CACHE_TAGS.media);
    expect(updateTag).toHaveBeenCalledWith(mediaTag('new-press'));
  });

  it('purges the old slug too on a rename', async () => {
    getMediaRowById.mockResolvedValue(row({ slug: 'old' }));
    updateMediaEntry.mockResolvedValue(row({ slug: 'new' }));

    await updateMediaAction(5, { ...VALID, slug: 'new' });

    expect(updateTag).toHaveBeenCalledWith(mediaTag('new'));
    expect(updateTag).toHaveBeenCalledWith(mediaTag('old'));
  });

  it('deletes and purges the instance tag read before the delete', async () => {
    getMediaRowById.mockResolvedValue(row({ slug: 'doomed' }));

    const result = await deleteMediaAction(5);

    expect(result).toEqual({ ok: true, data: undefined });
    expect(updateTag).toHaveBeenCalledWith(mediaTag('doomed'));
  });
});
