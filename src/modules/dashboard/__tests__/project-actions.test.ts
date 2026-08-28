// @vitest-environment node
/**
 * The write actions, tested at the trust boundary.
 *
 * Every assertion here is about what an action does with input a caller controls, and about
 * the two things that are invisible in every other kind of test:
 *
 *  1. **That an unauthorized call touches NOTHING.** Asserting the 401 alone is not enough —
 *     a 401 returned after the write has already happened is still a breach, and it looks
 *     identical from the outside. So every one of these also asserts the service was never
 *     called.
 *  2. **Which cache tags were purged.** A missing `updateTag` produces no error, no failed
 *     test and no symptom until somebody notices the public site is stale. `next/cache` is
 *     mocked so the exact strings can be asserted, and they are compared against the same
 *     `cache-tags` vocabulary the READ side sets them with — a test that hardcoded
 *     `'projects'` would keep passing through a rename that broke the app.
 *
 * The service layer is mocked, so this is the action's own logic and nothing below it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_TAGS, projectTag } from '@/common/services/cache-tags';
import type { ProjectRow } from '@/common/schemas/project';

const updateTag = vi.fn();
const revalidateTag = vi.fn();

const createProject = vi.fn();
const updateProject = vi.fn();
const deleteProject = vi.fn();
const moveProject = vi.fn();
const getProjectRowById = vi.fn();

const readSession = vi.fn();
const unknownTermErrors = vi.fn();

vi.mock('next/cache', () => ({
  updateTag: (...args: unknown[]) => updateTag(...args),
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
}));

vi.mock('@/common/services/project-service', () => ({
  createProject: (...args: unknown[]) => createProject(...args),
  updateProject: (...args: unknown[]) => updateProject(...args),
  deleteProject: (...args: unknown[]) => deleteProject(...args),
  moveProject: (...args: unknown[]) => moveProject(...args),
  getProjectRowById: (...args: unknown[]) => getProjectRowById(...args),
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

const { createProjectAction, deleteProjectAction, moveProjectAction, updateProjectAction } =
  await import('../actions/project-actions');

/** A payload the form could actually produce. `year` is a STRING, as a number input gives. */
const VALID = {
  slug: 'qeytarieh-08-residence',
  types: ['Residential'],
  status: 'Completed',
  scale: 'Medium',
  year: '2021',
  area: '1,450 m²',
  titleEn: 'Qeytarieh 08 Residence',
  titleFa: 'خانه قیطریه ۰۸',
  blurbEn: 'A house on a north-facing slope.',
  blurbFa: '',
  descriptionEn: '',
  descriptionFa: '',
  locationEn: 'Tehran',
  locationFa: '',
  clientEn: '',
  clientFa: '',
  // No photograph — the state of every seeded record, and the one the generated-drawing
  // fallback has to keep working in. `strictObject` requires the keys to be present.
  coverImage: '',
  coverAltEn: '',
  coverAltFa: '',
  gallery: [],
};

const row = (overrides: Partial<ProjectRow> = {}): ProjectRow =>
  ({
    id: 7,
    slug: 'qeytarieh-08-residence',
    types: ['Residential'],
    status: 'Completed',
    scale: 'Medium',
    year: 2021,
    area: '1,450 m²',
    sortOrder: 0,
    titleEn: 'Qeytarieh 08 Residence',
    titleFa: 'خانه قیطریه ۰۸',
    blurbEn: '',
    blurbFa: '',
    descriptionEn: '',
    descriptionFa: '',
    locationEn: '',
    locationFa: '',
    clientEn: '',
    clientFa: '',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }) as ProjectRow;

const signedIn = () =>
  readSession.mockResolvedValue({ status: 'valid', session: { sub: 'admin', iat: 0, exp: 0 } });

/** Every service mock, so "did the database get touched" is one assertion. */
const everyWrite = () => [createProject, updateProject, deleteProject, moveProject];

beforeEach(() => {
  vi.clearAllMocks();
  // Every value is a declared term unless a test says otherwise.
  unknownTermErrors.mockResolvedValue({});
  signedIn();
  createProject.mockResolvedValue(row());
  updateProject.mockResolvedValue(row());
  deleteProject.mockResolvedValue(true);
  moveProject.mockResolvedValue(null);
  getProjectRowById.mockResolvedValue(row());
});

