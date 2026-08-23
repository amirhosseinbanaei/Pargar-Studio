# Toolchain, quality gates, and repo hygiene

**Read this when:** the gate fails, you are wiring or repairing CI, hooks, Docker or env files, or
you need to know whether a rule may be suppressed (it may not).

The architecture in the other guides is only real if a machine enforces it. This file defines the
fixed script names every project exposes, the four-command gate that decides whether a change is
done, and the config — TypeScript, ESLint, Prettier, hooks, CI, containers — that makes the rules
unmergeable rather than aspirational.

> **Versions.** Every example leads with the **Next.js 16** form; the 15.x equivalent is given
> inline wherever they differ. Zod examples are **zod 4** (see `references/05-contracts-and-schemas.md`
> for the zod 3 spellings).

## Invariants

- **The script names are fixed across every project in this architecture.** An agent that lands in
  an unfamiliar repo must be able to run `npm run typecheck` without reading `package.json` first.
- **The gate is `typecheck && lint && build && test`. All four pass, or the change is not done.**
  Not "mostly passes", not "fails on unrelated files".
- **Every suppression flag is banned**: `typescript.ignoreBuildErrors`, `eslint.ignoreDuringBuilds`,
  `git commit --no-verify`, `git push --no-verify`, `.skip`/`.todo` on a test you just broke, and
  file-level or blanket `eslint-disable`.
- **`no-explicit-any` is an error, never a warning.** The sanctioned escape hatch is `unknown` plus
  a type guard — never `any`, never a cast chain through `as unknown as T`.
- **Every `eslint-disable` is single-line, names exactly one rule, and carries a comment saying why
  the rule is a false positive here.** A disable without a reason is a bug with a silencer on it.
- **CI runs the identical commands as the local gate, in the same order.** CI must never be able to
  pass where local fails, or vice versa.
- **Generated route types are an input to typechecking**, not an afterthought: run the framework's
  type generator before `tsc`, and include its output directories in `tsconfig.json`.
- **`NEXT_PUBLIC_*` variables are inlined at build time.** They are build arguments, not runtime
  environment. Setting one on a running container does nothing.
- **Every new environment variable lands in `.env.example`, documented, in the same commit that
  first reads it.** `.env.example` is the configuration contract; real `.env*` files are never
  committed.
- **Hooks are not optional infrastructure.** `pre-commit` formats, `commit-msg` validates the
  message, `pre-push` runs the gate. A repo where hooks are routinely bypassed has no gate.
- **The project's agent-instructions file stays short**: stack line, gate commands, a pointer to
  this skill, project-specific bans. The architecture lives here, not there.

---

## 1. The canonical script set

Expose exactly these names in `package.json`. The names matter more than the implementations —
consistency across projects is the entire point, because both humans and agents memorize the verbs,
not the repo.

