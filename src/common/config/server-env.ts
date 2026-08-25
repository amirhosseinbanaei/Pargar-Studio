// src/common/config/server-env.ts
/**
 * Typed, fail-fast SERVER-ONLY configuration — the secrets half of `./env`.
 *
 * Split from the public schema for one reason: everything in `./env` is inlined into the
 * browser bundle, so a secret declared there is a published secret. The `server-only`
 * import below turns a mistaken client import of this module into a BUILD failure rather
 * than a production leak — that guard is the whole point of the split, and it must not be
 * removed to "make a test pass" (the test runner aliases `server-only` to an empty module
 * for exactly that reason; see `vitest.config.ts`).
 *
 * No key here carries a `NEXT_PUBLIC_` prefix, and none has a default. A missing secret
 * must stop the boot with the key named, not surface later as a database call that
 * connects to nothing or a session cookie signed with `undefined`.
 *
 * FAIL-FAST TIMING — nothing imports this module yet, so the schema does not evaluate and
 * a checkout with no `.env.local` still builds. That changes the moment prompt 2's
 * database client imports it: from then on, `npm run build` fails, by design, with the
 * missing key named. That is the behaviour this file exists to provide.
 *
 * Requires zod v4.
 */
import 'server-only';
import { z } from 'zod';

const serverEnvSchema = z.object({
  /**
   * libSQL connection URL for the content database. `libsql://…` against Turso in a
   * deployed environment, `file:./kavan.db` for a local file.
   *
   * CONSUMED BY: prompt 2 (the `db` ring under `common/services`).
   */
  TURSO_DATABASE_URL: z.string().min(1),
  /**
   * Turso auth token. Optional ONLY because a local `file:` database needs none;
   * a `libsql://` URL without it fails at connect time, which is where that check belongs
   * — the driver knows the pairing rule and this schema does not.
   *
   * An EMPTY STRING is normalized to `undefined` before validation, because that is how
   * "unset" is spelled in a dotenv file and `.env.example` ships exactly that
   * (`TURSO_AUTH_TOKEN=`). Without the preprocess, `z.string().min(1).optional()` rejects
   * `''` and a checkout that copied the documented contract verbatim fails to boot on a
   * key it was told to leave blank.
   *
   * CONSUMED BY: prompt 2 (the `db` ring under `common/services`).
   */
  TURSO_AUTH_TOKEN: z.preprocess(v => (v === '' ? undefined : v), z.string().min(1).optional()),
  /**
   * The single admin password the dashboard authenticates against. There is one admin and
   * no user table; this value IS the credential.
   *
   * CONSUMED BY: prompt 6 (the sign-in Server Action).
   */
  ADMIN_PASSWORD: z.string().min(1),
  /**
   * Signing key for the admin session cookie. Minimum 32 bytes so the HMAC has a full
   * block of entropy — a short secret makes the signature forgeable, which on a
   * single-cookie auth design is the entire authentication bypass.
   *
   * Generate with: openssl rand -base64 32
   * CONSUMED BY: prompt 6 (the session module).
   */
  SESSION_SECRET: z.string().min(32),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

// Spelled out one key at a time for the same reason as the public schema: a loop over the
// schema's keys is invisible to static analysis and silently yields `undefined`.
const parsed = serverEnvSchema.safeParse({
  TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
  TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  SESSION_SECRET: process.env.SESSION_SECRET,
});

if (!parsed.success) {
  throw new Error(
    `Invalid server environment variables:\n${JSON.stringify(
      z.flattenError(parsed.error).fieldErrors,
      null,
      2,
    )}`,
  );
}

export const serverEnv: ServerEnv = parsed.data;
