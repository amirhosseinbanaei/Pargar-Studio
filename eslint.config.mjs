// Target path in a real project: <repo-root>/eslint.config.mjs
//
// THE BOUNDARY ENFORCER. This file is what makes `app -> modules -> common` a fact
// instead of a README paragraph. See
// .claude/skills/nextjs-app-architecture/references/01-layering-and-boundaries.md for the
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
//    copy-paste that drifts.
//
// 2. GLOBAL `ignores` MUST BE ALONE IN ITS OWN OBJECT. A config object containing
//    `ignores` *and* any other key is a scoped override, not a global ignore list, and
//    your build output gets linted.
//
// 3. DO NOT WRAP A FLAT-CONFIG PACKAGE IN `FlatCompat`. Modern framework configs export
//    a flat-config ARRAY — spread it. `FlatCompat` exists only for configs that predate
//    flat config; wrapping an array double-wraps it and throws at startup with an opaque
//    error.
//
// Version note: Next.js 16 removed `next lint`, so ESLint is driven from the npm script
// (`"lint": "eslint ."`). `next build` does NOT run ESLint: if your only lint invocation
// is the build, you are not linting.
//
// PROJECT DEVIATION: `eslint-plugin-storybook` is NOT installed (no component workshop —
// see AGENTS.md), so the template's storybook import and spread are deleted rather than
// left in place; a config that references an absent plugin cannot load at all.

import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/**
 * EVERY folder directly under `src/modules/` is a boundary module, and every boundary
 * module is listed here. Boundary rules are GENERATED from this array so the contract
 * cannot drift as modules are added or removed.
 *
 * Failure this prevents: a module added without an entry here has NO boundary rules at
 * all — it may import any other module, and lint stays green forever. "Add the name to
 * MODULES" is therefore step 1 of creating a module, before the folder exists.
 *
 * `projects` was added by prompt 4 BEFORE `src/modules/projects/` existed, which is the
 * only order that works: a boundary declared against zero files is free, and the same
 * boundary retrofitted onto a grown tree costs roughly ten times as much, because by then
 * every violation is load-bearing. Prompts 5–7 add the rest the same way, one name at a
 * time.
 *
 * `dashboard` was added by prompt 6 the same way, and it is the module where the rule
 * earns the most: it is the only module that WRITES, so it is the one whose actions the
 * other six will be tempted to reach into directly when prompt 7 repeats the CRUD pattern
 * for design, media, studio, contact and messages. It may not — those screens belong to
 * `dashboard` too, and anything genuinely shared between them is promoted to `common/`.
 */
const MODULES = ['projects', 'design', 'media', 'studio', 'contact', 'dashboard'];

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

const eslintConfig = [
  // (2) Global ignores — alone in this object, nothing else may be added here.
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'coverage/**',
      'next-env.d.ts',
      // The prompt artifacts this work was generated from; documents, not source.
      'prompts/**',
    ],
  },

  // (3) Framework baseline: type-aware rules, hooks rules, jsx-a11y. Spread, never wrapped.
  // Next 16 ships these as two subpath entries rather than one default export.
  ...nextVitals,
  ...nextTs,

  /* ══════════════════════════════════════════════════════════════════════════════ *
   *  BOUNDARY ZONES                                                                 *
   *  One-way deps app -> modules -> common. No cross-module imports. Modules are     *
   *  consumed through their index.ts barrel only. Product code uses ds/ + form/.     *
   *  Reminder (1): each zone below declares its COMPLETE pattern set.                *
   * ══════════════════════════════════════════════════════════════════════════════ */

  // Zone A — one generated zone per module. Empty until MODULES has a name in it.
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
          patterns: [NO_MODULES_FROM_COMMON, NO_APP, DS_ONLY],
        },
      ],
    },
  },

  // Zone C — the primitives exemption. ui/ primitives compose each other, and ds/ and
  // form/ legitimately build on ui/. They are exempt from DS_ONLY — but they RESTATE
  // every other ban, because this block REPLACES Zone B for these files. Dropping a
  // pattern here is the silent-hole scenario in (1).
  {
    files: [
      'src/common/components/ui/**',
      'src/common/components/ds/**',
      'src/common/components/form/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [NO_MODULES_FROM_COMMON, NO_APP],
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
 *    review failure.                                                                *
 *  • Type-only imports are still violations — the type IS the contract, and it is   *
 *    one keystroke from a value import. If you switch to the TypeScript-aware       *
 *    variant of this rule, leave `allowTypeImports` OFF.                            *
 *  • Dynamic `import()` coverage varies by ESLint version. Verify once that a deep  *
 *    `import('@/modules/x/internal')` errors; if it does not, treat dynamic imports *
 *    as a review item.                                                             *
 *  • Adding a module: put its name in MODULES FIRST, before the folder exists. A    *
 *    module with no entry here has no boundary rules at all.                        *
 * ────────────────────────────────────────────────────────────────────────────── */
