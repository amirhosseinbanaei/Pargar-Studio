// Target path: <repo-root>/drizzle.config.ts
//
// Configuration for `drizzle-kit`, the SCHEMA TOOL — not for the running app. It is read
// by `npm run db:generate` and `npm run db:migrate` and by nothing under `src/`.
//
// This is the one file outside `src/common/config/` that reads `process.env` directly, and
// it is allowed to: drizzle-kit is a CLI that runs before and outside the Next runtime, so
// importing `@/common/config/server-env` here would pull `server-only` and the full
// application env schema (ADMIN_PASSWORD, SESSION_SECRET) into a tool that needs one URL.
// The ban in AGENTS.md is scoped to `src/`, and `grep -rn "process.env" src/` still returns
// only `config/`.
//
// MIGRATIONS ARE GENERATED AND COMMITTED. `drizzle-kit push` — which diffs the schema
// against a live database and applies the difference in place — is NOT the production path
// and must not become one: it makes the deployed schema a function of whichever machine ran
// the command last, so a deploy cannot be reproduced or rolled back. `generate` writes SQL
// into `drizzle/`, that SQL is reviewed in the diff, and `migrate` applies exactly it.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'turso',
  schema: './src/common/services/schema.ts',
  out: './drizzle',
  dbCredentials: {
    // No fallback. A missing URL must fail the command with the key named, rather than
    // silently generating or migrating against some default file nobody meant to touch.
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
  // Fail on a destructive statement instead of emitting it silently.
  strict: true,
  verbose: true,
});
