// @vitest-environment node
/**
 * The design-work write actions. Same shape and same concerns as `project-actions.test.ts`
 * — an unauthorized call must touch nothing, and the exact cache tags must be purged from
 * the shared vocabulary, never as literals. See that file for the fuller narration; this
 * one asserts the same properties without repeating every case project's suite covers.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_TAGS, designWorkTag } from '@/common/services/cache-tags';
import type { DesignWorkRow } from '@/common/schemas/design-work';

const updateTag = vi.fn();
const revalidateTag = vi.fn();

const createDesignWork = vi.fn();
const updateDesignWork = vi.fn();
const deleteDesignWork = vi.fn();
const moveDesignWork = vi.fn();
const getDesignWorkRowById = vi.fn();

const readSession = vi.fn();
const unknownTermErrors = vi.fn();

vi.mock('next/cache', () => ({
  updateTag: (...args: unknown[]) => updateTag(...args),
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
}));

vi.mock('@/common/services/design-work-service', () => ({
  createDesignWork: (...args: unknown[]) => createDesignWork(...args),
  updateDesignWork: (...args: unknown[]) => updateDesignWork(...args),
  deleteDesignWork: (...args: unknown[]) => deleteDesignWork(...args),
  moveDesignWork: (...args: unknown[]) => moveDesignWork(...args),
  getDesignWorkRowById: (...args: unknown[]) => getDesignWorkRowById(...args),
}));

vi.mock('@/common/services/session', () => ({
  readSession: () => readSession(),
}));

/**
 * The taxonomy service is mocked like every other service here: this file tests the ACTION's
 * own logic, and reaching the real one would open a database connection. `unknownTermErrors`
 * resolving to `{}` is "every value is a term" — the case the write path takes.
 */
vi.mock('@/common/services/taxonomy-service', () => ({
  unknownTermErrors: (...args: unknown[]) => unknownTermErrors(...args),
}));

const {
  createDesignWorkAction,
  deleteDesignWorkAction,
  moveDesignWorkAction,
  updateDesignWorkAction,
} = await import('../actions/design-work-actions');

const VALID = {
  slug: 'kavan-identity',
  category: 'Branding',
  status: 'Completed',
  year: '2021',
  titleEn: 'Kavan Identity',
  titleFa: '',
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
};

const row = (overrides: Partial<DesignWorkRow> = {}): DesignWorkRow =>
  ({
    id: 3,
    slug: 'kavan-identity',
    category: 'Branding',
    year: 2021,
    status: 'Completed',
    sortOrder: 0,
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
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }) as DesignWorkRow;

const signedIn = () =>
  readSession.mockResolvedValue({ status: 'valid', session: { sub: 'admin', iat: 0, exp: 0 } });

beforeEach(() => {
  vi.clearAllMocks();
  // Every value is a declared term unless a test says otherwise.
  unknownTermErrors.mockResolvedValue({});
  signedIn();
  createDesignWork.mockResolvedValue(row());
  updateDesignWork.mockResolvedValue(row());
  deleteDesignWork.mockResolvedValue(true);
  moveDesignWork.mockResolvedValue(null);
  getDesignWorkRowById.mockResolvedValue(row());
});

describe('authorization', () => {
  it('refuses every write with 401 when the session is not valid, and touches nothing', async () => {
    readSession.mockResolvedValue({ status: 'anonymous' });

    const results = await Promise.all([
      createDesignWorkAction(VALID),
      updateDesignWorkAction(3, VALID),
      deleteDesignWorkAction(3),
      moveDesignWorkAction({ id: 3, direction: 'up' }),
    ]);

    for (const result of results) expect(result).toEqual({ ok: false, status: 401 });
    expect(createDesignWork).not.toHaveBeenCalled();
    expect(updateDesignWork).not.toHaveBeenCalled();
    expect(deleteDesignWork).not.toHaveBeenCalled();
    expect(moveDesignWork).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });
});

