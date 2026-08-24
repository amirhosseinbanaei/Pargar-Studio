// @vitest-environment node
//
// src/common/services/__tests__/project-repository.test.ts
/**
 * REPOSITORY CONTRACT. The two promises ring 2 makes to ring 3, checked against a real
 * database rather than a mock — a mocked `db` would skip the `.parse()`, which is the only
 * part of this layer worth testing.
 *
 * 1. A missing slug RETURNS NULL. If it threw, every detail route would need a try/catch to
 *    render a 404, and the commonest request an archive site receives — a stale link — would
 *    travel the exception path.
 * 2. A JSON column comes back as REAL DATA. `types` is stored as the string
 *    `'["Residential"]'`; if it reached a component as that string, `types.map(...)` would
 *    iterate characters and `types.includes('Villa')` would be a substring test that
 *    silently returns the wrong answer for a filter.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedTemporaryDatabase, type SeededDatabase } from './seeded-database';

let database: SeededDatabase;

/**
 * Imported lazily, after `seedTemporaryDatabase` has stubbed the environment: the module
 * binds its connection URL at import time, so a static import at the top of the file would
 * open whichever database `.env.local` names.
 */
async function projectRepository() {
  return import('../project-repository');
}

beforeAll(() => {
  database = seedTemporaryDatabase();
}, 120_000);

afterAll(() => {
  database.cleanup();
});

describe('projectRepository.bySlug', () => {
  it('returns null for a slug that does not exist', async () => {
    const repo = await projectRepository();

    await expect(repo.bySlug('a-project-that-was-never-built')).resolves.toBeNull();
  });

  it('decodes the JSON types column into an array of strings', async () => {
    const repo = await projectRepository();

    // Two types on one project — legacy/data/projects.js:31 — so this also proves the
    // multi-value case rather than an array that happens to hold one item.
    const project = await repo.bySlug('darrous-court-residence');

    expect(Array.isArray(project?.types)).toBe(true);
    expect(project?.types).toEqual(['Residential', 'Interior Design']);
    for (const type of project?.types ?? []) {
      expect(typeof type).toBe('string');
    }
  });
});
