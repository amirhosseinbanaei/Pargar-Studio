// src/common/services/db.ts
/**
 * RING 1 of the data layer — the only file in this codebase that opens a database
 * connection.
 *
 * The architecture playbook's ring 1 is `http.ts`: a transport primitive talking to a
 * remote backend. This project has no backend — the database is in-process — so the ring
 * SHAPE is kept and its contents replaced: `db -> repository -> service` stands in for
 * `http -> api-client -> services`. The invariants are unchanged. Ring 1 knows about no
 * table and no domain type; it hands out a connection and nothing else. See AGENTS.md.
 *
 * Three properties this file exists to guarantee:
 *
 * 1. **ONE client per process.** `@libsql/client` holds a connection pool (and, for a
 *    `file:` URL, an open file handle). Constructing a second one per request leaks both
 *    and, on a local file database, produces `SQLITE_BUSY` under any concurrency. Module
 *    scope in ESM is evaluated once per process, which is exactly the lifetime wanted.
 * 2. **No `process.env` here.** The URL and token come through `@/common/config/server-env`,
 *    which zod-parses them at import time and throws with the missing key NAMED. A direct
 *    `process.env.TURSO_DATABASE_URL` would be `string | undefined`, and the `undefined`
 *    case would surface as a connect error at the first request instead of at boot.
 * 3. **No branching on the URL scheme.** `createClient` accepts `file:./kavan.db` and
 *    `libsql://…` through the same call, so development and production differ by an
 *    environment variable and not by a code path. An `if (isProduction)` here would mean
 *    the deployed path is the one never exercised locally.
 *
 * `import 'server-only'` is the guard that turns a mistaken client import into a BUILD
 * failure rather than a production leak of the database URL and auth token into a browser
 * bundle. It must not be removed to make a test pass — the test runner aliases the package
 * to an empty module for exactly that reason (see `vitest.config.mts`).
 */
import 'server-only';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { serverEnv } from '@/common/config/server-env';
import * as schema from './schema';

/**
 * `authToken` is passed as `undefined` for a local `file:` URL, which the driver treats as
 * "no token" — the pairing rule (a `libsql://` URL needs one) belongs to the driver, which
 * knows it, and not to the env schema, which does not.
 */
const client = createClient({
  url: serverEnv.TURSO_DATABASE_URL,
  authToken: serverEnv.TURSO_AUTH_TOKEN,
});

/**
 * The drizzle instance. `schema` is passed so relational queries and `db.query.*` are
 * typed; repositories import THIS, never `createClient`.
 */
export const db = drizzle(client, { schema });

export type Db = typeof db;