describe('validation', () => {
  it('answers 422 with field-keyed errors and writes nothing', async () => {
    const result = await createDesignWorkAction({ ...VALID, slug: 'Not A Slug' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(422);
    expect(result.body).toHaveProperty('slug');
    expect(createDesignWork).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('rejects an unknown key — strictObject refuses a crafted sortOrder', async () => {
    const result = await createDesignWorkAction({ ...VALID, sortOrder: -999 });
    expect(result.ok).toBe(false);
    expect(createDesignWork).not.toHaveBeenCalled();
  });

  it('rejects a category with no term, 422, naming the field, and writes nothing', async () => {
    // A table lookup since prompt 9, not a `z.enum` — see `media-actions.test.ts`.
    unknownTermErrors.mockResolvedValue({ category: ['“Ceramics” is not a category term.'] });

    const result = await createDesignWorkAction({ ...VALID, category: 'Ceramics' });

    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(422);
    expect(result.body).toHaveProperty('category');
    expect(createDesignWork).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('asks about both of this subject’s axes', async () => {
    await createDesignWorkAction(VALID);
    expect(unknownTermErrors).toHaveBeenCalledWith('design', [
      { field: 'category', axis: 'category', values: ['Branding'] },
      { field: 'status', axis: 'status', values: ['Completed'] },
    ]);
  });
});

describe('the write path', () => {
  it('fills an empty Persian title with the English one', async () => {
    await createDesignWorkAction(VALID);
    const [payload] = createDesignWork.mock.calls[0] as [Record<string, unknown>];
    expect(payload.titleFa).toBe(VALID.titleEn);
  });

  it('duplicates an empty Persian team/facts list from the English one', async () => {
    await createDesignWorkAction({
      ...VALID,
      teamEn: ['Ada'],
      teamFa: [],
      factsEn: [{ k: 'Edition', v: 'One-off' }],
      factsFa: [],
    });
    const [payload] = createDesignWork.mock.calls[0] as [Record<string, unknown>];
    expect(payload.teamFa).toEqual(['Ada']);
    expect(payload.factsFa).toEqual([{ k: 'Edition', v: 'One-off' }]);
  });

  it('creates and purges the collection and the new instance tag', async () => {
    createDesignWork.mockResolvedValue(row({ slug: 'new-object' }));

    const result = await createDesignWorkAction({ ...VALID, slug: 'new-object' });

    expect(result).toEqual({ ok: true, data: { slug: 'new-object' } });
    expect(updateTag).toHaveBeenCalledWith(CACHE_TAGS.designWorks);
    expect(updateTag).toHaveBeenCalledWith(designWorkTag('new-object'));
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('purges the OLD slug too when updating renames the record', async () => {
    getDesignWorkRowById.mockResolvedValue(row({ slug: 'old-name' }));
    updateDesignWork.mockResolvedValue(row({ slug: 'new-name' }));

    const result = await updateDesignWorkAction(3, { ...VALID, slug: 'new-name' });

    expect(result).toEqual({ ok: true, data: { slug: 'new-name' } });
    expect(updateTag).toHaveBeenCalledWith(designWorkTag('new-name'));
    expect(updateTag).toHaveBeenCalledWith(designWorkTag('old-name'));
  });

  it('answers 404 on update when the row was deleted from another tab', async () => {
    getDesignWorkRowById.mockResolvedValue(null);

    const result = await updateDesignWorkAction(3, VALID);

    expect(result).toEqual({ ok: false, status: 404 });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('deletes and purges the instance tag read BEFORE the delete', async () => {
    getDesignWorkRowById.mockResolvedValue(row({ slug: 'doomed' }));

    const result = await deleteDesignWorkAction(3);

    expect(result).toEqual({ ok: true, data: undefined });
    expect(updateTag).toHaveBeenCalledWith(designWorkTag('doomed'));
  });

  it('purges both rows a move traded places between', async () => {
    moveDesignWork.mockResolvedValue({ moved: row({ slug: 'a' }), displaced: row({ slug: 'b' }) });

    await moveDesignWorkAction({ id: 3, direction: 'down' });

    expect(updateTag).toHaveBeenCalledWith(designWorkTag('a'));
    expect(updateTag).toHaveBeenCalledWith(designWorkTag('b'));
  });
});
