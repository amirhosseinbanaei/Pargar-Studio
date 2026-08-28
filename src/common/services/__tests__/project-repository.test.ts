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
 *
 * ─── A MIGRATED, NOT SEEDED, TEMPORARY DATABASE ───────────────────────────────────
 * Prompt 7 deletes `legacy/` and, with it, `scripts/seed.ts` and the fixture helper this
 * file used to import to spawn it (`seeded-database.ts`) — that script's entire job was
 * porting `legacy/data/*.js`, which no longer exists. This suite now spawns ONLY
 * `db:migrate` against a throwaway file database and writes its OWN fixture row through
 * `projectRepository.create` — the repository under test is the one thing establishing the
 * fixture, so this asserts the exact contract described above with no dependency on any
 * particular content ever having existed.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let dir: string;

/**
 * Imported lazily, after the environment has been stubbed: the module binds its connection
 * URL at import time, so a static import at the top of the file would open whichever
 * database `.env.local` names.
 */
async function projectRepository() {
  return import('../project-repository');
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'kavan-test-db-'));
  const url = `file:${join(dir, 'test.db')}`;

  vi.stubEnv('TURSO_DATABASE_URL', url);
  vi.stubEnv('TURSO_AUTH_TOKEN', '');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
  vi.stubEnv('ADMIN_PASSWORD', 'test-password');
  vi.stubEnv('SESSION_SECRET', 'test-session-secret-at-least-32-characters-long');
  // Required and absolute, with no default (`common/config/server-env.ts`) — and the schema
  // validates at import time, so this suite cannot import a repository without it. Nothing
  // here writes a file; the key simply has to satisfy the boot.
  vi.stubEnv('UPLOAD_DIR', join(dir, 'uploads'));

  // Inherits the stubbed environment above, same as the deleted `seeded-database.ts` did —
  // that is what stops a developer's local `kavan.db` from becoming the database under test.
  execFileSync('npm', ['run', '--silent', 'db:migrate'], { stdio: 'pipe' });
}, 120_000);

afterAll(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe('projectRepository.bySlug', () => {
  it('returns null for a slug that does not exist', async () => {
    const repo = await projectRepository();

    await expect(repo.bySlug('a-project-that-was-never-built')).resolves.toBeNull();
  });

  it('decodes the JSON types column into an array of strings', async () => {
    const repo = await projectRepository();

    // Two types on one row, so this also proves the multi-value case rather than an array
    // that happens to hold one item.
    await repo.create({
      slug: 'darrous-court-residence',
      types: ['Residential', 'Interior Design'],
      status: 'Completed',
      scale: 'Medium',
      year: 2021,
      area: '1,450 m²',
      sortOrder: 0,
      titleEn: 'Darrous Court Residence',
      titleFa: 'خانه حیاط دروس',
      blurbEn: '',
      blurbFa: '',
      descriptionEn: '',
      descriptionFa: '',
      locationEn: '',
      locationFa: '',
      clientEn: '',
      clientFa: '',
      // The gallery columns are the other JSON pair on this table (prompt 10), encoded by
      // the same `toRow` and decoded by the same `jsonArray` leaf, so they are asserted
      // here rather than in a second near-identical test.
      coverImage: '2026/08/0123456789abcdef0123456789abcdef.jpg',
      coverAltEn: 'The courtyard from the street',
      coverAltFa: 'حیاط از خیابان',
      galleryEn: [{ path: '2026/08/11111111111111111111111111111111.png', alt: 'The stair' }],
      galleryFa: [{ path: '2026/08/11111111111111111111111111111111.png', alt: 'پلکان' }],
    });

    const project = await repo.bySlug('darrous-court-residence');

    expect(Array.isArray(project?.types)).toBe(true);
    expect(project?.types).toEqual(['Residential', 'Interior Design']);
    for (const type of project?.types ?? []) {
      expect(typeof type).toBe('string');
    }

    // The gallery columns make the same round trip: an array in, a JSON string in the
    // column, a real array of objects back out. Nothing downstream calls `JSON.parse`, and
    // a `toRow` that forgot one of these would write `[object Object]` and decode to `[]`
    // — silently, because `jsonArray` degrades rather than throwing.
    expect(project?.galleryEn).toEqual([
      { path: '2026/08/11111111111111111111111111111111.png', alt: 'The stair' },
    ]);
    expect(project?.galleryFa[0]?.alt).toBe('پلکان');
    expect(project?.coverImage).toBe('2026/08/0123456789abcdef0123456789abcdef.jpg');
  });
});
