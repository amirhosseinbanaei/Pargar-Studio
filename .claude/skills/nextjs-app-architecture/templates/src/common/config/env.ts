// src/common/config/env.ts
/**
 * Typed, fail-fast PUBLIC configuration, validated once at import time.
 *
 * Two rules make this file work, and breaking either one produces a bug that only
 * appears in a deployed build:
 *
 * 1. **Every `NEXT_PUBLIC_*` value is referenced STATICALLY.** The bundler performs a
 *    textual replacement of `process.env.NEXT_PUBLIC_X`; it cannot see through
 *    `process.env[key]` or a loop over the schema's keys. Such code compiles, passes
 *    review, and yields `undefined` for every public variable in the browser.
 * 2. **Production-critical URLs have NO default.** A `localhost` default converts a loud
 *    boot failure into a silent misconfiguration: the app starts, and every request goes
 *    to a machine that does not exist in production. Throwing at import time means the
 *    app refuses to start — in CI, with the offending keys named.
 *
 * This file must NEVER contain a secret. Anything prefixed `NEXT_PUBLIC_` is shipped to
 * every browser. Server-only configuration belongs in a second schema in its own module
 * behind `import 'server-only'`.
 * TODO(project): create `src/common/config/server-env.ts` on that pattern when you need
 * your first secret.
 *
 * Requires zod v4 (`z.url()`; on zod 3 it is `z.string().url()`).
 */
import { z } from 'zod';

const clientEnvSchema = z.object({
  /** Base URL of the REST API, including any version prefix. Required in every env. */
  NEXT_PUBLIC_API_URL: z.url(),
  /** Public origin this app is served from — metadata base, sitemap, canonical URLs. */
  NEXT_PUBLIC_SITE_URL: z.url(),
  /**
   * Origin serving uploaded media, when it differs from the API origin. Optional: many
   * backends return absolute media URLs already.
   */
  NEXT_PUBLIC_MEDIA_URL: z.url().optional(),
  /**
   * 'enabled' -> endpoints the backend has not shipped yet may serve fixture data
   * (see `@/common/services/pending-backend`). Defaults to 'disabled': fixtures must be
   * opted into deliberately, because a fallback that is on by default makes a real
   * outage look like an empty screen forever.
   */
  NEXT_PUBLIC_PENDING_API_MOCKS: z.enum(['enabled', 'disabled']).default('disabled'),
  /* ── request-mock front-db (delete both keys if the project has no mock layer) ──
   * These two live HERE and not next to the mock layer because they have readers in
   * three different places — the client provider, the mock bootstrap, and the server
   * instrumentation hook — and a flag with three readers needs one validated home. The
   * fixture flag above is the opposite case: one reader, so it derives its boolean in
   * the module that owns it.
   *
   * They must be declared here even though the mock layer is optional: an undeclared
   * key is an UNVALIDATED key, so a CI job or a container that sets
   * `NEXT_PUBLIC_API_MOCKING` gets no error when it misspells the value — it just
   * silently talks to the real backend (or, worse, mocks a production build).
   */
  /**
   * 'enabled' -> serve the app from the in-process mock front-db instead of the real
   * backend. Defaults to 'disabled' so a build with no flag set can never ship mocks.
   * Compared against the literal 'enabled' everywhere, never truthiness: the string
   * 'false' is truthy, and that mistake would enable mocks in production.
   */
  NEXT_PUBLIC_API_MOCKING: z.enum(['enabled', 'disabled']).default('disabled'),
  /**
   * 'enabled' -> mock-layer mutations persist to browser storage and survive a reload.
   * Defaults to 'disabled': persistence defeats a per-test reset, so leaving it on makes
   * test order matter, and a stale snapshot from an older data shape is the single most
   * confusing failure the mock layer can produce.
   */
  NEXT_PUBLIC_MOCK_PERSIST: z.enum(['enabled', 'disabled']).default('disabled'),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

// Each key is spelled out literally — see rule 1 in the header. Adding a variable means
// adding it in BOTH places; a loop here would compile and then ship `undefined`.
const parsed = clientEnvSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_MEDIA_URL: process.env.NEXT_PUBLIC_MEDIA_URL,
  NEXT_PUBLIC_PENDING_API_MOCKS: process.env.NEXT_PUBLIC_PENDING_API_MOCKS,
  NEXT_PUBLIC_API_MOCKING: process.env.NEXT_PUBLIC_API_MOCKING,
  NEXT_PUBLIC_MOCK_PERSIST: process.env.NEXT_PUBLIC_MOCK_PERSIST,
});

if (!parsed.success) {
  throw new Error(
    `Invalid public environment variables:\n${JSON.stringify(
      z.flattenError(parsed.error).fieldErrors,
      null,
      2,
    )}`,
  );
}

export const env: ClientEnv = parsed.data;

/* ── request-mock front-db (delete with the two schema keys above) ─────────────── */

/**
 * True when the app should serve itself from the mock front-db instead of the real API.
 *
 * Exported as a derived BOOLEAN, not read as a string at call sites, for two reasons:
 * the `=== 'enabled'` comparison is written once instead of in every consumer (where one
 * `Boolean(process.env.NEXT_PUBLIC_API_MOCKING)` would enable mocks for the value
 * `'disabled'`), and one grep finds every reader on the day the mock layer is deleted.
 */
export const isMockEnabled = env.NEXT_PUBLIC_API_MOCKING === 'enabled';

/** True when mock-layer mutations should persist to browser storage across reloads. */
export const isMockPersistEnabled = env.NEXT_PUBLIC_MOCK_PERSIST === 'enabled';
