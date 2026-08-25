// scripts/migrate.ts — `npm run db:migrate`
//
// Applies every committed migration in `drizzle/` to the database named by
// TURSO_DATABASE_URL, in order, recording each in drizzle's `__drizzle_migrations` table so
// a re-run is a no-op. Safe to run on every deploy; that is the point.
//
// WHY THIS AND NOT `drizzle-kit migrate`:
//   - It reuses `src/common/services/db.ts`, so the claim "exactly one file opens a
//     database connection" stays true for the deploy path as well as the request path.
//   - It reads the URL through the same zod-parsed env module the app does, so a missing
//     or malformed value fails here the same way it would fail at boot, with the key named.
//   - `drizzle-kit push` is NOT an option at all: it diffs the schema against a live
//     database and applies the difference in place, which makes the deployed schema a
//     function of whichever machine ran the command last. Committed SQL is reviewable and
//     reproducible; a push is neither.
//
// The npm script runs this under `tsx --conditions=react-server`. That condition is what
// resolves the `server-only` package to its empty build — without it, importing `db.ts`
// outside a React Server Components bundle throws before the first statement runs.
//
// Wrapped in a `main()` rather than written with top-level await: `package.json` has no
// `"type": "module"`, so tsx transpiles a `.ts` file to CommonJS, where top-level await is
// a hard error. Adding `"type": "module"` is not the fix — it would break
// `commitlint.config.ts`, which commitlint loads through its CommonJS loader.
import { migrate } from 'drizzle-orm/libsql/migrator';
import { db } from '../src/common/services/db';

async function main() {
  await migrate(db, { migrationsFolder: 'drizzle' });
  console.log('migrations applied');
}

main()
  .then(() => {
    // The libSQL client holds an open handle; without this the process hangs after the
    // last statement instead of exiting, and a CI step that never exits is one that times
    // out with no error to read.
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error(error);
    // A non-zero exit is what makes a failed migration fail the deploy. Logging and
    // falling through would leave the pipeline green over an unmigrated database.
    process.exit(1);
  });
