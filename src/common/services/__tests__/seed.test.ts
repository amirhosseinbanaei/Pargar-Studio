// @vitest-environment node
//
// src/common/services/__tests__/seed.test.ts
/**
 * SEED FIDELITY. The one test that answers "did the whole site actually make it into the
 * database?", against a real migrated database seeded by the real `npm run db:seed`.
 *
 * The counts are exact, not lower bounds. `>= 70` would pass with six projects silently
 * dropped by a broken overlay merge, and the only symptom in production would be six pages
 * that 404 — which nobody notices, because nobody links to a page that was never built.
 *
 * The Persian assertion is a byte-for-byte string comparison against
 * `legacy/data/projects.fa.part1.js:9`, written out here as a literal rather than imported.
 * That is deliberate on both counts: `src/` may not import `legacy/`, and a test that read
 * its expected value from the same file the seed read would pass no matter how the string
 * was mangled in between. It carries a zero-width non-joiner in `پله‌پله` and Latin digits
 * in the title — the two things a well-meaning "normalization" would destroy.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedTemporaryDatabase, type SeededDatabase } from './seeded-database';

let database: SeededDatabase;

/**
 * The repositories read the connection URL at IMPORT time, through the zod-parsed env
 * module — so they are imported here, lazily, after `seedTemporaryDatabase` has stubbed the
 * environment. A static import at the top of the file would bind to whatever the developer
 * happens to have in `.env.local`.
 */
async function repositories() {
  return {
    projects: await import('../project-repository'),
    designWorks: await import('../design-work-repository'),
    media: await import('../media-repository'),
    studio: await import('../studio-repository'),
    contact: await import('../contact-repository'),
  };
}

beforeAll(() => {
  database = seedTemporaryDatabase();
  // Migrating and seeding spawns two npm scripts; the default 5s timeout is not enough.
}, 120_000);

afterAll(() => {
  database.cleanup();
});

describe('the seed', () => {
  it('writes every record from legacy/data into the database', async () => {
    const repo = await repositories();

    expect(await repo.projects.list()).toHaveLength(76);
    expect(await repo.designWorks.list()).toHaveLength(9);
    expect(await repo.media.list()).toHaveLength(14);
    expect(await repo.studio.get()).not.toBeNull();
    expect(await repo.contact.get()).not.toBeNull();
  });

  it('round-trips a Persian string exactly as legacy/data/projects.fa.part1.js:9 wrote it', async () => {
    const repo = await repositories();
    const project = await repo.projects.bySlug('qeytarieh-08-residence');

    expect(project).not.toBeNull();
    // Zero-width non-joiners and Latin digits, verbatim. Do not "tidy" this literal.
    expect(project?.titleFa).toBe('مسکونی قیطریه 08');
    // And the English column is untouched by the merge.
    expect(project?.titleEn).toBe('Qeytarieh 08 Residence');
  });

  it('falls back to English rather than leaving a Persian column blank', async () => {
    const repo = await repositories();
    const rows = await repo.projects.list();

    // The rule from legacy/js/core/i18n.js:154, enforced at write time: every Persian
    // column is populated, because a missing translation is written as the English value.
    // A blank Persian page is a worse degradation than untranslated text.
    for (const row of rows) {
      expect(row.titleFa).not.toBe('');
      expect(row.blurbFa).not.toBe('');
      expect(row.descriptionFa).not.toBe('');
      expect(row.locationFa).not.toBe('');
      expect(row.clientFa).not.toBe('');
    }
  });
});
