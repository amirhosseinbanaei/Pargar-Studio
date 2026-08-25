// src/common/services/__tests__/seeded-database.ts
/**
 * Test fixture: a REAL, freshly migrated and freshly seeded libSQL file database.
 *
 * ─── WHY A SUBPROCESS AND NOT AN IMPORT ───────────────────────────────────────────
 * `scripts/seed.ts` imports `legacy/data/*.js`, which it is uniquely permitted to do. If a
 * test under `src/` imported that script, `legacy/` would become part of `src/`'s import
 * graph through the back door and prompt 7 could not delete it without breaking the suite —
 * exactly the coupling the ban in AGENTS.md exists to prevent. Spawning the npm scripts
 * keeps the boundary intact AND tests the real command a deploy runs, rather than a
 * re-implementation of it that could drift.
 *
 * ─── WHY A FILE AND NOT `:memory:` ────────────────────────────────────────────────
 * The seed runs in a different process, so an in-memory database would be invisible to the
 * assertions. The file is created under the OS temp directory and removed afterwards.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';

export interface SeededDatabase {
  /** The `file:` URL of the migrated, seeded database. */
  url: string;
  /** Restores the environment and removes the temporary directory. Call from `afterAll`. */
  cleanup: () => void;
}

/**
 * Migrate and seed a throwaway database, and return its URL.
 *
 * The environment is set through `vi.stubEnv` rather than by assigning to `process.env`,
 * for two reasons. It is restored automatically, so one suite cannot leave a stale database
 * URL behind for the next; and it keeps this file clear of the `process.env` reads that
 * AGENTS.md confines to `common/config`, so `grep -rn "process.env" src/` stays a usable
 * check rather than one with a memorized exception.
 *
 * The spawned scripts inherit these values, and inheritance is what makes the override
 * work: the npm scripts pass `--env-file-if-exists=.env.local`, and Node gives the real
 * environment precedence over a value in that file — so a developer's local `kavan.db`
 * cannot quietly become the database under test.
 *
 * Every variable the app's env schema requires is stubbed, not just the URL, so a checkout
 * with no `.env.local` at all can still run the suite.
 */
export function seedTemporaryDatabase(): SeededDatabase {
  const dir = mkdtempSync(join(tmpdir(), 'kavan-test-db-'));
  const file = join(dir, 'test.db');
  const url = `file:${file}`;

  vi.stubEnv('TURSO_DATABASE_URL', url);
  vi.stubEnv('TURSO_AUTH_TOKEN', '');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000');
  vi.stubEnv('ADMIN_PASSWORD', 'test-password');
  vi.stubEnv('SESSION_SECRET', 'test-session-secret-at-least-32-characters-long');

  for (const script of ['db:migrate', 'db:seed']) {
    execFileSync('npm', ['run', '--silent', script], { stdio: 'pipe' });
  }

  return {
    url,
    cleanup: () => {
      vi.unstubAllEnvs();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