/* ══════════════════════════════════════════════════════════════════════════════════ *
 *  Authorization                                                                      *
 * ══════════════════════════════════════════════════════════════════════════════════ */

describe('authorization', () => {
  /**
   * Every session state that is not `valid`, because they must all answer identically. An
   * action that returned a different status for an expired cookie than for a forged one
   * would be telling a forger how close they got.
   */
  const anonymous = [
    { status: 'anonymous' },
    { status: 'expired' },
    { status: 'invalid', reason: 'bad-signature' },
    { status: 'invalid', reason: 'malformed' },
  ] as const;

  for (const session of anonymous) {
    it(`refuses every write with 401 when the session is ${session.status}/${'reason' in session ? session.reason : '—'}`, async () => {
      readSession.mockResolvedValue(session);

      const results = await Promise.all([
        createProjectAction(VALID),
        updateProjectAction(7, VALID),
        deleteProjectAction(7),
        moveProjectAction({ id: 7, direction: 'up' }),
      ]);

      for (const result of results) expect(result).toEqual({ ok: false, status: 401 });

      // THE ASSERTION THAT MATTERS. A 401 returned after the write already happened looks
      // identical from the outside and is still a breach.
      for (const write of everyWrite()) expect(write).not.toHaveBeenCalled();
      expect(updateTag).not.toHaveBeenCalled();
    });
  }

  it('checks the session BEFORE parsing, so an anonymous caller learns nothing about the shape', async () => {
    readSession.mockResolvedValue({ status: 'anonymous' });

    // Garbage that would fail validation loudly. The answer is still a bare 401 with no
    // body — no field names, no hint about what the endpoint accepts.
    const result = await createProjectAction({ nonsense: true });

    expect(result).toEqual({ ok: false, status: 401 });
    expect(result).not.toHaveProperty('body');
  });
});

/* ══════════════════════════════════════════════════════════════════════════════════ *
 *  Validation                                                                         *
 * ══════════════════════════════════════════════════════════════════════════════════ */

