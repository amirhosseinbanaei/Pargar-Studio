// src/instrumentation.ts
/**
 * The server bootstrap hook. Next.js calls `register()` ONCE per server process, before
 * any request is handled — the only place to start something that must exist for every
 * server render (here: the request-mocking server, so Server Components, Server Actions
 * and Route Handlers hit the same in-memory data as the browser worker).
 *
 * What it must never do:
 *  - run unconditionally. Both guards below are load-bearing (see each comment).
 *  - import the mock module at the top level. A static import pulls the mock server and
 *    every fixture into the production server bundle even when the flag is off, because
 *    the bundler cannot tree-shake a module it must evaluate. The `await import()` inside
 *    the guard is what keeps mocks out of the shipped build.
 *  - do slow or failure-prone work. It blocks the first request; an unhandled rejection
 *    here takes the whole server down at boot.
 *
 * The failure it prevents: without a server-side mock, the browser sees mocked data and
 * server-rendered HTML shows real (or missing) data — the page hydrates into a different
 * screen than it painted, and every "works in the browser, empty on refresh" bug report
 * traces back to exactly this asymmetry.
 *
 * Available since Next 15 without a flag (13/14: `experimental.instrumentationHook`).
 * Dependencies: none at build time.
 */

/** Flag that enables request mocking. Public so the browser half can read the same value. */
// TODO(project): rename to your own flag; keep the NEXT_PUBLIC_ prefix if the client reads it.
const MOCKING_FLAG = process.env.NEXT_PUBLIC_API_MOCKING;

export async function register(): Promise<void> {
  // Guard 1 — the feature flag. Compared against an explicit value, not truthiness, so
  // an accidental `NEXT_PUBLIC_API_MOCKING=false` (a non-empty string) cannot enable
  // mocks in production.
  if (MOCKING_FLAG !== 'enabled') return;

  // Guard 2 — the runtime. `register()` also runs on the edge runtime, where Node-based
  // interceptors cannot run at all; without this check the edge instance throws at boot
  // and every request 500s before any of your code runs.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // TODO(project): create the Node-side mock server (see the mocking guide) and enable
  // this block. Kept commented so this file compiles in a project that has no mocks yet.
  //
  // const { server } = await import('@/mocks/node');
  // // `bypass` lets unmatched requests reach the network instead of failing: mock the
  // // endpoints you have fixtures for, leave the rest real.
  // server.listen({ onUnhandledRequest: 'bypass' });
}

/*
 * ── Optional: the server-side error reporting hook ──────────────────────────────────
 * Next 15+ also calls `onRequestError(error, request, context)` from this file for every
 * server-side error — including ones thrown inside a Server Component or Action, which no
 * client boundary can ever see with a real stack. It is the server half of the reporting
 * story described in the observability module. Enable it once your tracker is installed:
 *
 *   import type { Instrumentation } from 'next';
 *
 *   export const onRequestError: Instrumentation.onRequestError = async (
 *     error,
 *     request,
 *     context,
 *   ) => {
 *     // TODO(project): forward to your error tracker. Keep `digest` — it is the only
 *     // handle correlating this stack with the scrubbed message the user saw.
 *     await reportServerError(error, { path: request.path, routeType: context.routeType });
 *   };
 *
 * Do NOT log the error body to the console here: production server logs are shipped
 * somewhere, and backend payloads have no business in them.
 */
