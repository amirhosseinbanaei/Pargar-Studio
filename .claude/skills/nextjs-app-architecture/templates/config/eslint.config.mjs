// Target path in a real project: <repo-root>/eslint.config.mjs
//
// THE BOUNDARY ENFORCER. This file is what makes `app -> modules -> common` a fact
// instead of a README paragraph. See references/01-layering-and-boundaries.md for the
// prose half; the two must stay in sync.
//
// ─────────────────────────────────────────────────────────────────────────────────
// THREE THINGS THAT SILENTLY BREAK THIS FILE — read before editing
// ─────────────────────────────────────────────────────────────────────────────────
//
// 1. FLAT CONFIG *REPLACES* A RULE'S OPTIONS PER MATCHED FILE — IT DOES NOT MERGE.
//    If two config objects both set `no-restricted-imports` and both match a file, the
//    LAST one wins outright; the earlier one contributes nothing. A file under
//    `src/common/components/ds/` matches both the `src/common/**` zone and the
//    primitives exemption below. If the exemption listed only its `ui/` allowance, `ds/`
//    would silently become free to import feature modules — with a green lint run and no
//    warning anywhere. Therefore: EVERY SCOPE DECLARES ITS COMPLETE PATTERN SET. The
//    shared pattern objects below exist so "restating" is one identifier rather than a
//    copy-paste that drifts. (Legacy `.eslintrc` `overrides[]` has the identical hazard.)
//
// 2. GLOBAL `ignores` MUST BE ALONE IN ITS OWN OBJECT. A config object containing
//    `ignores` *and* any other key is a scoped override, not a global ignore list, and
//    your build output gets linted.
//
// 3. DO NOT WRAP A FLAT-CONFIG PACKAGE IN `FlatCompat`. Modern framework configs export
//    a flat-config ARRAY — spread it (`...next`). `FlatCompat` exists only for configs
//    that predate flat config; wrapping an array double-wraps it and throws at startup
//    with an opaque error.
//
// Version note: Next.js 16 removed `next lint`, so ESLint is driven from the npm script
// (`"lint": "eslint ."`). On 15.x `next lint` still exists — use `eslint .` anyway so the
// command is portable. `next build` does NOT run ESLint on either version: if your only
// lint invocation is the build, you are not linting.

import next from 'eslint-config-next';
import storybook from 'eslint-plugin-storybook'; // delete if the project has no workshop

/**
 * EVERY folder directly under `src/modules/` is a boundary module, and every boundary
 * module is listed here. Boundary rules are GENERATED from this array so the contract
 * cannot drift as modules are added or removed.
 *
 * Failure this prevents: a module added without an entry here has NO boundary rules at
 * all — it may import any other module, and lint stays green forever. "Add the name to
 * MODULES" is therefore step 1 of creating a module, before the folder exists.
 *
 * Sub-areas INSIDE a module (e.g. `dashboard/overview`, `dashboard/reports`) are NOT
 * listed: one boundary, one entry, one barrel. They import each other relatively.
 */
const MODULES = ['accounts', 'billing', 'catalog', 'dashboard'];

/* ────────────────────────────────────────────────────────────────────────────── *
 *  Reusable restriction patterns.                                                *
 *  Every message names the FIX, not just the ban. A message that says only        *
 *  "forbidden" gets worked around; a message that says where the code belongs     *
 *  gets obeyed.                                                                   *
 * ────────────────────────────────────────────────────────────────────────────── */

/** Nothing outside `app/` may import from `app/`. */
const NO_APP = {
  group: ['@/app/*', '@/app/**'],
  message:
    'Nothing may import from app/. app/ is routing and composition only; move the shared piece into the owning module or into common/.',
};

/** `common/` is the bottom of the graph: it knows about no feature, ever. */
const NO_MODULES_FROM_COMMON = {
  group: ['@/modules/*', '@/modules/**'],
  message:
    'common/ must not import from modules/ — that pulls a feature bundle into every route and inverts the dependency graph. Invert it instead: take a ReactNode slot or prop and let app/ inject the feature component.',
};

/** Product code consumes the branded layer, never the generated primitives. */
const DS_ONLY = {
  group: ['@/common/components/ui/*'],
  message:
    'Import from common/components/ds or common/components/form, never ui/ directly — ui/ holds unbranded generated primitives that ds/ re-skins, so a regeneration would silently restyle product screens.',
};

/**
 * OPTIONAL — keep only if the project has a request-mocking front-db
 * (see references/09-mocking-and-testing.md). A static import of the mock layer from app
 * code pulls the entire seed dataset into the production client bundle, because a module
 * whose side effect is `setupWorker(...)` cannot be tree-shaken. The mock layer is
 * reached exclusively through `await import()` behind an env flag.
 *
 * Delete this const AND the exemption zone below if you have no mock layer.
 */
const NO_MOCKS = {
  group: ['@/mocks/*', '@/mocks/**'],
  message:
    'Do not import the mock layer from app code — a static import ships the whole seed dataset in the production bundle. Reach it with `await import()` behind the mocking env flag, from the provider file only.',
};