| Script            | Must do                                                            | Notes                                                            |
| ----------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `dev`             | Start the dev server                                               | No flags an agent must remember; put the port here if non-default |
| `build`           | Production build                                                   | Fails on any type or lint-independent build error                |
| `start`           | Serve the production build                                         | Bind `-H 0.0.0.0` so containers and LAN devices can reach it     |
| `lint`            | `eslint .`                                                          | Never the framework's own lint wrapper (see §1.1)                |
| `lint:fix`        | `eslint . --fix`                                                    | Autofix only; never used as a substitute for reading the error   |
| `typecheck`       | `tsc --noEmit`                                                      | The single source of type truth                                  |
| `typegen`         | Generate framework route types                                     | Must run before `typecheck` on a clean checkout                  |
| `test`            | Run the suite once, non-watch                                      | `--passWithNoTests` so a fresh project's gate is green           |
| `test:watch`      | Run the suite in watch mode                                        | Never the CI command                                             |
| `format`          | `prettier --write .`                                                | Writes                                                           |
| `format:check`    | `prettier --check .`                                                | Read-only; safe for CI                                           |
| `storybook`       | Start the component workshop dev server                            | Only if the project has a design system (see `references/02-design-system.md`) |
| `build-storybook` | Build the static workshop                                          | A real build gate: it catches broken stories the app never renders |
| `prepare`         | Install git hooks (`husky`)                                        | Runs on `npm install`; that is what makes hooks self-installing  |

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start -H 0.0.0.0",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "typecheck": "tsc --noEmit",
    "typegen": "next typegen",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build",
    "prepare": "husky"
  }
}
```

**Template:** `templates/config/package.scripts.json` → merge its two blocks (`scripts` and
`lint-staged`) into `package.json`. It is annotated JSON — strip every comment when you paste, or
`npm` rejects the file. The configs those scripts drive are templates too, and each is owned by the
guide that explains it:

| Script | Config template | Owning guide |
| --- | --- | --- |
| `typecheck` | `templates/config/tsconfig.json` | §3 below |
| `lint` | `templates/config/eslint.config.mjs` | §4 below and `references/01-layering-and-boundaries.md` §7 |
| `format` | `templates/config/.prettierrc` | §5 below |
| `test` | `templates/config/vitest.config.ts`, `test-setup.ts`, `test-empty-module.ts` | `references/09-mocking-and-testing.md` §8 |
| `storybook` / `build-storybook` | `templates/config/storybook-main.ts`, `storybook-preview.tsx` | `references/02-design-system.md` |
| `build` | `templates/config/next.config.ts` | `references/10-routing-and-app-shell.md` §9 |

### 1.1 Version-sensitive script details

- **Next.js 16**: Turbopack is the default for both `dev` and `build`. **Remove `--turbopack` /
  `--turbo` from your scripts** — they are no longer meaningful, and a stray webpack config with no
  explicit `--webpack` flag fails the build loudly. On 15.x, opt in with `next dev --turbopack`.
- **Next.js 16**: `next lint` was removed. Drive ESLint directly (`eslint .`). On 15.x, `next lint`
  still exists but prefer `eslint .` anyway so the command is portable.
- **`next build` does not run ESLint.** If your only lint invocation is the build, you are not
  linting. This is exactly why `lint` is a separate gate step.

---

## 2. The verification gate

**Run all four after any non-trivial change. A change with a red gate is not done, regardless of
how correct it looks.**

```bash
npm run typecheck   # 1. types — cheapest, fails fastest
npm run lint        # 2. rules and boundaries
npm run build       # 3. the compiler's own view: RSC boundaries, imports, prerender
npm run test        # 4. behavior
```

Order is deliberate: cheapest signal first. On a clean checkout or after touching routing, run
`npm run typegen` before `typecheck` — generated route types (`PageProps`, `LayoutProps`,
`RouteContext`) do not exist until they are generated, and `tsc` will report confident nonsense
about your page props without them.

**Why `build` is in the gate even though `typecheck` passed.** `tsc` does not know about the
server/client boundary. The build is the only step that catches a server-only module pulled into a
client bundle, an `async` component used where the runtime forbids it, a missing `'use client'`, or
a prerender that throws. These are the failures that reach production.

**Why `test` is last, not skipped.** It is the slowest and the most likely to be "obviously fine".
That is precisely the step people skip, and it is the step that catches the regression that the
type system was structurally incapable of seeing.

### 2.1 Banned escape hatches, and what each one costs

| Escape hatch                                        | What it actually does                                                                              | Do this instead                                                     |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `typescript.ignoreBuildErrors: true`                | Ships a build whose types never compiled. The error resurfaces as a runtime `undefined` in production | Fix the type, or narrow with a guard                                |
| `eslint.ignoreDuringBuilds: true`                   | Silences boundary and a11y rules exactly when they matter most. (The config key is also **removed in Next 16** — its presence is a stale-config smell) | Fix the violation, or add a scoped override with a reason           |
| `git commit --no-verify`                            | Lands unformatted code and an unparseable commit message; the next person's diff is 90% whitespace | Fix the hook failure. If the hook is wrong, fix the hook            |
| `git push --no-verify`                              | Moves the gate from your machine to CI, where the failure costs 10 minutes instead of 10 seconds   | Run the gate                                                        |
| `it.skip` / `it.todo` on a test you just broke      | Converts a red signal into a green one while the defect remains                                    | Fix the code, or delete the test with a commit message saying why   |
| File-level `/* eslint-disable */`                   | Disables *every* rule for the whole file forever, including rules added later                       | Single-line disable, one named rule, with a justification comment   |
| `as any` / `as unknown as T`                        | Asserts a lie to the compiler; the runtime shape is unchanged                                       | Parse or guard (§3.2)                                               |

### 2.2 When the gate fails on code you did not touch

Fix it or report it — do not route around it. A pre-existing failure that everyone steps over
trains the whole team to ignore a red gate, which is the only thing keeping the gate useful. If it
genuinely cannot be fixed in this change, fix it in a separate commit first, in the same branch.

---

## 3. TypeScript configuration

**Template:** `templates/config/tsconfig.json` → `<repo-root>/tsconfig.json`. Copy it whole rather
than hand-assembling; seven of its settings are load-bearing:

| Setting                                 | Why it is non-negotiable                                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `"strict": true`                        | Without it, `null` and `undefined` are assignable everywhere and the entire contracts layer (`references/05-contracts-and-schemas.md`) buys you nothing |
| `"paths": { "@/*": ["./src/*"] }`       | The `@/` alias is what the boundary lint rules match on. Relative `../../../common/...` imports are invisible to `no-restricted-imports` and silently bypass every boundary |
| `"moduleResolution": "bundler"`         | Matches how the bundler actually resolves; `node`/`node16` will reject valid `exports`-map imports that build fine                        |
| `"isolatedModules": true`               | Each file must be transpilable alone — this is what the bundler does. It forces `export type { … }` for type-only re-exports, which is also what keeps barrels from dragging runtime code into client bundles |
| `"incremental": true`                   | Makes repeated `typecheck` runs fast enough that people actually run them. Gitignore `*.tsbuildinfo`                                       |
| `"plugins": [{ "name": "next" }]`       | Editor-only: gives the IDE framework-aware diagnostics. It does **not** affect `tsc`, so never rely on it as a gate                        |
| `.next/types/**` + `.next/dev/types/**` | Where generated route types land. Omit them and every typed `params`/`searchParams` signature silently degrades. Both paths: build and dev emit to different roots in Next.js 16 |

> **Version note.** On 15.x, generated route types live under `.next/types/**` only, and `typedRoutes`
> is an `experimental` flag; on 16.x it is top-level. Including a directory that does not exist is
> harmless, so ship both entries.

A root `globals.d.ts` for the two or three ambient types used so pervasively that importing them is
noise is fine, but keep it tiny — ambient globals are unsearchable and un-tree-shakable — and end it
with `export {}`, or the file is a script rather than a module and its `declare global` is ignored.

### 3.1 `no-explicit-any` and its sanctioned escape hatch

`any` disables checking for every value that flows out of it, silently and transitively. That is
why it is an **error**, not a warning. Unknown-shaped data — a parsed JSON body, a caught error, a
third-party callback payload — is typed `unknown` and narrowed:

```ts
// ❌ `body.detail` compiles even when body is a string, then blows up at runtime.
const readDetail = (body: any): string | undefined => body.detail;

// ✅ unknown + a guard: the narrowing is checked, and the failure mode is a defined `undefined`.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readDetail(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined;
  return typeof body.detail === 'string' ? body.detail : undefined;
}
```

For anything with a real shape, do not hand-write the guard — parse it with the schema layer
(`references/05-contracts-and-schemas.md`) and get the type for free.

The only place a disable is defensible is a genuinely variadic generic constraint, and it looks like
this — one line, one rule, with the reason:

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- constraint position only; the
// value is never read as `any`, and `unknown` here rejects every real function argument.
type AnyFn = (...args: any[]) => unknown;
```

---

## 4. ESLint flat config composition

**Template:** `templates/config/eslint.config.mjs` → `<repo-root>/eslint.config.mjs`. It is the
single canonical copy in this skill; `references/01-layering-and-boundaries.md` §7 lists the three
edits it needs on arrival and the boundary zones it declares. This section covers only the flat-
config mechanics you need in order to modify it safely.

**The `FlatCompat` trap.** `FlatCompat` exists to wrap *legacy* (`.eslintrc`-style) shareable
configs. When a package already exports a flat array, wrapping it — `...compat.extends('next')` —
double-wraps it and throws at startup with an opaque config error. Rule: **if the package exports an
array, spread it; only reach for `FlatCompat` for a config that predates flat config.**

**Ignores must be their own first object.** A config object containing `ignores` *and* anything else
is a scoped override, not a global ignore list. Global ignores are the only key in their object.

### 4.1 Layer order

Later objects win. Compose in this order, and never reorder casually:

1. Global `ignores`.
2. Framework config (`...next`) — the baseline, including type-aware rules, a11y rules, and hooks.
3. Additional plugin recommended configs (workshop/stories, testing).
4. **Broad rule adjustments** — a small number of deliberate on/off decisions, each commented.
5. **Narrowly-scoped overrides** — `files: [glob]` + the single rule + why it is a false positive.
6. **Boundary zones** — the generated `no-restricted-imports` contract (§4.3).

### 4.2 The shape of a legitimate override

Every override answers three questions in place: *which files*, *which rule*, *why the rule is wrong
here*. Missing the third is the difference between an override and a suppression.

```js
{
  // A renderer that emits documents rather than DOM uses its own <Image> element.
  // jsx-a11y/alt-text is a DOM-<img> rule, so it is a guaranteed false positive in
  // this subtree — and disabling it repo-wide would lose real a11y coverage everywhere else.
  files: ['src/modules/billing/document/components/**/*.tsx'],
  rules: { 'jsx-a11y/alt-text': 'off' },
},
```

A broad adjustment gets the same treatment, with the trade-off written down:

```js
{
  // Compiler-readiness advisory rules (react-hooks v6, promoted to `recommended`).
  // The compiler is OFF in this project (see next.config.ts for the reason), so these
  // advisories only produce noise. `rules-of-hooks`, `exhaustive-deps`, every jsx-a11y
  // rule, and no-explicit-any all stay ERRORS.
  rules: {
    'react-hooks/set-state-in-effect': 'off',
    'react-hooks/refs': 'off',
    'react-hooks/immutability': 'off',
    'react-hooks/preserve-manual-memoization': 'off',
  },
},
```

### 4.3 Boundary zones

The `no-restricted-imports` zones that enforce `app → modules → common` are generated from the
`MODULES` array so the contract cannot drift as modules are added or removed. **Flat config
*replaces* a rule's options per matching file rather than merging them**, so each zone must declare
its complete pattern set — a zone that lists only its own new restriction silently drops every
inherited one. The full generator, every zone (A–E, two of which exist only to *widen* one ban),
and the message wording live in `references/01-layering-and-boundaries.md` §7; do not re-derive
them here.

### 4.4 Lint cleanliness

Run CI with `--max-warnings 0`. A warning nobody must fix accumulates until the output is
unreadable, at which point the errors hide in it. Every rule is either an error or off.

---

## 5. Prettier and lint-staged

**Template:** `templates/config/.prettierrc` → `<repo-root>/.prettierrc`, and the `lint-staged`
block in `templates/config/package.scripts.json` → `package.json`.

Four things in them are not taste:

- **The utility-class sorting plugin must be LAST in `plugins`.** It overrides Prettier's printer;
  any plugin listed after it wins and class sorting silently stops. With one plugin this is
  invisible — it bites the day someone adds an import-sorter.
- **`tailwindStylesheet` must point at your CSS entry** (`./src/app/globals.css`, created in
  `references/02-design-system.md` §0). Without it, custom utilities sort as "unknown" and drift to
  the end of every class list, which reads as random churn in reviews.
- **`tailwindFunctions` must list every class-composing helper** (`cn`, `clsx`, `cva`) or the
  classes inside those calls go unsorted — which, in a design-system codebase, is most of them.
- **In `lint-staged`, `eslint --fix` runs before `prettier --write`.** ESLint's autofixes are not
  formatting-aware; reverse the order and every commit lands slightly mis-formatted, so the next
  person's diff is whitespace. lint-staged runs on **staged files only** — a fast pre-flight, never
  a substitute for `npm run lint`.

**Formatting is never a lint rule.** Prettier owns formatting; ESLint owns correctness. Overlap
produces fights where `--fix` and `--write` undo each other on every save, and the file churns
forever.

---

## 6. Commit discipline

**Templates:** `templates/config/husky-pre-commit.sh`, `husky-commit-msg.sh`, `husky-pre-push.sh`
→ `.husky/<name>` (drop the `husky-` prefix and the `.sh`), and
`templates/config/commitlint.config.ts` → `<repo-root>/commitlint.config.ts`.

Hooks are installed by the `prepare` script, so a fresh `npm install` wires them up with no manual
step — without it, hooks exist only on the machine of whoever set them up. Husky v9+ hook files are
plain shell: no shebang, no sourcing preamble.

Three decisions in them:

- **`pre-push` runs `typecheck && lint && test` and deliberately omits `build`.** Build is the
  slowest step and CI runs it on every push anyway. Catch cheap failures in seconds locally; let the
  expensive one run in parallel remotely.
- **`--no-install` on the `commit-msg` hook** prevents a surprise network fetch mid-commit.
- **A required kebab-case scope is the point of the commitlint config.** `fix(billing): …` tells you
  which module a change touched without opening the diff — which makes
  `git log -- src/modules/billing` useful, makes changelog generation possible, and makes a
  cross-module commit visibly wrong at review time.

Ship a commit template alongside them and wire it with
`git config commit.template .gitmessage.txt`, so the scope convention is in front of whoever is
writing the message rather than in a doc.

---

## 7. CI

**Template:** `templates/config/ci.yml` → `.github/workflows/ci.yml`.

**CI runs the local gate — the same command SET, so "it passes locally" and "it passes in CI"
cannot diverge.** When they can diverge, developers learn to treat CI failures as noise and the gate
stops being a gate.

The template deviates from the local gate in exactly three sanctioned ways, and they are the ones an
audit must not flag:

1. **It runs `typegen` first.** Generated route types do not exist on a clean checkout, and without
   them `tsc` reports confident nonsense about page props that nobody can reproduce locally.
2. **It runs `test` before `build`.** The slowest step runs last so a fast failure is reported
   sooner. The *set* is identical; only the order differs.
3. **It appends `build-storybook`.** A real gate step, not a nicety: it compiles every story,
   catching components no current route happens to render. Delete it with the workshop.

Five rules about the file itself:

- **`npm ci`, never `npm install`.** `ci` installs exactly the lockfile; `install` may resolve new
  versions, which means CI would be testing a dependency tree nobody has locally.
- **`cache: npm`, keyed on the lockfile.** Do not cache `.next/` across runs unless you have
  measured the win — a stale build cache produces failures that reproduce on no developer machine.
- **`--max-warnings 0` on lint.** A warning nobody is required to fix accumulates until real errors
  hide inside it. Every rule is either an error or off.
- **Public env vars go on the `build` step, not the job**, and must match what a deploy will use
  (§8.2). They are inlined into the client bundle at that moment and can never be changed
  afterwards.
- **Keep it one job unless it is genuinely slow.** A matrix costs you a shared `node_modules` and a
  coherent failure story ("which of the five is the real cause?").

---

## 8. Containerization

**Templates:** `templates/config/Dockerfile`, `templates/config/.dockerignore`,
`templates/config/compose.yaml` → repo root. They require `output: 'standalone'` in
`next.config.ts` (already set in `templates/config/next.config.ts`), which produces a traced
`server.js` plus only the files actually reached — the runner image then contains a Node runtime,
that server, and nothing else: no `node_modules`, no source, no build toolchain.

Five things in the Dockerfile that are load-bearing rather than boilerplate:

- **`NEXT_PUBLIC_*` values are `ARG`/`ENV` in the BUILDER stage.** They are inlined into the client
  bundle at build time; setting them on the runner does nothing (§8.2).
- **Copy `.next/standalone` first, then `.next/static` and `public/` into it.** The standalone
  output does not include static assets, and a build that copies only `standalone` starts fine and
  serves an unstyled page with 404s for every chunk.
- **Run as a non-root user** created in the runner stage.
- **`HOSTNAME=0.0.0.0`.** The default binding is loopback: the container starts, reports healthy,
  and refuses every connection from outside it.
- **The `HEALTHCHECK` probes `/api/health`,** so it needs that route to exist. Create it now — the
  templates do not ship it, and without it the container never reports healthy and any
  `depends_on: { condition: service_healthy }` waits forever:

  ```ts
  // src/app/api/health/route.ts
  /** Liveness probe for the container healthcheck and the orchestrator. Deliberately
   *  trivial: it must answer even when the backend is down, or a backend outage takes
   *  your frontend containers down with it. */
  // Never prerendered — a static 200 baked at build time would report healthy from a
  // process that is no longer running.
  export const dynamic = 'force-dynamic';

  export function GET(): Response {
    return Response.json({ ok: true });
  }
  ```

### 8.1 `.dockerignore`

The single rule: **`.dockerignore` must exclude `node_modules`, `.next`, `.git`, and every `.env*`
file.** Copying a host `node_modules` into the image ships platform-specific binaries that fail at
runtime; copying `.env` bakes secrets into a layer that anyone with the image can read.

### 8.2 Build-time vs runtime environment — the production surprise

| Kind                                     | Read when                       | How to supply it                                     |
| ---------------------------------------- | ------------------------------- | ----------------------------------------------------- |
| `NEXT_PUBLIC_*` (any client-visible var) | **Build time.** Statically inlined into the JS the browser downloads | Docker `ARG`/`ENV` in the **builder** stage; CI `env:` on the build step |
| Server-only vars (secrets, internal URLs) | **Runtime**, per request        | Orchestrator `environment:` / `env_file` on the running container |

**The surprise:** setting `NEXT_PUBLIC_API_URL` on a running container has no effect whatsoever. The
value was frozen into the bundle during `npm run build`. Symptoms are consistently misread as a
caching or CORS problem: the browser keeps calling the URL from whatever machine built the image.

Two consequences to design around:

1. **One image per public-config target.** If staging and production need different public URLs,
   they need different builds — or the value must be delivered as runtime data (fetched from a
   server route) rather than as a public env var.
2. **Public vars must be referenced statically.** `process.env.NEXT_PUBLIC_API_URL` is replaced by
   the bundler; `process.env[key]` is not, and yields `undefined` in the browser. This is why the
   env module (`references/03-server-data-layer.md`) lists each variable literally instead of
   iterating.

### 8.3 Compose for local full-stack work

**Template:** `templates/config/compose.yaml`.

The one thing it exists to teach: **the public URL and the internal URL are different values and
both are needed.** The browser resolves `localhost`; the server container resolves the compose
service name. Collapsing them into one variable breaks whichever side you did not test — usually
server-side fetching, which then fails only in the container and never in `npm run dev`.

So: `NEXT_PUBLIC_API_URL` is a **build arg** (browser-reachable, inlined), and the internal URL is a
**runtime environment value** on the running service. Behind a shared reverse proxy, drop `ports:`
for `expose:` and attach the external proxy network instead. `security_opt: no-new-privileges` and
`init: true` are cheap and belong on every service.

---

## 9. `.env.example` is the configuration contract

**Template:** `templates/config/env.example` → `<repo-root>/.env.example`.

**Every variable the app reads appears there, with a comment explaining what it does and what
happens at each value — added in the same commit that first reads it.** A variable that exists only
in someone's local `.env.local` is a deployment outage scheduled for whenever that person is on
vacation. The value of the file is the comments, not the keys.

Gitignore rule — opt-in, not opt-out, so a new secret file can never be committed by accident:

```gitignore
# env files (opt-in: commit the example, ignore real secrets)
.env*
!.env.example
```

Three rules:

- **Never put a real secret in it** — not even a "dev only" one. Leave the key empty and document
  how to obtain it.
- **`.env.example` documents the contract; `common/config/env.ts` enforces it**, throwing at import
  on a missing or malformed variable rather than letting `undefined` propagate into a fetch URL
  (`references/03-server-data-layer.md` §5).
- **Production-critical variables must not carry `localhost` defaults.** A default turns a loud
  startup failure into a silent production misconfiguration.

---

## 10. Operational scripts

A `scripts/` directory holds ad-hoc operational tooling: design-token pulls, measurement and
screenshot runs against a live dev server, one-off data migrations. Rules:

- **Nothing in `src/` may import from `scripts/`, ever.** They are not part of the application
  graph, are not typechecked with the same settings, and must not appear in a bundle.
- **Write them as plain Node ESM (`.mjs`)** so they run with no build step and no loader flags.
- **Gitignore their outputs** (`scripts/*/output/`). Generated design data and screenshots are
  artifacts, not source.
- **They are not gate steps.** A script requiring a running server or a personal access token must
  never sit between a developer and a green build.
- **Any token a script needs is documented in `.env.example`** with no `NEXT_PUBLIC_` prefix — an
  operational credential must never reach the browser bundle.

---

## 11. The project agent-instructions file

**Template:** `templates/config/AGENTS.md.template` → `<repo-root>/AGENTS.md` (or `CLAUDE.md`).

**Keep it under ~40 lines.** It is a router, not a manual — the architecture lives in this skill,
and a second copy of a rule is a rule that will disagree within a month.

It contains exactly four things, and nothing else:

1. **The stack line** — framework and major version, router, React version, TypeScript strict, and
   any non-default local port.
2. **The gate** — the four commands verbatim, plus the statement that a type or lint error fails
   the work.
3. **Pointers** — to this skill for architecture, and to any version-matched framework docs
   vendored in the repo.
4. **Project-specific bans** — the handful of APIs, flags, or patterns forbidden *here*, each with
   its reason. Removed-in-v16 APIs (sync `params`/`cookies()`, `middleware.ts`, `next lint`) and
   suppression flags belong on this list.

If a framework docs set is vendored in the repo, add one rule: **when a vendored guide and the
installed package disagree, trust the package and report the discrepancy.** Version-matched docs
inside the installed package are ground truth; a checked-in guide is a snapshot that ages.

---

## Anti-patterns

| Never do this                                                        | Because                                                                                                        | Do this instead                                                              |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Rename or drop a canonical script (`check` instead of `typecheck`)    | Every agent and every runbook that assumes the standard name breaks silently                                    | Keep the name; alias extras if you want                                        |
| `typescript.ignoreBuildErrors` / `eslint.ignoreDuringBuilds`          | Ships uncompiled types and unlinted boundaries; the second key is also removed in Next 16                       | Fix the error; the gate is the product                                         |
| `--no-verify` on commit or push                                       | The gate you skip is the one that would have caught it                                                          | Fix the hook failure, or fix the hook                                          |
| `next build` treated as the lint step                                 | v16's build does not run ESLint at all — you are shipping unlinted code and believing otherwise                  | `npm run lint` as its own gate step                                            |
| Leaving `--turbopack` in v16 scripts                                  | It is the default; the flag is noise and a stale webpack config now fails the build without an explicit choice  | Remove it; use `--webpack` only to deliberately opt out                        |
| `FlatCompat` around a package that already exports a flat array       | Double-wraps the config and throws with an opaque error at startup                                              | Spread it: `...next`                                                           |
| `ignores` combined with other keys in one config object               | It silently becomes a scoped override and ignores nothing globally                                              | Global `ignores` alone in the first object                                     |
| A boundary zone listing only its new restriction                      | Flat config replaces `no-restricted-imports` options per file — inherited restrictions vanish                    | Each zone declares its complete pattern set                                    |
| `/* eslint-disable */` at the top of a file                           | Disables every rule forever, including rules added years later                                                  | `eslint-disable-next-line <rule>` + a comment saying why it is a false positive |
| `any` (or `as unknown as T`) to move past a type error                | Turns off checking transitively for everything downstream; the runtime shape never changed                       | `unknown` + a type guard, or parse with a schema                               |
| Warnings left in the lint output                                      | Errors hide inside the noise, and nobody reads a 200-line report                                                | Every rule is `error` or `off`; CI runs `--max-warnings 0`                     |
| Class-sorting plugin listed before another Prettier plugin, or formatting rules in ESLint | The later plugin overrides the printer and sorting silently stops; `--fix` and `--write` fight on every save | Class sorter last in `plugins`; Prettier owns formatting, ESLint owns correctness |
| `npm install` in CI, or CI steps that differ from the local gate      | CI tests a dependency tree nobody has; "works locally" and "passes CI" diverge until the team ignores CI        | `npm ci`; same commands, same order, same env                                  |
| Running `typecheck` before generating route types on a clean checkout | Generated `PageProps`/`LayoutProps` do not exist yet; `tsc` reports confident nonsense                          | `typegen` first, and include the generated dirs in `tsconfig`                   |
| Setting `NEXT_PUBLIC_*` on a running container, or reading one via `process.env[key]` | Public vars are inlined at build by static text substitution — the running app cannot see a change, and dynamic access yields `undefined` | Pass them as build `ARG`s; reference each literally in the env module          |
| One `API_URL` for both browser and server-side fetches in compose     | The browser resolves `localhost`, the container resolves the service name — one side always breaks              | Separate public and internal URLs                                              |
| Standalone image without `.next/static` and `public` copied           | App boots and serves HTML with no CSS, JS chunks, or images                                                     | Copy both explicitly in the runner stage                                       |
| Container running as root                                             | Any RCE becomes host-adjacent access                                                                             | Create a system user; `USER` before `CMD`                                      |
| Healthcheck that only checks the port                                 | Reports a crashed render loop as healthy, so the orchestrator never restarts it                                 | Hit a real health route and assert a 2xx                                       |
| A `.env` variable that exists only on one laptop                      | It becomes a production outage the first time that person is unavailable                                        | Add it to `.env.example`, documented, in the same commit                        |
| `localhost` defaults for production-critical env vars, or a real secret in `.env.example` | A missing var silently points production at localhost instead of failing loudly; a committed secret lives in git history forever | No default — throw at import time; empty value + how to obtain it              |
| A 300-line project agent-instructions file                            | It duplicates the architecture skill, drifts from it, and gets skimmed instead of read                          | Stack line, gate, pointers, bans — under ~40 lines                             |
