// Target path in a real project: <repo-root>/next.config.ts
import type { NextConfig } from 'next';

/**
 * Remote image hosts, derived from configuration rather than hardcoded.
 *
 * The image optimizer only accepts hosts on an explicit allowlist (Next.js 16 tightened
 * this default; 15.x already required `remotePatterns` for anything remote). The failure
 * it prevents on the product side is an open image proxy — anyone could make your server
 * fetch and re-serve arbitrary URLs. The failure this FUNCTION prevents is the other
 * direction: a hardcoded host means staging and production need different config files,
 * and the one nobody rebuilt serves broken images with a 400 from the optimizer.
 *
 * Reading `process.env` here is safe and correct: this file runs on the build/server side
 * only, never in the browser bundle.
 */
function mediaRemotePatterns(): NonNullable<NextConfig['images']>['remotePatterns'] {
  const raw = process.env.NEXT_PUBLIC_MEDIA_URL ?? process.env.NEXT_PUBLIC_API_URL;
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
   * Traced standalone server output: the runtime image gets a `server.js` plus only the
   * files actually reached, instead of the whole `node_modules` tree. Required by the
   * container template (see Dockerfile in this folder).
   */
  output: 'standalone',

  images: {
    remotePatterns: mediaRemotePatterns(),
    // Serve the smallest modern format the browser accepts (AVIF -> WebP -> original)
    // and keep optimized variants cached server-side for a day, so repeat requests skip
    // a re-encode. Re-encoding on every request is the usual cause of a slow image route.
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

  /* ────────────────────────────────────────────────────────────────────────────
   * RECORDING A DELIBERATELY-DISABLED OPTION
   *
   * When you turn something off (or decline to turn it on), the note must answer three
   * questions or the next agent will silently flip it back: WHAT is off, the SYMPTOM
   * that made you turn it off, and the CONDITION under which it may be re-enabled.
   * Copy this shape:
   *
   *   // NOTE: `reactCompiler: true` is intentionally OFF.
   *   // SYMPTOM: the compiler memoizes reads of the form library's `formState` proxy, so
   *   //   `isValid`/`isDirty` stop updating and submit buttons never enable. This app is
   *   //   form-heavy, so the breakage is broad and silent — the form simply never submits.
   *   // RE-ENABLE WHEN: those components are made compiler-safe (subscribe to formState
   *   //   fields explicitly) and one representative form flow is covered by a test.
   *
   *   // NOTE: `typedRoutes: true` is intentionally OFF for now.
   *   // SYMPTOM: it surfaces pre-existing broken links (an href to a route that does not
   *   //   exist) as build errors, and data-driven string hrefs need `Route`-typing first.
   *   // RE-ENABLE WHEN: the dead links are resolved and dynamic hrefs are cast at their
   *   //   single construction site.
   *
   * A bare `// disabled, breaks things` is worse than nothing: it reads as superstition,
   * so it gets deleted along with the setting.
   * ──────────────────────────────────────────────────────────────────────────── */
};

export default nextConfig;
