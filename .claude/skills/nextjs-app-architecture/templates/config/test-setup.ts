// Target path in a real project: <repo-root>/src/test/setup.ts
//
// Runs once per test FILE, before the file's imports execute. Everything here is either a
// matcher, a jsdom gap that would otherwise surface as a fake product bug, or the request
// -mock lifecycle.
//
// ⚠️ DO NOT IMPORT APPLICATION MODULES THAT REACH SERVER APIS INTO THIS FILE — no global
// client stores, no module that transitively imports `next/headers`, `cookies()`, or a
// Server Action. Doing so pulls those modules into the graph BEFORE any test file runs,
// which defeats every `vi.mock('next/headers')` in the suite: the real module is already
// cached by the time the mock registers, and the symptom is "my mock has no effect" in a
// test file that looks completely correct. Tests that need a store reset do it in their
// own `beforeEach`.

import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
/* ── request-mock imports: DELETE these three with the lifecycle section below if the
 *    project has no mock layer. They resolve only once `src/mocks/` exists. ────────── */
import { server } from '@/mocks/node';
import { resetDb } from '@/mocks/db/store';
// Non-serializable mock state (rate-limit counters, one-time codes) lives outside the
// store because Maps do not survive `structuredClone`. Reset it explicitly; delete this
// import if your mock layer has none.
import { resetAuthState } from '@/mocks/handlers/accounts';

/**
 * Makes `expect(await axe(container)).toHaveNoViolations()` a real assertion, so
 * accessibility is a CI GATE rather than a panel nobody opens. A workshop a11y addon
 * reports; only a failing test blocks a merge.
 */
expect.extend(toHaveNoViolations);

/* ── jsdom gaps ──────────────────────────────────────────────────────────────────
 * Each of these is a browser API jsdom does not implement. Without the stub, a
 * component that uses it THROWS ON MOUNT, and the failure reads as a product bug —
 * agents then "fix" working components to satisfy a missing DOM API. Every stub is a
 * no-op on purpose: nothing under test asserts on measurements.
 * Guard each one with a feature check so a future jsdom that ships the real API wins.
 * ─────────────────────────────────────────────────────────────────────────────── */

// Headless UI primitives measure themselves on mount (hidden bubble inputs inside forms,
// popover/dialog layers), and they all reach for ResizeObserver.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// Infinite lists, lazy sections, and reveal-on-scroll animations use IntersectionObserver.
// A never-firing observer is the right default: the element is simply never "seen", so
// tests assert the pre-intersection state deliberately instead of racing a callback.
if (!('IntersectionObserver' in globalThis)) {
  globalThis.IntersectionObserver = class {
    root = null;
    rootMargin = '';
    thresholds: number[] = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}

// Components reading a media query crash on first render without matchMedia. A
// never-matching query is the safe default: tests assert the wide/desktop layout unless
// they override this per test.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {}, // deprecated, still called by older libraries
      removeListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom has no `document.elementFromPoint`. Inputs that track a fake caret (OTP fields,
// rich-text carets) call it FROM A TIMER, so the throw lands OUTSIDE any test as an
// unhandled rejection — which the runner reports as an error even when every assertion
// passed, and which can mask a genuine failure elsewhere in the run.
if (typeof document !== 'undefined' && !document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

/* ── Request-mock lifecycle (delete this whole section with the imports above if the
 *    project has no mock layer) ─────────────────────────────────────────────────── */

// The front-db backs every component and hook test, so nothing reaches a real network.
// `onUnhandledRequest: 'error'` INVERTS the app-side setting ('bypass') on purpose: in a
// test, an unhandled request means a handler is missing, and silently letting it through
// produces a test that passes for the wrong reason (or hangs against a real host).
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup(); // unmount React trees — leaked DOM makes `getByRole` ambiguous in the next test
  server.resetHandlers(); // drop per-test `server.use(...)` overrides
  resetDb(); // deterministic seed for every test, so order never matters
  resetAuthState(); // mock state the store cannot hold (see the import note above)
});

afterAll(() => server.close());

/* Companion file — the axe matcher ships Jest types only, so declare it for the runner:
 *
 *   // src/test/vitest-axe.d.ts
 *   import 'vitest';
 *   declare module 'vitest' {
 *     interface Assertion { toHaveNoViolations(): void }
 *     interface AsymmetricMatchersContaining { toHaveNoViolations(): void }
 *   }
 */
