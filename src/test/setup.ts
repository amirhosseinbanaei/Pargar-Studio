// Target path in a real project: <repo-root>/src/test/setup.ts
//
// Runs once per test FILE, before the file's imports execute. Everything here is either a
// matcher or a jsdom gap that would otherwise surface as a fake product bug.
//
// The template's request-mock lifecycle (`server.listen()`, `resetDb()`) is deliberately
// ABSENT: this project has no MSW front-db — its data source is its own SQLite database,
// and prompt 2 seeds a real dev database instead. See AGENTS.md.
//
// ⚠️ DO NOT IMPORT APPLICATION MODULES THAT REACH SERVER APIS INTO THIS FILE — no global
// client stores, no module that transitively imports `next/headers`, `cookies()`, or a
// Server Action. Doing so pulls those modules into the graph BEFORE any test file runs,
// which defeats every `vi.mock('next/headers')` in the suite: the real module is already
// cached by the time the mock registers, and the symptom is "my mock has no effect" in a
// test file that looks completely correct. Tests that need a store reset do it in their
// own `beforeEach`.

import '@testing-library/jest-dom/vitest';
import { afterEach, expect } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';

/**
 * Makes `expect(await axe(container)).toHaveNoViolations()` a real assertion, so
 * accessibility is a CI GATE rather than a panel nobody opens.
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

// This site's cards draw themselves as they scroll into view, so IntersectionObserver is
// load-bearing for the port in prompts 3–5. A never-firing observer is the right default:
// the element is simply never "seen", so tests assert the pre-intersection state
// deliberately instead of racing a callback.
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
// they override this per test. Note that the shell reads `(prefers-reduced-motion)` and
// `(pointer: coarse)` — a test covering either must override this explicitly.
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

// jsdom has no `document.elementFromPoint`. Inputs that track a fake caret call it FROM A
// TIMER, so the throw lands OUTSIDE any test as an unhandled rejection — which the runner
// reports as an error even when every assertion passed, and which can mask a genuine
// failure elsewhere in the run.
if (typeof document !== 'undefined' && !document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

// Unmount React trees between tests — leaked DOM makes `getByRole` ambiguous in the next
// test, and the failure names the wrong test.
afterEach(cleanup);
