// Target path in a real project: <repo-root>/vitest.config.ts
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // JSX transform + Fast Refresh semantics for component tests. Without it, every `.tsx`
  // test fails at parse time with a syntax error on the first `<`.
  plugins: [react()],

  test: {
    // Component and hook tests need a DOM. Node-only suites can opt out per file with
    // `// @vitest-environment node` rather than splitting the config.
    environment: 'jsdom',

    // Matchers, polyfills, and the mock-server lifecycle. See test-setup.ts in this folder.
    setupFiles: ['./src/test/setup.ts'],

    // Tests are COLOCATED with the code they cover (`__tests__/` beside the source, or a
    // `Component.test.tsx` sibling), never in a mirrored top-level tree: colocated tests
    // get deleted along with the feature, a mirror tree leaves orphans that fail months
    // later for a feature nobody remembers.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist', 'storybook-static'],

    // Parsing CSS costs seconds on every run and nothing asserts on computed styles.
    css: false,

    // Mock call history resets between tests…
    clearMocks: true,
    // …and spies are un-patched, so a `vi.spyOn` in one file cannot leak into another and
    // produce a failure that only reproduces when the whole suite runs in that order.
    restoreMocks: true,
  },

  resolve: {
    alias: {
      // Mirror tsconfig `paths` EXACTLY. The test runner does not read tsconfig, and a
      // missing alias surfaces as "cannot resolve module '@/…'", which reads like a typo
      // in the import rather than a config gap.
      '@': fileURLToPath(new URL('./src', import.meta.url)),

      // `server-only` throws by design outside a server bundle. Aliasing it to an empty
      // module is what makes server services, session code, and Server Actions unit-
      // testable at all — otherwise every such import fails at load time before a single
      // assertion runs. See test-empty-module.ts in this folder.
      'server-only': fileURLToPath(new URL('./src/test/empty-module.ts', import.meta.url)),
    },
  },
});