describe('validation', () => {
  it('answers 422 with FIELD-KEYED errors for a bad slug, and writes nothing', async () => {
    const result = await createProjectAction({ ...VALID, slug: 'Not A Slug' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(422);
    // The shape the form binds against: one key per field, which is what lets the message
    // land on the input instead of in a form-level sentence nobody can act on.
    expect(result.body).toHaveProperty('slug');
    expect(createProject).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('names EVERY offending field, not just the first', async () => {
    const result = await updateProjectAction(7, { ...VALID, slug: '', titleEn: '', types: [] });

    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(422);
    const body = result.body as Record<string, string[]>;
    // A form binds all of them at once; reporting one at a time makes a sixteen-field form
    // a sixteen-round-trip form.
    expect(Object.keys(body).sort()).toEqual(['slug', 'titleEn', 'types']);
    expect(updateProject).not.toHaveBeenCalled();
  });

  it('rejects an unknown key — a crafted POST cannot smuggle a column in', async () => {
    // `sortOrder` is deliberately not a form field: position is owned by the reorder
    // control. `strictObject` is what stops a hand-made request from setting it anyway.
    const result = await createProjectAction({ ...VALID, sortOrder: -999 });

    expect(result.ok).toBe(false);
    expect(createProject).not.toHaveBeenCalled();
  });

  it('rejects a type with no term, 422, naming the field, and writes nothing', async () => {
    /**
     * THE CHECK THAT REPLACED `z.enum`. Until prompt 9 the submission schema carried
     * `z.enum(projectTypeValues)` and this test drove that; the taxonomy is editable rows
     * now, so the check is a table lookup in the service and this drives the lookup.
     *
     * The two things worth asserting are unchanged, and both are the reason the check had to
     * survive the move at all: the answer is a 422 NAMING THE FIELD, so `RecordForm` binds it
     * to the input that caused it, and NOTHING IS WRITTEN — a rejection returned after the
     * row landed is still a bad write, and it looks identical from the outside.
     */
    unknownTermErrors.mockResolvedValue({ types: ['“Submarine” is not a type term.'] });

    const result = await createProjectAction({ ...VALID, types: ['Submarine'] });

    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(422);
    expect(result.body).toHaveProperty('types');
    expect(createProject).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('asks about all three project axes, by their column names', async () => {
    // A wrong axis here is invisible: the lookup would still answer, just about the wrong
    // set, so a scale would be accepted as a status. The field names are the FORM's, because
    // they are what a 422 has to name for the binding to land on the right input.
    await createProjectAction(VALID);

    expect(unknownTermErrors).toHaveBeenCalledWith('project', [
      { field: 'types', axis: 'type', values: ['Residential'] },
      { field: 'status', axis: 'status', values: ['Completed'] },
      { field: 'scale', axis: 'scale', values: ['Medium'] },
    ]);
  });

  it('runs the taxonomy check on UPDATE too, not only on create', async () => {
    // The update path is the one an editor uses on an existing record, so it is the path a
    // retired term is most likely to reach — and the one where forgetting the check would go
    // unnoticed longest.
    unknownTermErrors.mockResolvedValue({ status: ['“Mothballed” is not a status term.'] });

    const result = await updateProjectAction(7, { ...VALID, status: 'Mothballed' });

    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(422);
    expect(updateProject).not.toHaveBeenCalled();
  });

  it('refuses an out-of-range year rather than storing it', async () => {
    const result = await createProjectAction({ ...VALID, year: '3000' });

    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(422);
    expect(result.body).toHaveProperty('year');
  });
});

/* ══════════════════════════════════════════════════════════════════════════════════ *
 *  The write path, and the tags                                                       *
 * ══════════════════════════════════════════════════════════════════════════════════ */

describe('updateProjectAction', () => {
  it('writes the row and purges BOTH the collection and the instance tag', async () => {
    const result = await updateProjectAction(7, VALID);

    expect(result).toEqual({ ok: true, data: { slug: 'qeytarieh-08-residence' } });
    expect(updateProject).toHaveBeenCalledTimes(1);
    expect(updateProject).toHaveBeenCalledWith(7, expect.objectContaining({ year: 2021 }));

    // The exact strings, read from the same vocabulary the read side sets them with. A tag
    // purged under a name that was never set is a silent no-op.
    expect(updateTag).toHaveBeenCalledWith(CACHE_TAGS.projects);
    expect(updateTag).toHaveBeenCalledWith(projectTag('qeytarieh-08-residence'));
    expect(updateTag).toHaveBeenCalledTimes(2);
  });

  it('converts the year from the string a number input sends', async () => {
    await updateProjectAction(7, VALID);
    const [, payload] = updateProject.mock.calls[0] as [number, { year: unknown }];
    // Not `'2021'`. The column is an integer, and a string here is a row that reads back
    // wrong through the schema.
    expect(payload.year).toBe(2021);
  });

  it('fills an empty Persian field with its English counterpart', async () => {
    await updateProjectAction(7, VALID);
    const [, payload] = updateProject.mock.calls[0] as [number, Record<string, string>];

    // Persian is optional in the form. The fallback is applied HERE, at author time, which
    // is what lets `pickLocale` have no fallback branch and the Persian page never render
    // a hole. `blurbFa` was empty; `titleFa` was not and must be left alone.
    expect(payload.blurbFa).toBe(VALID.blurbEn);
    expect(payload.locationFa).toBe(VALID.locationEn);
    expect(payload.titleFa).toBe(VALID.titleFa);
  });

  it('treats a whitespace-only Persian field as empty', async () => {
    await updateProjectAction(7, { ...VALID, blurbFa: '   ' });
    const [, payload] = updateProject.mock.calls[0] as [number, Record<string, string>];
    expect(payload.blurbFa).toBe(VALID.blurbEn);
  });

  it('PURGES THE OLD SLUG TOO when the slug changes', async () => {
    getProjectRowById.mockResolvedValue(row({ slug: 'old-name' }));
    updateProject.mockResolvedValue(row({ slug: 'new-name' }));

    const result = await updateProjectAction(7, { ...VALID, slug: 'new-name' });

    expect(result).toEqual({ ok: true, data: { slug: 'new-name' } });
    expect(updateTag).toHaveBeenCalledWith(CACHE_TAGS.projects);
    expect(updateTag).toHaveBeenCalledWith(projectTag('new-name'));
    // Without this the detail page stays cached forever under a URL that no longer resolves.
    expect(updateTag).toHaveBeenCalledWith(projectTag('old-name'));
    expect(updateTag).toHaveBeenCalledTimes(3);
  });

  it('answers 404 when the row was deleted between loading the form and saving it', async () => {
    getProjectRowById.mockResolvedValue(null);

    const result = await updateProjectAction(7, VALID);

    expect(result).toEqual({ ok: false, status: 404 });
    expect(updateProject).not.toHaveBeenCalled();
    // Nothing changed, so nothing is purged — a purge on a failed write throws away a valid
    // cache and makes every reader pay for a refetch that changes nothing.
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('RETURNS a failure when the write throws, instead of throwing', async () => {
    // A throw would be sanitized crossing the RPC boundary and the form would lose the
    // status it branches on.
    updateProject.mockRejectedValue(new Error('database is locked'));

    const result = await updateProjectAction(7, VALID);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(0);
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('uses updateTag, never the deprecated single-argument revalidateTag', async () => {
    await updateProjectAction(7, VALID);
    // `revalidateTag` serves stale while it refreshes, which to an editor is indistinguishable
    // from a save that did not work. Its single-argument form also still compiles on 16,
    // which is exactly why it survives review.
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

describe('createProjectAction', () => {
  it('creates the row and purges the collection and the new instance tag', async () => {
    createProject.mockResolvedValue(row({ slug: 'new-house' }));

    const result = await createProjectAction({ ...VALID, slug: 'new-house' });

    expect(result).toEqual({ ok: true, data: { slug: 'new-house' } });
    expect(updateTag).toHaveBeenCalledWith(CACHE_TAGS.projects);
    expect(updateTag).toHaveBeenCalledWith(projectTag('new-house'));
  });

  it('never sends sortOrder — position is the reorder control’s, not the form’s', async () => {
    await createProjectAction(VALID);
    const [payload] = createProject.mock.calls[0] as [Record<string, unknown>];
    expect(payload).not.toHaveProperty('sortOrder');
  });
});

describe('deleteProjectAction', () => {
  it('deletes and purges the instance tag it read BEFORE the delete', async () => {
    getProjectRowById.mockResolvedValue(row({ slug: 'doomed' }));

    const result = await deleteProjectAction(7);

    expect(result).toEqual({ ok: true, data: undefined });
    expect(deleteProject).toHaveBeenCalledWith(7);
    expect(updateTag).toHaveBeenCalledWith(CACHE_TAGS.projects);
    // Read before the delete, because afterwards there is no row to read the slug from —
    // and an unpurged instance tag leaves the public page serving a project that is gone.
    expect(updateTag).toHaveBeenCalledWith(projectTag('doomed'));
  });

  it('answers 404 for an id that is already gone, and purges nothing', async () => {
    getProjectRowById.mockResolvedValue(null);

    const result = await deleteProjectAction(7);

    expect(result).toEqual({ ok: false, status: 404 });
    expect(deleteProject).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('rejects a non-positive id without touching the database', async () => {
    const result = await deleteProjectAction(0);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(422);
    expect(deleteProject).not.toHaveBeenCalled();
  });
});

describe('moveProjectAction', () => {
  it('purges BOTH rows that traded places', async () => {
    moveProject.mockResolvedValue({ moved: row({ slug: 'a' }), displaced: row({ slug: 'b' }) });

    const result = await moveProjectAction({ id: 7, direction: 'down' });

    expect(result).toEqual({ ok: true, data: undefined });
    expect(moveProject).toHaveBeenCalledWith(7, 'down');
    expect(updateTag).toHaveBeenCalledWith(projectTag('a'));
    expect(updateTag).toHaveBeenCalledWith(projectTag('b'));
    expect(updateTag).toHaveBeenCalledWith(CACHE_TAGS.projects);
  });

  it('succeeds without purging when nothing moved', async () => {
    // The first row asked to move up, or an unknown id. Both are a no-op rather than a
    // failure: the boundary arrows render disabled, so reaching here means a stale page.
    moveProject.mockResolvedValue(null);

    const result = await moveProjectAction({ id: 7, direction: 'up' });

    expect(result).toEqual({ ok: true, data: undefined });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it('rejects a direction outside up/down', async () => {
    const result = await moveProjectAction({ id: 7, direction: 'sideways' });

    expect(result.ok).toBe(false);
    expect(moveProject).not.toHaveBeenCalled();
  });
});
