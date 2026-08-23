// Target path in a real project: <repo-root>/commitlint.config.ts
//
// A REQUIRED KEBAB-CASE SCOPE IS THE POINT OF THIS CONFIG.
// `fix(billing): …` tells you which module a change touched without opening the diff.
// That single property is what makes `git log -- src/modules/billing` useful, makes
// changelog generation possible at all, and makes a commit that spans two modules
// visibly wrong at review time — which is usually the first symptom of a boundary
// violation about to be merged.
//
// `module.exports` is used because commitlint loads this file through its CommonJS
// loader; `export default { … }` also works on recent versions if your setup is ESM.
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Long enough for `refactor(server-data-layer): …` and a real sentence; short enough
    // that `git log --oneline` stays scannable.
    'header-max-length': [2, 'always', 100],

    // A closed set. An open one drifts to `update:`, `wip:`, `misc:` — at which point the
    // type carries no information and the log cannot be filtered.
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'chore'],
    ],

    // The scope is MANDATORY. Without it every commit is repo-wide by default and the
    // per-area history is unrecoverable after the fact.
    'scope-empty': [2, 'never'],

    // Kebab-case so scopes match folder names exactly (`design-system`, not `designSystem`
    // or `DesignSystem`) — three spellings of one scope split the history three ways.
    'scope-case': [2, 'always', 'kebab-case'],

    'subject-case': [2, 'always', ['sentence-case', 'lower-case']],
  },
};

/* Ship a commit template too, and wire it once per clone:
 *   git config commit.template .gitmessage.txt
 *
 * ── .gitmessage.txt ─────────────────────────────────────────────────────────
 * # <type>(<scope>): <short summary>
 * # │       │
 * # │       └─ kebab-case module, service, or component: accounts, billing, api, ui
 * # └─ feat, fix, docs, style, refactor, perf, test, chore
 * #
 * # feat(accounts): add token-based sign-in
 * # fix(catalog): resolve dropdown flicker on Safari
 *
 * <type>(<scope>): <short summary>
 *
 * # --- BODY (optional) — explain WHY, not what. The diff already says what.
 * # --- FOOTER (optional) — BREAKING CHANGE:, Refs:, Co-authored-by:
 * ────────────────────────────────────────────────────────────────────────────
 */
