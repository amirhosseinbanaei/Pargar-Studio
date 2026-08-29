// @vitest-environment node
/**
 * The taxonomy write actions, tested at the trust boundary.
 *
 * The same two things every action suite in this module asserts, plus one that is specific
 * to this table and is the most expensive thing here to get wrong:
 *
 *  1. **An unauthorized call touches NOTHING.** A 401 returned after the write has already
 *     happened is still a breach and looks identical from the outside.
 *  2. **Which cache tags were purged**, compared against the `cache-tags` vocabulary rather
 *     than against hardcoded strings, so a rename that broke the app fails here.
 *  3. **THE PURGE IS A PAIR.** Every term write invalidates `taxonomy-terms` AND the
 *     subject's collection tag, because a public rail is one cached entry composed from both
 *     tables. Purging only the first is a save that reports success and changes nothing a
 *     reader can see — invisible in every other kind of test.
 *
 * The service layer is mocked, so this is the action's own logic and nothing below it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_TAGS, taxonomySubjectTag } from '@/common/services/cache-tags';
import type { TaxonomyTermRow } from '@/common/schemas/taxonomy';

const updateTag = vi.fn();
const revalidateTagSpy = vi.fn();

const createTaxonomyTerm = vi.fn();
const updateTaxonomyTerm = vi.fn();
const setTaxonomyTermVisible = vi.fn();
const deleteTaxonomyTerm = vi.fn();
const moveTaxonomyTerm = vi.fn();
const listTaxonomyRows = vi.fn();

const readSession = vi.fn();

vi.mock('next/cache', () => ({
  updateTag: (...args: unknown[]) => updateTag(...args),
  revalidateTag: (...args: unknown[]) => revalidateTagSpy(...args),
}));

vi.mock('@/common/services/taxonomy-service', () => ({
  createTaxonomyTerm: (...args: unknown[]) => createTaxonomyTerm(...args),
  updateTaxonomyTerm: (...args: unknown[]) => updateTaxonomyTerm(...args),
  setTaxonomyTermVisible: (...args: unknown[]) => setTaxonomyTermVisible(...args),
  deleteTaxonomyTerm: (...args: unknown[]) => deleteTaxonomyTerm(...args),
  moveTaxonomyTerm: (...args: unknown[]) => moveTaxonomyTerm(...args),
  listTaxonomyRows: (...args: unknown[]) => listTaxonomyRows(...args),
}));

vi.mock('@/common/services/session', () => ({
  readSession: () => readSession(),
}));

const {
  createTaxonomyTermAction,
  deleteTaxonomyTermAction,
  moveTaxonomyTermAction,
  setTaxonomyTermVisibilityAction,
  updateTaxonomyTermAction,
} = await import('../actions/taxonomy-actions');

const term = (overrides: Partial<TaxonomyTermRow> = {}): TaxonomyTermRow => ({
  id: 4,
  subject: 'project',
  axis: 'status',
  value: 'Completed',
  labelEn: 'Completed',
  labelFa: 'ساخته‌شده',
  sortOrder: 0,
  visible: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

const VALID_CREATE = {
  subject: 'project',
  axis: 'status',
  value: 'Mothballed',
  labelEn: 'Mothballed',
  labelFa: 'متوقف‌شده',
};

const signedIn = () =>
  readSession.mockResolvedValue({ status: 'valid', session: { sub: 'admin', iat: 0, exp: 0 } });

beforeEach(() => {
  vi.clearAllMocks();
  signedIn();
  createTaxonomyTerm.mockResolvedValue({ status: 'created', term: term() });
  updateTaxonomyTerm.mockResolvedValue(term());
  setTaxonomyTermVisible.mockResolvedValue(term({ visible: false }));
  deleteTaxonomyTerm.mockResolvedValue({ status: 'deleted' });
  moveTaxonomyTerm.mockResolvedValue({ moved: term(), subject: 'project' });
  listTaxonomyRows.mockResolvedValue([term()]);
});

describe('authorization', () => {
  it('refuses every write with 401 when the session is not valid, and touches nothing', async () => {
    readSession.mockResolvedValue({ status: 'anonymous' });

    const results = await Promise.all([
      createTaxonomyTermAction(VALID_CREATE),
      updateTaxonomyTermAction({ id: 4, labelEn: 'A', labelFa: 'ب' }),
      setTaxonomyTermVisibilityAction({ id: 4, visible: false }),
      deleteTaxonomyTermAction(4),
      moveTaxonomyTermAction({ id: 4, afterId: null }),
    ]);

    for (const result of results) expect(result).toEqual({ ok: false, status: 401 });
    expect(createTaxonomyTerm).not.toHaveBeenCalled();
    expect(updateTaxonomyTerm).not.toHaveBeenCalled();
    expect(setTaxonomyTermVisible).not.toHaveBeenCalled();
    expect(deleteTaxonomyTerm).not.toHaveBeenCalled();
    expect(moveTaxonomyTerm).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('answers 401 for an expired or forged cookie exactly as for an anonymous one', async () => {
    // The server keeps the distinction; the caller must never get it. Telling someone their
    // signature parsed but their expiry did not is telling them their forgery is close.
    for (const status of ['expired', 'invalid'] as const) {
      readSession.mockResolvedValue({ status });
      expect(await deleteTaxonomyTermAction(4)).toEqual({ ok: false, status: 401 });
    }
  });
});

describe('validation', () => {
  it('answers 422 with field-keyed errors and writes nothing', async () => {
    const result = await createTaxonomyTermAction({ ...VALID_CREATE, labelFa: '' });

    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(422);
    expect(result.body).toHaveProperty('labelFa');
    expect(createTaxonomyTerm).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('refuses an unrecognized subject or axis', async () => {
    // Subjects and axes stay a closed enum: a subject is a TABLE and an axis is a COLUMN, so
    // a new one is a migration, not something a POST introduces.
    expect((await createTaxonomyTermAction({ ...VALID_CREATE, subject: 'studio' })).ok).toBe(false);
    expect((await createTaxonomyTermAction({ ...VALID_CREATE, axis: 'colour' })).ok).toBe(false);
  });

  it('REFUSES a crafted `value` on an update — the wire value is immutable', async () => {
    // Not "ignores": `strictObject` is what makes the immutability enforced rather than
    // merely unimplemented. A rename would have to rewrite every content row holding the old
    // string in the same transaction.
    const result = await updateTaxonomyTermAction({
      id: 4,
      labelEn: 'A',
      labelFa: 'ب',
      value: 'Renamed',
    });

    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(422);
    expect(updateTaxonomyTerm).not.toHaveBeenCalled();
  });

  it('refuses a crafted `sortOrder` or `visible` on a create', async () => {
    // Both are owned by their own actions. A create that accepted them would let one POST
    // insert a term already at the head of the list and already hidden.
    expect((await createTaxonomyTermAction({ ...VALID_CREATE, sortOrder: 0 })).ok).toBe(false);
    expect((await createTaxonomyTermAction({ ...VALID_CREATE, visible: false })).ok).toBe(false);
  });
});

describe('the two-tag purge', () => {
  it('purges taxonomy AND the subject’s collection tag on create', async () => {
    const result = await createTaxonomyTermAction(VALID_CREATE);

    expect(result.ok).toBe(true);
    expect(updateTag).toHaveBeenCalledWith(CACHE_TAGS.taxonomy);
    expect(updateTag).toHaveBeenCalledWith(taxonomySubjectTag('project'));
    expect(updateTag).toHaveBeenCalledTimes(2);
    // `updateTag`, never `revalidateTag`: stale-while-revalidate is indistinguishable from a
    // save that did not work.
    expect(revalidateTagSpy).not.toHaveBeenCalled();
  });

  it('purges the pair on update, visibility, delete and move alike', async () => {
    await updateTaxonomyTermAction({ id: 4, labelEn: 'A', labelFa: 'ب' });
    await setTaxonomyTermVisibilityAction({ id: 4, visible: false });
    await deleteTaxonomyTermAction(4);
    await moveTaxonomyTermAction({ id: 4, afterId: null });

    const purged = updateTag.mock.calls.map(([tag]) => tag);
    expect(purged.filter(tag => tag === CACHE_TAGS.taxonomy)).toHaveLength(4);
    expect(purged.filter(tag => tag === CACHE_TAGS.projects)).toHaveLength(4);
  });

  it('purges the DESIGN collection for a design term, not the projects one', async () => {
    // The subject comes from the ROW the write returned, never from an argument — otherwise a
    // crafted POST could purge, or fail to purge, the wrong collection.
    updateTaxonomyTerm.mockResolvedValue(term({ subject: 'design', axis: 'category' }));

    await updateTaxonomyTermAction({ id: 4, labelEn: 'A', labelFa: 'ب' });

    expect(updateTag).toHaveBeenCalledWith(CACHE_TAGS.designWorks);
    expect(updateTag).not.toHaveBeenCalledWith(CACHE_TAGS.projects);
  });

  it('purges NOTHING when a move had nowhere to go', async () => {
    // `null` is "nothing happened" — a stale id, an anchor since deleted, or a drop back
    // where the term already was. Discarding a valid cache for a no-op makes every reader
    // pay for a refetch that changes nothing.
    moveTaxonomyTerm.mockResolvedValue(null);

    const result = await moveTaxonomyTermAction({ id: 4, afterId: 999 });

    expect(result).toEqual({ ok: true, data: undefined });
    expect(updateTag).not.toHaveBeenCalled();
  });
});

describe('the in-use delete refusal', () => {
  it('answers 409 with the COUNT and deletes nothing', async () => {
    // There is no foreign key — deliberately — so the database would accept this delete and
    // silently orphan every row using the value. The count is what makes the editor able to
    // say so and point at the visible toggle instead.
    deleteTaxonomyTerm.mockResolvedValue({ status: 'in-use', count: 41 });

    const result = await deleteTaxonomyTermAction(4);

    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(409);
    expect(result.body).toEqual({ count: 41 });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('deletes an unused term and purges the pair', async () => {
    deleteTaxonomyTerm.mockResolvedValue({ status: 'deleted' });

    const result = await deleteTaxonomyTermAction(4);

    expect(result).toEqual({ ok: true, data: undefined });
    expect(updateTag).toHaveBeenCalledWith(CACHE_TAGS.taxonomy);
    expect(updateTag).toHaveBeenCalledWith(CACHE_TAGS.projects);
  });

  it('answers 404 for an id that is already gone', async () => {
    deleteTaxonomyTerm.mockResolvedValue({ status: 'missing' });

    const result = await deleteTaxonomyTermAction(4);

    expect(result).toEqual({ ok: false, status: 404 });
    expect(updateTag).not.toHaveBeenCalled();
  });
});

describe('create collisions', () => {
  it('answers 409 naming the `value` field when the term already exists', async () => {
    // 409 rather than 422, and the distinction matters to the editor: 422 means "what you
    // typed is malformed", 409 means "this already exists" — and only the second makes the
    // useful next action "go and look at the one that is there".
    createTaxonomyTerm.mockResolvedValue({ status: 'duplicate', term: term() });

    const result = await createTaxonomyTermAction(VALID_CREATE);

    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(409);
    expect(result.body).toHaveProperty('value');
    expect(updateTag).not.toHaveBeenCalled();
  });
});
