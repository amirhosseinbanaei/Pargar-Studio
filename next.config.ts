// Target path in a real project: <repo-root>/next.config.ts
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

/**
 * Points next-intl at `src/common/i18n/request.ts` — the non-default location, because
 * this repository keeps shared infrastructure under `common/` rather than in a top-level
 * `src/i18n/`. The plugin's whole job is aliasing `next-intl/config` to that file; without
 * it every next-intl server API throws "Invalid i18n request configuration detected",
 * naming a file the author never wrote.
 */
const withNextIntl = createNextIntlPlugin('./src/common/i18n/request.ts');

/**
 * Remote image hosts, derived from configuration rather than hardcoded.
 *
 * The image optimizer only accepts hosts on an explicit allowlist (Next.js 16 tightened
 * this default). The failure it prevents on the product side is an open image proxy —
 * anyone could make your server fetch and re-serve arbitrary URLs. The failure this
 * FUNCTION prevents is the other direction: a hardcoded host means staging and production
 * need different config files, and the one nobody rebuilt serves broken images with a 400
 * from the optimizer.
 *
 * TODAY THIS RETURNS `[]` AND THAT IS CORRECT, not an oversight: the site ships zero image
 * files — every drawing is generated as SVG at runtime (see `legacy/js/art/draw.js`) — so
 * `NEXT_PUBLIC_MEDIA_URL` is unset and nothing remote is allowed. The function stays so
 * that the day the dashboard grows an upload field, the allowlist follows the env instead
 * of a literal.
 *
 * Reading `process.env` here is safe and correct: this file runs on the build/server side
 * only, never in the browser bundle.
 */
function mediaRemotePatterns(): NonNullable<NextConfig['images']>['remotePatterns'] {
  const raw = process.env.NEXT_PUBLIC_MEDIA_URL;
  if (!raw) return []; // No remote media configured — allow nothing. Fail closed.
  try {
    const url = new URL(raw);
    return [
      {
        protocol: url.protocol === 'https:' ? 'https' : 'http',
        hostname: url.hostname,
        // Omit the key entirely when there is no port — an empty string means
        // "port must be empty", which rejects the default-port form of the same host.
        ...(url.port ? { port: url.port } : {}),
        pathname: '/**',
      },
    ];
  } catch {
    // A malformed URL must not take the build down; an empty allowlist degrades to
    // "no remote images optimized", which is visible and debuggable.
    return [];
  }
}

const nextConfig: NextConfig = {
  /**
   * Cache Components — the reason this project targets 16.3 rather than 15.x.
   *
   * It turns on the `'use cache'` directive plus `cacheLife` / `cacheTag`, and makes
   * Partial Prerendering the default. The read layer (prompt 2) tags every query with
   * `cacheTag`, so one record's page can be cached indefinitely, and the dashboard's write
   * actions (prompt 6) purge exactly those tags with `updateTag`. None of those APIs exist
   * on 15.x — there the design collapses back to `revalidateTag` plus a `router.refresh()`,
   * which cannot express per-record purging.
   *
   * Verified against the installed package: `cacheComponents` is a TOP-LEVEL key on 16.3
   * (node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/
   * cacheComponents.md), not the `experimental.dynamicIO` / `experimental.useCache` it was
   * called before 16.
   *
   * Requires the Node.js runtime; no route in this app may export `runtime = 'edge'`.
   */
  cacheComponents: true,

  /**
   * Traced standalone server output: the runtime image gets a `server.js` plus only the
   * files actually reached, instead of the whole `node_modules` tree. Required by the
   * container work in prompt 7.
   */
  output: 'standalone',

  images: {
    remotePatterns: mediaRemotePatterns(),
    // Serve the smallest modern format the browser accepts (AVIF -> WebP -> original) and
    // keep optimized variants cached server-side for a day, so repeat requests skip a
    // re-encode. Re-encoding on every request is the usual cause of a slow image route.
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24,
  },

  /* ────────────────────────────────────────────────────────────────────────────
   * PERMANENTLY BANNED — do not add these keys, and delete them if you inherit them:
   *
   *   typescript: { ignoreBuildErrors: true }
   *     Ships a build whose types never compiled. The error does not disappear; it
   *     resurfaces as a runtime `undefined` in production, far from its cause.
   *
   *   eslint: { ignoreDuringBuilds: true }
   *     Silences the boundary and a11y rules exactly when they matter most. (The
   *     `eslint` config key was also REMOVED in Next.js 16 — its presence in a config
   *     is a reliable sign the file has not been reviewed since an upgrade.)
   *
   * A type or lint error must fail the build. That is the whole product of the gate.
   * ──────────────────────────────────────────────────────────────────────────── */

  // NOTE: `reactCompiler: true` is intentionally OFF.
  // SYMPTOM: the compiler memoizes reads of react-hook-form's `formState` proxy, so
  //   `isValid` / `isDirty` stop updating and submit buttons never enable. The prompt-6
  //   dashboard is entirely forms, so the breakage would be broad and silent — the form
  //   simply never submits, with no error anywhere.
  // RE-ENABLE WHEN: the `form/` tier subscribes to `formState` fields explicitly and one
  //   representative dashboard save flow is covered by a test.

  // NOTE: `typedRoutes: true` is intentionally OFF for now.
  // SYMPTOM: prompts 4 and 5 build the per-record routes this app exists for, and until
  //   they land every href would point at a route that does not exist — turning it on now
  //   makes the build fail on links that are simply not written yet.
  // RE-ENABLE WHEN: the project / design / media detail routes from prompts 4 and 5 exist
  //   and any data-driven href is `Route`-typed at its single construction site.
};

export default withNextIntl(nextConfig);
