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
 *    boot failure into a silent misconfiguration: the app starts, and every canonical
 *    URL and OG image in production points at a machine that does not exist. Throwing at
 *    import time means the app refuses to start — in CI, with the offending keys named.
 *
 * This file must NEVER contain a secret. Anything prefixed `NEXT_PUBLIC_` is shipped to
 * every browser. Server-only configuration lives in `./server-env`, behind `server-only`.
 *
 * PROJECT NOTE — why this schema is short. The architecture's template models an app that
 * talks to a REST backend over HTTP, so it declares an API base URL and the request-mock
 * flags. This app has no backend and no mock layer: its data source is its own SQLite /
 * libSQL database, reached through `db -> repository -> service` (prompt 2), so there is
 * no origin to configure and a seeded dev database replaces MSW. See AGENTS.md.
 *
 * Requires zod v4 (`z.url()`; on zod 3 it is `z.string().url()`).
 */
import { z } from 'zod';

const clientEnvSchema = z.object({
  /**
   * Public origin this app is served from — metadata base, sitemap, robots, canonical
   * URLs, OG images. Required in every environment, with no default: see rule 2 above.
   */
  NEXT_PUBLIC_SITE_URL: z.url(),
  /**
   * Origin serving uploaded media, if one is ever introduced. Optional and unset today:
   * the site ships zero image files — every drawing is generated as SVG at runtime. It
   * also feeds the image-optimizer allowlist in `next.config.ts`, which fails closed to
   * an empty list while this is unset.
   *
   * AN EMPTY STRING IS NORMALIZED TO `undefined` BEFORE VALIDATION, exactly as
   * `TURSO_AUTH_TOKEN` is in `./server-env`. That is how "unset" is spelled in a dotenv
   * file, and `.env.example` ships precisely that (`NEXT_PUBLIC_MEDIA_URL=`) under a
   * comment telling the reader to leave it empty. Without the preprocess,
   * `z.url().optional()` rejects `''` with "Invalid URL" — so a checkout that copied the
   * documented contract verbatim fails to BUILD, on a key it was told to leave blank, with
   * an error that names the variable but not the reason.
   *
   * Found by prompt 6, whose build was the first to run against a `.env.local` copied from
   * the example rather than hand-written.
   */
  NEXT_PUBLIC_MEDIA_URL: z.preprocess(v => (v === '' ? undefined : v), z.url().optional()),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

// Each key is spelled out literally — see rule 1 in the header. Adding a variable means
// adding it in BOTH places; a loop here would compile and then ship `undefined`.
const parsed = clientEnvSchema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_MEDIA_URL: process.env.NEXT_PUBLIC_MEDIA_URL,
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