const eslintConfig = [
  // (2) Global ignores — alone in this object, nothing else may be added here.
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'coverage/**',
      'storybook-static/**',
      'next-env.d.ts',
      // Generated by the mock-worker installer; not source, and it fails every rule.
      'public/mockServiceWorker.js',
    ],
  },

  // (3) Framework baseline: type-aware rules, hooks rules, jsx-a11y. Spread, never wrapped.
  ...next,
  ...storybook.configs['flat/recommended'],

  /* ── Broad rule adjustments — few, and each one commented with its trade-off ── */
  {
    // Compiler-readiness advisory rules (react-hooks v6, promoted into `recommended`).
    // Turn these off ONLY while the React Compiler is off in next.config.ts, and say so
    // there too — otherwise the next agent re-enables the compiler and loses the signal.
    // `rules-of-hooks`, `exhaustive-deps`, every jsx-a11y rule, and no-explicit-any all
    // stay ERRORS: they catch real defects, not compiler-readiness nits.
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },

  /* ── Narrowly-scoped override: which files / which rule / WHY it is wrong here ──
   * The third part is what separates an override from a suppression. Delete this block
   * if it does not apply; it is here as the shape to copy. */
  {
    // A renderer that emits documents (PDF, canvas, email) rather than DOM ships its own
    // <Image> element. jsx-a11y/alt-text is a DOM-<img> rule, so it is a guaranteed false
    // positive in this subtree — and turning it off repo-wide would lose real coverage.
    files: ['src/modules/billing/document/components/**/*.tsx'],
    rules: { 'jsx-a11y/alt-text': 'off' },
  },

  /* ══════════════════════════════════════════════════════════════════════════════ *
   *  BOUNDARY ZONES                                                                 *
   *  One-way deps app -> modules -> common. No cross-module imports. Modules are     *
   *  consumed through their index.ts barrel only. Product code uses ds/ + form/.     *
   *  Reminder (1): each zone below declares its COMPLETE pattern set.                *
   * ══════════════════════════════════════════════════════════════════════════════ */

  // Zone A — one generated zone per module.
  ...MODULES.map(name => ({
    files: [`src/modules/${name}/**`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Negations MUST follow the positive group — last match wins. This bans
              // every `@/modules/*` specifier except this module's own.
              group: ['@/modules/**', `!@/modules/${name}`, `!@/modules/${name}/**`],
              message: `No cross-module imports — "${name}" may import only itself. A sideways import creates a cycle the moment the other module needs anything back (undefined exports at module-init time, reproducible only in the production bundle) and makes both modules undeletable. Promote the shared code to common/ instead.`,
            },
            NO_APP,
            DS_ONLY,
            NO_MOCKS,
          ],
        },
      ],
    },
  })),

  // Zone B — common/ imports nothing but itself.
  {
    files: ['src/common/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [NO_MODULES_FROM_COMMON, NO_APP, DS_ONLY, NO_MOCKS],
        },
      ],
    },
  },

  // Zone C — the primitives exemption. ui/ primitives compose each other, ds/ and form/
  // legitimately build on ui/, and stories render all of them in isolation. They are
  // exempt from DS_ONLY — but they RESTATE every other ban, because this block REPLACES
  // Zone B for these files. Dropping a pattern here is the silent-hole scenario in (1).
  {
    files: [
      'src/common/components/ui/**',
      'src/common/components/ds/**',
      'src/common/components/form/**',
      'src/common/stories/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [NO_MODULES_FROM_COMMON, NO_APP, NO_MOCKS],
        },
      ],
    },
  },

  // Zone D — app/ may import module BARRELS and any of common/ except ui/.
  {
    files: ['src/app/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // `@/modules/<name>` (the barrel) is allowed; `@/modules/<name>/<anything>`
              // is not. That single glob is the whole barrel rule.
              group: ['@/modules/*/**'],
              message:
                'Import the module barrel (@/modules/<name>), not its internals — a deep import makes every internal file de-facto public, so renaming a component becomes a repo-wide diff. If the export you need is missing, add it to the barrel deliberately.',
            },
            DS_ONLY,
            NO_MOCKS,
          ],
        },
      ],
    },
  },

  // Zone E — OPTIONAL exemption (delete with NO_MOCKS). The client provider file is the
  // one place in app/ allowed to reach the mock layer, and it does so via `await import()`
  // behind the env flag. It restates Zone D's other patterns, minus NO_MOCKS.
  // `src/mocks/**`, `src/instrumentation.ts` and `src/test/**` need no exemption: they sit
  // outside the three zones and are unrestricted already.
  {
    files: ['src/app/providers.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules/*/**'],
              message: 'Import the module barrel (@/modules/<name>), not its internals.',
            },
            DS_ONLY,
          ],
        },
      ],
    },
  },
];

export default eslintConfig;

/* ────────────────────────────────────────────────────────────────────────────── *
 *  ENFORCEMENT CAVEATS AN AGENT MUST KNOW                                         *
 *                                                                                  *
 *  • `no-restricted-imports` matches the SPECIFIER STRING, not the resolved file.  *
 *    `../../modules/catalog/x` is invisible to it. Therefore cross-layer imports    *
 *    MUST use `@/`, and any `../` climbing out of the current module subtree is a   *
 *    review failure. Add an import-plugin no-relative-parent-import rule if your    *
 *    stack ships one.                                                              *
 *  • Type-only imports are still violations — the type IS the contract, and it is   *
 *    one keystroke from a value import. If you switch to the TypeScript-aware       *
 *    variant of this rule, leave `allowTypeImports` OFF.                            *
 *  • Dynamic `import()` coverage varies by ESLint version. Verify once that a deep  *
 *    `import('@/modules/x/internal')` errors; if it does not, treat dynamic imports *
 *    as a review item.                                                             *
 *  • Landing this on an existing codebase: land at `error` immediately, with today's *
 *    violations listed in a TEMPORARY block of per-file                            *
 *    `rules: { 'no-restricted-imports': 'off' }` entries that you burn down and     *
 *    delete. Do NOT land at `warn` — a warning is a rule nobody obeys, and CI runs  *
 *    `--max-warnings 0` anyway.                                                    *
 * ────────────────────────────────────────────────────────────────────────────── */
