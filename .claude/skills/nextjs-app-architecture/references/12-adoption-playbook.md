# Adopting the architecture: greenfield bootstrap and brownfield migration

**Read this when:** you are starting a project, bringing an existing one into this architecture, or
scoring a repo against it. **This is the action document — start here, not in a topic guide.**

**Jump table.** Only one part applies to you; skip the other two entirely.

| You are…                                                            | Go to                                                    |
| -------------------------------------------------------------------- | -------------------------------------------------------- |
| Bootstrapping a new app (empty dir or bare `create-next-app`)        | **Part A**, steps A1 → A20 — search `# Part A`           |
| Migrating an existing App Router app                                 | **Part B**, phases P0 → P8 — search `# Part B`           |
| Auditing a repo before deciding                                      | **Part C** — search `# Part C`                            |
| Adding one module to a project already in this architecture          | **A20** only — search `### A20`                           |
| About to make an adoption-order decision you are unsure about        | the **Anti-patterns** table — search `## Anti-patterns`   |

Read the anti-patterns table before Part A, not after. Most of its rows are ordering mistakes —
cheap to avoid at step A3, and a project to unwind by step A20.

Part A stands up a new project step by ordered step. Part B moves an existing Next.js app into it
without a stop-the-world rewrite. Part C is an objective yes/no audit you can run against any repo.
> **Versions.** Every step leads with the **Next.js 16** form; the 15.x equivalent is given inline
> wherever they differ. Zod examples are **zod 4** (see `references/05-contracts-and-schemas.md`
> for the zod 3 spellings). The target throughout is the App Router with React 19 and TypeScript
> strict.

## Invariants

- **Install the gates before writing product code.** A project that cannot fail a build cannot be
  refactored safely; every later step is measured by the gate, so the gate comes first.
- **Turn on boundary lint before the first module exists.** Retrofitting `no-restricted-imports`
  zones onto a grown codebase costs roughly ten times what declaring them empty costs — the
  violations are already load-bearing by then.
- **One phase, one commit, one gate.** `npm run typecheck && npm run lint && npm run build &&
  npm run test` must pass before the phase is done. A phase that cannot be reverted with one
  `git revert` was too big.
- **Never suppress the build.** `typescript.ignoreBuildErrors`, `eslint.ignoreDuringBuilds`,
  `--no-verify`, blanket `eslint-disable`, and `.skip`-ed tests are banned. They do not remove the
  errors; they remove your ability to see them.
- **Behavior freeze during structural phases.** Moving files, adding barrels, and adding lint
  zones must not change a single pixel. Mixing a refactor with a feature makes the bisect useless
  when something breaks.
- **Migrate vertically, one module at a time, not horizontally, one concern at a time.** A module
  that is fully migrated is shippable; a half-migrated concern across twelve modules is not.
- **The build is honest before anything else.** In a brownfield repo, remove suppression flags and
  fix what they were hiding in phase 0 — until then no audit result and no gate means anything.
- **Every deviation is recorded, never silently accepted.** A deliberately-disabled option is a
  comment naming its symptom and its re-enable condition; a skipped checklist item is a line in
  the report.
- **Delete on arrival.** When the new path lands, delete the old one in the same phase. Two data
  layers coexisting is the worst state a codebase can be in.
- **Templates are copied, then owned.** Every `// TODO(project):` marker in a copied template is a
  decision you must make before the phase gate; leaving them is how a template becomes cargo cult.

---

## 0. Choosing your entry point

| Situation                                                            | Go to                       |
| -------------------------------------------------------------------- | --------------------------- |
| Empty directory, or a repo with nothing but `create-next-app` output  | **Part A**, steps A1→A20    |
| Existing Next.js App Router app to be brought into this architecture  | **Part B**, phases P0→P8    |
| Existing app, need a conformance score / gap list before deciding     | **Part C**, then Part B     |
| Adding one module to a project already in this architecture           | **A20** only                |

The gate referenced throughout:

```bash
npm run typecheck && npm run lint && npm run build && npm run test
```

Before the app has any routes, `build` is not yet meaningful — use the **partial gate**
(`npm run typecheck && npm run lint`) and say so in the commit body.

---

# Part A — Greenfield bootstrap

**Why this order.** Tooling and boundary lint precede the first module because a boundary declared
against zero files is free and a boundary declared against 200 files is a project. The error system
precedes the transport ring because `api-client` and every action normalize through it. Env config
precedes transport because transport reads a validated base URL, never a literal. The app shell
precedes the first module because a module needs a route to prove it. The first feature module is
last, and it is the acceptance test for everything above it.

Every step below lists **Do**, **Template** (a file under `templates/` to copy, where one exists),
**Acceptance** (an objective check), and **Gate**.

**The two template indexes are part of this playbook.** `templates/config/README.md` gives every
config file's target path, whether it is required or a real choice, and which files are coupled
pairs that break if you adopt one without the other. `templates/src/README.md` gives the runtime
files' **copy order by dependency tier** and the three fenced blocks (query devtools, mock
front-db, fixture fallback) that are the only places a copied file will not compile as-is. Read
both once before A1; consult the src index whenever a step copies more than one runtime file.
Steps A1–A20 below are a complete manifest of `templates/` — if a template is not cited by a step,
that is a defect in this guide, not an optional file.

---

### A1 — Scaffold and install

**Do** — every flag below is passed explicitly, including `--yes`. Without them `create-next-app`
prompts interactively and a headless agent hangs forever on a question nobody answers.

```bash
npx create-next-app@latest <app> --ts --app --src-dir --eslint --tailwind \
    --import-alias "@/*" --no-turbopack --yes
cd <app>
```

Drop `--no-turbopack` on 15.x. On 16 Turbopack is the default for dev **and** build, so also remove
any `--turbopack` flag the scaffolder left in the `dev`/`build` scripts — it is noise there.

Then install. The lists are exhaustive for the templates this playbook copies; a missing package
does not fail here, it fails three steps later inside someone else's config.

```bash
# runtime
npm i zod@^4 @tanstack/react-query zustand clsx tailwind-merge class-variance-authority \
      server-only react-hook-form @hookform/resolvers radix-ui

# tooling + tests + workshop
npm i -D prettier prettier-plugin-tailwindcss @tanstack/react-query-devtools \
      vitest jsdom @vitejs/plugin-react @testing-library/react @testing-library/jest-dom \
      @testing-library/user-event jest-axe @types/jest-axe msw \
      husky lint-staged @commitlint/cli @commitlint/config-conventional \
      eslint-plugin-storybook storybook @storybook/nextjs @storybook/addon-docs \
      @storybook/addon-a11y
```

Why each of the easy-to-miss ones, since each is a later step failing at *its* gate:

| Package                            | Needed by                                                     |
| ---------------------------------- | ------------------------------------------------------------- |
| `zod@^4` (pinned major)            | `z.url()` / `z.flattenError` across every template            |
| `react-hook-form`, `@hookform/resolvers` | the `form/` tier (A12b) and every tier-2 form          |
| `radix-ui`                         | `ui/button.tsx`'s `Slot.Root` (A12) — the `asChild` mechanism |
| `prettier-plugin-tailwindcss`      | `.prettierrc` (A3) — `npm run format` throws without it       |
| `@tanstack/react-query-devtools`   | `providers.tsx` (A13) — resolved at BUILD time, not just dev  |
| `eslint-plugin-storybook`          | `eslint.config.mjs` (A3) — `npm run lint` cannot load without |
| `storybook` + framework + addons   | the `build-storybook` gate step in CI (A18)                   |

`--tailwind` also installs `tailwindcss` and `@tailwindcss/postcss`, which A2b's token layer needs;
if you scaffolded without it, add them by hand.

**Browser-test tooling is deliberately absent.** A browser runner is an opt-in decision with its
own CI cost, not part of the bootstrap — install it only when a flow meets the criteria in
`references/09-mocking-and-testing.md` §9.7. Its absence is not an audit finding.

**If you are not using Tailwind or a component workshop**, drop the marked packages **and** the
matching blocks in `.prettierrc`, `eslint.config.mjs` and the script set — every template marks
its optional block with a delete-me comment.

**A1b — paste the canonical script set now.** Merge the `scripts` and `lint-staged` blocks from
`templates/config/package.scripts.json` into `package.json` (strip its comments — `package.json` is
strict JSON). Several of these fail until their tooling lands in A3–A15; that is expected, and it
is exactly why A1–A15 use the partial gate. The names are fixed across every project in this
architecture: an agent that lands in an unfamiliar repo must be able to type `npm run typecheck`
without reading `package.json` first. Add aliases if you want extra verbs; never repurpose a
canonical name.

**Acceptance** — `npm run dev` serves a page; `src/app/layout.tsx` and `src/app/page.tsx` exist;
`npm run typecheck` runs (it is now a real script). Delete any generated example page you will not
keep — dead scaffolding is read by agents as intent.

**Gate** — partial gate (`npm run typecheck && npm run lint`; `lint` still runs the scaffolder's
default config until A3 replaces it).

---

### A2 — TypeScript config and the `@/` alias

**Do** — copy the template whole. The entire architecture is written against `@/*` → `src/*`, and
the boundary lint patterns (`@/modules/**`, `@/common/**`) are literal strings matched against the
specifier text, so the alias is not negotiable.

**Template** — `templates/config/tsconfig.json` → `<repo-root>/tsconfig.json`

Do not hand-assemble a shorter version. Two `include` entries in particular are easy to drop and
expensive to miss: **`.next/types/**/*.ts` AND `.next/dev/types/**/*.ts`**. On Next.js 16 `next
build` and `next dev` write generated route types to different roots, so shipping only one silently
degrades every typed `params`/`searchParams` signature in whichever mode is not covered — and
pushes people back to hand-written param types that drift. Including a directory that does not
exist is harmless. (On 15.x only `.next/types/**` exists; ship both entries anyway.)

**Acceptance** — `npm run typecheck` exits 0; `grep -n '"@/\*"' tsconfig.json` shows the mapping to
`./src/*`; both `.next/types/**/*.ts` and `.next/dev/types/**/*.ts` appear in `include`. (Do not
try to prove the alias by importing `@/common/lib/utils` — that file does not exist until A3.)

**Gate** — partial gate.

---

### A2b — Framework config and the Tailwind token layer

**Do** — the design system in A12 consumes tokens (`h-control`, `rounded-control`) that must exist
first, and `.prettierrc` in A3 points at the CSS file that declares them.

**Template** — `templates/config/next.config.ts` → `<repo-root>/next.config.ts`

Create alongside it, from `references/02-design-system.md` §0 (no templates ship for these three —
they are project-specific by nature): `postcss.config.mjs`, `components.json`, and
`src/app/globals.css` with `@import 'tailwindcss'`, `@custom-variant dark`, the `@theme` token
scale, and the `@source inline(...)` declarations.

Three things in `next.config.ts` that are decisions, not defaults: `output: 'standalone'` (required
by the container template in A18), `images.remotePatterns` derived from env rather than hardcoded
(a hardcoded host means staging and production need different config files), and **`reactCompiler`
left off**, with the reason in a comment — it memoizes reads of react-hook-form's `formState`
Proxy, so submit buttons never enable (`references/07-forms.md` §9). A silently-omitted option
looks like an oversight and gets "fixed" by the next agent.

**Acceptance** — `npm run build` succeeds and `.next/static/css/` contains one of your
`@source inline(...)` classes.

**Gate** — partial gate.

---

### A3 — Prettier and the ESLint boundary enforcer, with an **empty** `MODULES` array

**Do** — this is the single most important ordering decision in Part A. Install the boundary
enforcer now, with `const MODULES = []`. Adding a module later is a one-word edit; adding the
enforcer later is an archaeology project, because by then every violation is load-bearing.

**Template** — `templates/config/eslint.config.mjs` → `<repo-root>/eslint.config.mjs`,
`templates/config/.prettierrc` → `<repo-root>/.prettierrc`

The ESLint template is the **single canonical copy** in this skill — no guide restates it. Three
edits on arrival:

1. **Set `MODULES` to `[]`.** The template ships sample names; an empty array is correct for a new
   project. A module added without an entry here has no boundary rules at all and lint stays green
   forever, so "add the name to `MODULES`" is step 1 of creating a module, before the folder exists.
2. **Delete the `jsx-a11y/alt-text` override block.** It is scoped to a path your project does not
   have; it is there as the *shape* of a legitimate override (files / rule / why it is wrong
   **here**), not as a rule for your app.
3. **Delete the optional blocks you are not using** — the `eslint-plugin-storybook` import and
   spread if there is no workshop, `NO_MOCKS` plus Zone E if there is no mock layer. Both are
   marked in the file.

The trap the file exists to survive: flat config **replaces** a rule's options per matched file
instead of merging them, so every zone declares its complete pattern set. Zone table and the full
reasoning: `references/01-layering-and-boundaries.md` §7.

**Acceptance** — `npm run lint` exits 0 and `npm run format:check` runs without throwing. Then
prove the enforcer is live:

```bash
mkdir -p src/common/lib          # you need this folder at A12 anyway
printf "import nope from '@/modules/nope';\nexport const probe = nope;\n" > src/common/lib/boundary-probe.ts
npm run lint                     # must ERROR with your teaching message, not a parse error
rm src/common/lib/boundary-probe.ts
```

A parse error instead of a boundary error means you typed the import wrong, not that the rule
fired. Delete the probe before the gate — `tsc` will fail on the unresolved module, which is a
different signal.

**Gate** — partial gate. See also `references/11-tooling-and-gates.md` §§4–5.

---

### A4 — Husky, commitlint, lint-staged

**Do** — `npx husky init`, then write the three hooks. `pre-push` runs the real gate; `pre-commit`
runs only `lint-staged` so committing stays fast enough that people don't reach for `--no-verify`.

**Template** — `templates/config/husky-pre-commit.sh`, `templates/config/husky-commit-msg.sh`,
`templates/config/husky-pre-push.sh`, `templates/config/commitlint.config.ts`

```bash
# .husky/pre-commit
npx lint-staged
# .husky/commit-msg
npx --no-install commitlint --edit "$1"
# .husky/pre-push
npm run typecheck && npm run lint && npm run test
```

**Acceptance** — a commit with the message `bad message` is rejected; `chore(setup): add hooks` is
accepted.

**Gate** — partial gate.

---

### A5 — The `src/` skeleton

**Do** — create the folders you will actually use in the next two steps, not all of them. Empty
directories are noise; the tree below is the vocabulary, and you `mkdir` from it on demand.

```bash
mkdir -p src/app src/modules \
  src/common/{components/{ui,ds,form,variants,layout,feedback,loader},services,schemas,actions,api,stores,hooks,lib,utils,config,constants,types,errors,observability,validators,icons/{outline,solid,brand},stories} \
  src/mocks/{db,handlers} src/test
```

Layer contract, enforced by A3 and repeated here because every later step depends on it:

| Layer        | Contains                                                        | May import        |
| ------------ | --------------------------------------------------------------- | ----------------- |
| `src/app`    | routing + composition only: params, page-level fetch, metadata   | modules, common   |
| `src/modules`| one folder per vertical feature; `index.ts` is its whole API     | own module, common|
| `src/common` | shared, domain-agnostic infrastructure and design system         | common only       |

**Acceptance** — `ls src` shows exactly `app modules common mocks test` plus root files.

**Gate** — partial gate. Full tree and per-folder purpose: `references/01-layering-and-boundaries.md` §2.

---

### A6 — The error system

**Do** — write it before anything can throw. Every layer above converges on one normalized shape,
so the shape must exist first.

**Template** — `templates/src/common/errors/types.ts`, `parse-body.ts`, `messages.ts`,
`map-error.ts`, `index.ts`

Exports you get: `NormalizedError`, `FieldErrors`, `ErrorOverrides`, `parseBody`, `ParsedBody`,
`DEFAULT_BY_STATUS`, `DEFAULT_BY_CODE`, `GENERIC_MESSAGE`, `mapError`, `errorMessage`,
`fieldErrors` — all re-exported from `@/common/errors`.

```ts
// The one shape the UI ever sees.
export interface NormalizedError {
  status: number;                 // 0 = never reached the backend
  code: string | null;            // stable machine-readable discriminator; null, never absent
  message: string;                // never empty — the chain ends in a constant
  fieldErrors: FieldErrors;       // { [field]: message }
}
```

`code` is `string | null` rather than optional on purpose: every consumer branches on it, and a
field that is sometimes-absent and sometimes-null produces two different falsy checks across the
app.

Why first, concretely: without it every call site invents its own
`err.response?.data?.detail ?? err.body?.errors?.[0]` guess, and each guess rots independently the
first time the backend changes an error body.

**Acceptance** — `npm run typecheck` is clean and everything outside the folder can reach these
symbols through `@/common/errors` alone (`grep -rn "common/errors/" src` finds no deep import).
Read `map-error.ts` and confirm the precedence chain ends in an unconditional constant. Assert the
behaviour at A15: `mapError(new Error('boom')).message` is non-empty and is **not** `'boom'` — at
`status === 0` the "body" is an internal JS message and is never trusted as user-facing copy.

**Gate** — partial gate. See `references/06-error-system.md`.

---

### A7 — Environment config

**Do** — copy both templates. Do not hand-write a shorter schema; the two rules below are the whole
value of the file and both are easy to lose in a retype.

**Template** — `templates/src/common/config/env.ts` → `src/common/config/env.ts`,
`templates/src/common/constants/api.ts` → `src/common/constants/api.ts`,
`templates/config/env.example` → `<repo-root>/.env.example`

1. **Static property access, one key spelled out at a time.** The bundler does a *textual*
   replacement of `process.env.NEXT_PUBLIC_X`; it cannot see through `process.env[key]` or a loop
   over the schema's keys. Such code compiles, passes review, and yields `undefined` for every
   public variable in the browser. Adding a variable means editing the file in two places.
2. **Never give a production-critical URL a local default.** A `localhost` default turns a missing
   variable into a silent misconfiguration: the app boots and every request goes to a machine that
   does not exist in production. No default means it throws at import — in CI, with the offending
   keys named.
3. **Server secrets live in a second schema**, in their own module behind `import 'server-only'`,
   and never carry a `NEXT_PUBLIC_` prefix.

`constants/api.ts` strips trailing slashes from `API_URL`, which is why every service path can
start with `/` without producing `//` URLs. It also exports `SITE_URL`, `MEDIA_URL` and a
`mediaUrl()` normalizer that `next.config.ts` (A2b) and the metadata in A16 depend on.

**Acceptance** — `cp templates/config/env.example .env.local`, fill it, and confirm
`npm run typecheck` is clean; `grep -rn "process.env\[" src` returns nothing (no dynamic key
access); every key in `.env.example` carries a comment, and none of them has a fallback value in
code.

**The fail-fast proof is deferred to A8**, and this is not laziness: nothing imports `env.ts` yet,
so the bundler drops it and the schema never evaluates. Once `api-client` pulls in
`constants/api.ts` → `env.ts`, delete `NEXT_PUBLIC_API_URL` from `.env.local` and confirm
`npm run build` fails **with your message naming the key**. Restore it. A missing variable that
does not stop a build is the whole failure this file exists to prevent.

**Gate** — partial gate. See `references/03-server-data-layer.md` §5.

---

### A8 — The transport ring: `http` → `api-client` → services

**Do** — three rings, each importing only the one below.

**Template** — `templates/src/common/services/http-types.ts`, `http.ts`, `api-client.ts`

| File                             | Job                                                            | Must never                              |
| -------------------------------- | -------------------------------------------------------------- | --------------------------------------- |
| `common/services/http-types.ts`  | `RequestOptions`, `HttpError`                                   | —                                       |
| `common/services/http.ts`        | timeout, retry, signal merge, body parsing, throw `HttpError`   | know about auth, base URLs, `server-only`|
| `common/services/api-client.ts`  | base URL + bearer + **the one** `schema.parse` + 401 retry      | be imported from a client component     |
| `common/services/<r>-service.ts` | one module per backend resource; path + schema + method         | contain React, `'use server'`, or logic |

`http.ts` deliberately stays runtime-agnostic (no `server-only`, no framework imports) so it is
unit-testable and reusable anywhere `fetch` exists. Everything above it starts with
`import 'server-only'` so a stray client import fails the **build**, not production.

**Acceptance** — `grep -rL "^import 'server-only'" src/common/services/*.ts` (match the *import
line*, not the word — several templates name `server-only` in a header comment explaining why they
do **not** import it). At **this** step it lists `http.ts` and `http-types.ts`; the **steady
state**, once A9 and A11 have landed, is exactly four —
`http.ts`, `http-types.ts`, `jwt.ts`, `action-result.ts`. Those four are deliberately
runtime-agnostic (`jwt.ts` must run at the edge; `action-result.ts`'s `unwrap` runs in the
browser). Every file that constructs an authenticated request or reads a cookie must appear in the
**complement** — a fifth name in the `-L` output is the defect. (Same check as audit item DATA-03.)
A deliberate client import of `api-client` fails `npm run build`.

**Gate** — partial gate. See `references/03-server-data-layer.md` §§1–4.

---

### A9 — The session ring

**Do** — one module owns auth cookies. Nothing else reads or writes them.

**Template** — `templates/src/common/services/session.ts`, `templates/src/common/services/jwt.ts`

Exports: `readSession`, `writeSession`, `clearSession`, `rotateSession`, **`refreshAccess`**,
`sessionCookieOptions`, `isSecureRequest`, `accessCookieMaxAge`, `refreshCookieMaxAge`,
`ACCESS_COOKIE`, `REFRESH_COOKIE`, `SESSION_COOKIE_BASE`, `Session`, `TokenPair`,
`RotationOutcome`; plus `getTokenExpiry`, `isTokenExpired` from `jwt.ts`.

`refreshAccess` is not optional: `api-client.ts` (A8) imports it for the in-render 401 retry. Its
contract is "`rotateSession` for callers that only need a usable pair or `null`" — and it does
**not** persist cookies, which is exactly what makes it legal mid-render, where cookie writes
silently do nothing.

Four rules that are each a production incident in compressed form:

1. **`rotateSession` returns a three-state verdict** — `rotated | rejected | unavailable`. Only
   `rejected` may clear cookies. Conflating "backend unreachable" with "refresh token invalid"
   turns any backend blip into a mass logout.
2. **Rotation is single-flighted per refresh token.** With single-use refresh tokens, a concurrent
   fan-out (navigation + RSC payload + prefetches) burns the token and signs the user out.
3. **`secure` comes from the actual request** (`isSecureRequest`), never from `NODE_ENV`. A browser
   silently discards a `Secure` cookie delivered over plain http — the user appears signed in,
   then every request 401s.
4. **`maxAge` comes from the token's own `exp`**, not a guessed constant, so the cookie and the
   token expire together.

**Acceptance** — `grep -rn "cookies()" src --include=*.ts --include=*.tsx` returns hits only in
`session.ts` and route handlers. `proxy.ts` must **not** appear: at the edge it uses
`request.cookies` / `response.cookies`, which is the correct API there.

**Gate** — partial gate. See `references/03-server-data-layer.md` §6.

---

### A10 — Schema conventions

**Do** — establish the two shared schema modules and the naming rules before any resource schema
exists, so the first one is written correctly.

**Template** — `templates/src/common/schemas/envelopes.ts`, `templates/src/common/schemas/helpers.ts`

- `envelopes.ts` → `paginated`, `successEnvelope`, `errorEnvelopeSchema`, `messageEnvelopeSchema`,
  `fieldErrorsSchema`
- `helpers.ts` → `nullToUndefined`, `emptyToNull`, `numberFromString`, `isoDate`, `tolerantEnum`,
  `looseString`, `looseNumber`, `looseBool`, `looseDecimal`

Rules to write into the project's agent file now, because they are cheap to follow and expensive
to retrofit:

- One schema module per resource, mirroring the services layer (`schemas/invoice.ts` ↔
  `services/invoice-service.ts`).
- **Derive every wire type with `z.infer`.** Never hand-write an interface mirroring a schema —
  two declarations of one shape drift within a sprint and the compiler cannot say which one lies.
- **Read schemas are tolerant at the leaves, strict at the shape; write schemas are exact.** One
  unanticipated `null` in one leaf otherwise throws in the service and blanks the whole route.
- A schema module imports only `zod`, other schema modules, and pure validators — never a
  component, hook, service, or `server-only`. Form schemas are imported by client components; one
  `server-only` in that graph breaks the client build.

**Acceptance** — `grep -rn "server-only" src/common/schemas` returns nothing.

**Gate** — partial gate. See `references/05-contracts-and-schemas.md`.

---

### A11 — The action contract

**Do** — write `action-result.ts` before the first action, so no action hand-rolls its own
try/catch shape.

**Template** — `templates/src/common/services/action-result.ts`

Exports: `ActionResult<T>`, `ActionError`, `unwrap`, `toActionResult`.

Append the form-facing half from `references/04-actions-and-mutations.md` §1 —
`ActionState<T>`, `zodFieldErrors`, `toActionState` — when you write the first tier-1 form (A20 /
P3). Keeping them in this one file is what stops each action from hand-rolling its own guess at the
backend's error envelope.

The rule this encodes: **a write Server Action returns a discriminated result; it never throws for
an expected failure.** Thrown errors are sanitized crossing the RPC boundary, destroying the status
code and response body that optimistic rollback and field-error binding need.

**Acceptance** — `npm run typecheck` is clean, and `ActionResult` is a **discriminated** union on
`ok` (narrowing on `result.ok` gives you `T` with no cast). There is no test runner until A15, so
write this as the first spec you run there — it is the contract in two lines:

```ts
await expect(toActionResult(async () => { throw new Error('x'); }))
  .resolves.toEqual({ ok: false, status: 0, body: 'x' });
```

`status: 0` means "never reached the backend", which is why the body is the JS message and why no
UI may render it (A6).

**Gate** — partial gate. See `references/04-actions-and-mutations.md` §1.

---

### A12 — The component tiers, the first control, and the workshop

**Do** — create `cn()`, the shared variant tokens, and exactly **one** control through all four
files. One is enough to prove the pipeline; ten before you have a screen is speculative design.

**Template** — `templates/src/common/lib/utils.ts` → `src/common/lib/utils.ts` (`cn`).
The four control files have no template — copy them verbatim from
`references/02-design-system.md` §4 "One control, end to end", which ships `variants/button.ts`,
`ui/button.tsx`, `ds/Button.tsx` and `ds/Button.test.tsx` complete.

```
common/components/
├── ui/        lowercase filenames, Base* exports, generated/vendored, PRIVATE to ds+form
├── ds/        PascalCase, your public API, displayName set, one control per file
├── form/      form-bound wrappers over ds/ (field context, label/error wiring)
└── variants/  cva definitions + _shared.ts cross-control tokens
```

Order for the first control: `variants/button.ts` → `ui/button.tsx` → `ds/Button.tsx` →
`ds/Button.stories.tsx` → `ds/Button.test.tsx` (jest-axe). Populate `ui/` either by running a
component generator pointed at it by the `components.json` from A2b, or by hand-writing primitives
there — either way nothing outside `ds/` and `form/` may import it, and a regeneration must never
touch `ds/`.

Hard rules: **style lives in `variants/*.ts`, never inline in a `ds/` body**; every class list
terminates in `cn()` with caller overrides merged last; every custom token utility is registered in
`cn()`'s `classGroups` or the merge silently stops resolving conflicts; product code imports `ds/`
and `form/`, never `ui/` (already lint-enforced in A3).

**Then install the workshop**, because A18's CI template runs `build-storybook` as a gate step and
it will fail on a repo that has none:

**Template** — `templates/config/storybook-main.ts` → `.storybook/main.ts`,
`templates/config/storybook-preview.tsx` → `.storybook/preview.tsx`

`preview.tsx` imports `src/app/globals.css` (created in A2b) and sets
`parameters: { a11y: { test: 'error' } }`, which makes an axe violation **fail** a story rather than
annotate a panel nobody opens in CI.

**Acceptance** — `npm run build-storybook` succeeds; `npm run typecheck` covers all four control
files; importing `@/common/components/ui/button` from `src/app` fails lint. `Button.test.tsx` is
**written now and first executed at A15** — vitest does not exist yet, so `npm run test` here is
either the scaffolder's placeholder or a no-op. A15's acceptance is where the axe test must
actually go green.

**Gate** — partial gate. See `references/02-design-system.md`.

---

### A12b — Form tier plumbing

**Do** — create the two client-side helpers every form depends on, so A20 and every later form are
copy steps rather than inventions.

Neither ships as a template:

- `src/common/hooks/applyFieldErrors.ts` — copy from `references/06-error-system.md` §4.1. It binds
  backend field errors onto the matching inputs and routes anything the form does not render to a
  fallback, so a backend field the UI has no input for cannot produce an error nobody can see or
  clear. `references/07-forms.md` imports it from exactly this path in three places.
- `src/common/components/form/{Form.tsx,FormInput.tsx,FormButton.tsx}` — copy from
  `references/02-design-system.md` §5. `FormItem` generates one id that label, control and message
  all share, which is what makes the accessibility wiring exist on every field without a per-form
  checklist.

**Acceptance** — `npm run typecheck` is clean, and a throwaway `FormInput` story in the workshop
(A12) renders with its label, error message and control **sharing one generated id** — inspect the
DOM for `aria-describedby` pointing at the message node. There is no route to submit into until
A16; the end-to-end "submit binds a backend field error to the right input" proof is A20 / P3.

**Gate** — partial gate. See `references/07-forms.md`.

---

### A13 — Providers, query client, query keys, dev logging

**Do**

**Template** — `templates/src/common/lib/query-client.ts`, `templates/src/common/api/query-keys.ts`,
`templates/src/common/observability/dev-log.ts`, `templates/src/common/stores/session-store.ts`,
`templates/src/common/lib/mock-ready.ts`, `templates/src/app/providers.tsx`

Copy in the order listed — it is the dependency order from `templates/src/README.md`, and
`providers.tsx` is the last file because it wires the other four.

`providers.tsx` has two fenced optional blocks and **both are compile-time decisions you make
now**, not later: the query-devtools block (keep it — the package is already installed, and it
resolves at build time even though the chunk only loads in dev) and the mock block, which imports
`isMockEnabled` from `@/common/config/env` and `MockReadyContext` from
`@/common/lib/mock-ready`. Copy `mock-ready.ts` **here**, with `providers.tsx`, if you intend to
build the mock front-db at A14 — otherwise delete the fenced block and its two imports, and skip
A14. Leaving the block with the file absent fails this step's own typecheck.

`providers.tsx` also imports `useSessionBootstrap` from the session store, so the store is copied in
**this** step, not later. The session store is the client mirror of the httpOnly cookie: it holds
no token and no server data, and `useSessionBootstrap` is mounted exactly once, by `providers.tsx`.
Resolve its `configureSessionBridge` TODO in A20 or when the first auth flow lands — until then
`reconcile()` reports "still signed in" unconditionally, which is the safe default but not the
finished one. See `references/08-state-and-data-flow.md` §6.2 and §7.1.

- `getQueryClient()` is the accessor **every** caller uses, including server prefetch: a fresh
  client per request on the server and a stable singleton in the browser. Creating it in `useState`
  is wrong — it does not survive a suspending provider, and the second render discards the cache
  the first one filled.
- Defaults: a non-zero `staleTime` (otherwise every mount refetches), and a retry policy that does
  **not** retry 4xx — retrying a 422 three times just delays the error by a second.
- `queryKeys` is one exported, hierarchical, `as const` factory for the whole app. Ad-hoc key
  strings collide across modules and silently cross-invalidate.
- `devLog` / `devError` / `logQueryError` / `logMutationError` are guarded by a single `NODE_ENV`
  constant so they are dead code in production. Backend bodies must never reach a production
  console.

**Acceptance** — `npm run typecheck` is clean with every fenced block resolved (this is the real
check at this step: nothing mounts `<Providers>` until A16). `grep -rn "new QueryClient" src` hits
only `common/lib/query-client.ts`, and `grep -rn "queryKey: \['" src` returns nothing. **Defer the
runtime proof to A16**: once the root layout mounts `<Providers>`, devtools must render in dev and
be absent from the production bundle (`npm run build` emits no devtools chunk).

**Gate** — partial gate. See `references/08-state-and-data-flow.md`.

---

### A14 — The mock front-db

**Do** — a request-mocking layer backed by a real in-memory store with a deterministic seed, so the
frontend is buildable and demoable before the backend exists and every developer sees the same data.

**Template** — `templates/src/instrumentation.ts` → `src/instrumentation.ts`,
`templates/src/common/services/pending-backend.ts` → `src/common/services/pending-backend.ts`
(optional; see the two-flags note below). `templates/src/common/lib/mock-ready.ts` was already
copied at A13 with `providers.tsx`.

**Everything under `src/mocks/` has no template.** `instrumentation.ts` ships with its
`server.listen()` block commented out precisely because it cannot compile until `src/mocks/`
exists. Write the six files from `references/09-mocking-and-testing.md` §§2–5, **in this order**,
then uncomment that block:

```
src/mocks/
├── db/{store.ts,seed.ts}     in-memory entities + id generation + relations
├── handlers/{_shared.ts,<resource>.ts,index.ts}
├── browser.ts                setupWorker
├── node.ts                   setupServer
└── init.ts                   client-side boot + readiness signal
```

Then generate the browser worker script and commit it:

```bash
npx msw init public/
```

This is **mandatory, not optional**: without the worker script, every browser request silently
reaches the real network instead of the mock, so the browser and the server disagree about what the
data is. Re-run it after every interceptor upgrade, and add `public/mockServiceWorker.js` to the
lint `ignores` (already in the A3 template).

Both runtimes must be wired, because the data layer fetches on the **server** too. Without the
Node-side server, the browser shows mocked data and server-rendered HTML shows real (or missing)
data — the page hydrates into a different screen than it painted, which is every "works in the
browser, empty on refresh" report.

**Note the two distinct flags.** `NEXT_PUBLIC_API_MOCKING` gates this request-mocking layer;
`NEXT_PUBLIC_PENDING_API_MOCKS` gates the per-endpoint fixture fallback in
`common/services/pending-backend.ts` (`references/03-server-data-layer.md` §7). They are different
mechanisms and must not be collapsed into one variable — the first intercepts a whole runtime, the
second serves a fixture for one endpoint that does not exist yet. Add `NEXT_PUBLIC_API_MOCKING` to
`.env.example` and, if you want it validated, to the env schema from A7.

**Acceptance** — structural at this step, because there is still no route to render (the shell
lands at A16 and the first screen at A20):

1. `npm run typecheck` is clean with the `server.listen()` block uncommented.
2. `public/mockServiceWorker.js` exists and is committed.
3. Both runtimes are wired: `grep -n "@/mocks/node" src/instrumentation.ts` hits inside the flag
   guard, and `src/mocks/browser.ts` exports a `setupWorker` instance.
4. A throwaway node script (or the first service test at A15) hitting one handler returns seeded
   data with the backend down.

**The end-to-end proof is A20 acceptance check 3** — with `NEXT_PUBLIC_API_MOCKING=enabled` and no
backend running, the first module's page renders real data server-side (view-source shows it, not
an empty shell) and the browser network tab shows requests served by the worker. Come back and
fix this step if that check fails.

**Gate** — partial gate. See `references/09-mocking-and-testing.md`.

---

### A15 — The test harness

**Do**

**Template** — `templates/config/vitest.config.ts`, `templates/config/test-setup.ts`,
`templates/config/test-empty-module.ts`

Two non-obvious settings, both of which cost an afternoon to rediscover:

- Alias `server-only` to an empty module in the test config. Otherwise `server-only` throws outside
  an RSC bundle and no service or action can be unit-tested at all.
- Polyfill `matchMedia`, `ResizeObserver`, and `IntersectionObserver` in the setup file. jsdom ships
  none of them and every component library uses at least one.

Also in setup: `@testing-library/jest-dom`, the axe matcher, mock-server lifecycle
(`beforeAll listen` / `afterEach resetHandlers` / `afterAll close`), and `clearMocks` +
`restoreMocks` so tests cannot leak into each other.

**If you skipped A14**, trim `test-setup.ts` before running anything: it imports `@/mocks/node`,
`@/mocks/db/store` (`resetDb`) and `@/mocks/handlers/accounts` (`resetAuthState`) at module scope,
so vitest cannot start until those exist. Delete the three imports and the `beforeAll`/`afterEach`
lines that use them.

**Acceptance** — `npm run test` passes, and **this step is where the four deferred assertions from
A6, A11, A12 and A14 come due**. Write them now, smallest first:

| From | Assertion                                                                    |
| ---- | ---------------------------------------------------------------------------- |
| A6   | `mapError(new Error('boom')).message` is non-empty and is not `'boom'`       |
| A11  | `toActionResult` on a thrower resolves to `{ ok: false, status: 0, body }`   |
| A12  | `Button` has no axe violations and is disabled while `loading`               |
| A14  | one service call returns seeded data through the mock, with no backend up    |

Four green specs here prove the whole lower stack is wired; a red one names exactly which earlier
step to go back to.

**Gate** — partial gate.

---

### A16 — The app shell

**Do** — root layout, providers mount, one route group, and the full error surface.

```
src/app/
├── layout.tsx          <html>/<body>, fonts, metadataBase, <Providers>
├── providers.tsx       'use client' — query provider + devtools gating
├── global-error.tsx    renders its OWN <html>/<body>, inline styles only
├── not-found.tsx
├── robots.ts  sitemap.ts
├── (site)/{layout.tsx,page.tsx,error.tsx}
└── (auth)/{layout.tsx,error.tsx}
```

- **Route groups are the app-shell mechanism**: `(site)` and `(auth)` have different chrome and
  different error boundaries, and neither adds a URL segment.
- **`global-error.tsx` must render its own `<html>`/`<body>` and use inline styles** — it replaces
  the root layout, so no app CSS, font, or provider is guaranteed to exist.
- **Never render a raw `error.message` in a production boundary.** Server errors are scrubbed to a
  `digest`; the remainder is either useless or an information leak.
- **Pages are thin**: resolve params, fetch page-level data, compose module exports, export
  metadata. No feature markup.

> **Version note (Next.js 16).** `params` and `searchParams` are `Promise`s and must be awaited, as
> are `cookies()`, `headers()`, and `draftMode()`. On 15.x the sync forms still work but are
> deprecated; write the awaited form either way.

**Acceptance** — visiting an unknown path renders `not-found.tsx`; throwing in a `(site)` page
renders the group boundary, not a white screen. **A13's deferred runtime check comes due here**:
with `<Providers>` now mounted, React Query Devtools render in dev, and `npm run build` emits no
devtools chunk.

**Gate** — **full gate** (the app now builds). See `references/10-routing-and-app-shell.md`,
`references/06-error-system.md` §5.

---

### A17 — The request proxy and the private-route list

**Do**

**Template** — `templates/src/common/config/private-routes.ts` →
`src/common/config/private-routes.ts` (copy this **first** — `proxy.ts` imports it), then
`templates/src/proxy.ts` → `src/proxy.ts` (on 15.x: `src/middleware.ts`).

`private-routes.ts` exports `PRIVATE_ROUTES`, `AUTH_ROUTES`, `SIGN_IN_PATH`, `isPrivateRoute` and
`isAuthRoute`. Three rules the file encodes and a hand-written version always loses:

- **One array, two readers.** The edge gate and the client code that reacts to sign-out both read
  it. A route added to one list and not the other is either visible after sign-out until a hard
  reload, or reachable by typing the URL.
- **Prefix match with a `/` suffix guard.** `isPrivateRoute` matches `pathname === route ||
  pathname.startsWith(`${route}/`)`. A bare `startsWith` makes `/billing-public` match `/billing`
  and produces a redirect loop on a page that was never meant to be private.
- **`AUTH_ROUTES` is exact-match and gates the opposite way** — signed-in visitors are redirected
  *away* from it. Merging the two lists inverts one of the two gates.

Resolve all three `// TODO(project):` markers before this step's gate; the shipped values are
example areas, not yours.

The proxy owns exactly three things: the **coarse** auth gate, pre-emptive token rotation (leg 1),
and request-header injection. It is not an authorization layer — the backend stays authoritative.

**The bug worth recording, because it costs a day.** To expose data to Server Components you must
set **request** headers:

```ts
// RIGHT — request headers reach the render.
const requestHeaders = new Headers(request.headers);
requestHeaders.set('x-current-path', pathname);
return NextResponse.next({ request: { headers: requestHeaders } });

// WRONG — this sets RESPONSE headers. It overwrites a Server Action's
// `text/x-component` content-type and breaks EVERY action with an opaque
// "An unexpected response was received from the server".
return NextResponse.next({ headers: requestHeaders });
```

Matcher excludes `api`, `_next/static`, `_next/image`, and static assets. **Route handlers must be
excluded** from a redirecting proxy: a redirect response corrupts their payload, and they read the
session themselves anyway.

> **Version note.** Next.js 16 names this file `src/proxy.ts` with a default-exported `proxy`
> function (config flag `skipProxyUrlNormalize`). On 15.x it is `src/middleware.ts` exporting
> `middleware` (`skipMiddlewareUrlNormalize`); the body is otherwise identical.

**Acceptance** — `curl -sI localhost:3000/dashboard` (any `PRIVATE_ROUTES` prefix) returns a 3xx
whose `Location` is `SIGN_IN_PATH` **carrying the originating path as a return param**. The
sign-in page itself does not exist yet, so following that redirect 404s — that is expected here and
is fixed when you build the auth surface. Also: `curl -sI localhost:3000/api/health` is untouched
(200, no redirect), and a Server Action still round-trips — throw a temporary action behind a
button and confirm you do **not** get "An unexpected response was received from the server", which
is the response-headers bug above.

**Gate** — full gate.

---

### A18 — CI and the container

**Do** — CI runs the local gate. If CI can pass where local fails (or the reverse), neither is a
gate: developers learn to treat CI failures as noise.

**Template** — `templates/config/ci.yml` → `.github/workflows/ci.yml`,
`templates/config/Dockerfile`, `templates/config/compose.yaml`,
`templates/config/.dockerignore` → repo root

Copy `ci.yml` as-is; do not hand-write a shorter version. It deviates from the local gate in
exactly three sanctioned ways, and an audit must not flag them:

1. **`typegen` runs first** — generated route types do not exist on a clean checkout, and without
   them `tsc` reports confident nonsense about page props that reproduces on no developer machine.
2. **`test` runs before `build`** — the slowest step runs last so a fast failure is reported
   sooner. **The command *set* is identical to the local gate; only the sequence differs, and this
   is the one sanctioned deviation.**
3. **`build-storybook` is appended** — a real gate step that compiles every story, catching
   components no current route happens to render. Delete it with the workshop.

Public env vars go on the **build step**, not the job, and must match what a deploy will use: they
are inlined into the client bundle at that moment and can never be changed afterwards.

**Also create the health route now.** The Dockerfile's `HEALTHCHECK` probes
`http://127.0.0.1:3000/api/health`, and no template ships it — without it the container never
reports healthy and any `depends_on: { condition: service_healthy }` waits forever. The four-line
handler, and why it must carry `export const dynamic = 'force-dynamic'`, is in
`references/11-tooling-and-gates.md` §8.

Container: multi-stage build on `output: 'standalone'` (set in A2b), non-root user,
`HOSTNAME=0.0.0.0`. **Public env vars are inlined at build time** — a `NEXT_PUBLIC_*` value passed
only at `docker run` is `undefined` in the browser. Pass them as build args and say so in a
comment; this surprises someone on every project.

**Acceptance** — a pushed branch runs every CI step green; `docker build` produces an image whose
client bundle contains the expected public API URL, and `docker run` reports `healthy`.

**Gate** — full gate.

---

### A19 — The project agent-instructions file

**Do** — write `AGENTS.md` (or `CLAUDE.md`) at the repo root. Keep it short: the skill carries the
architecture, the project file carries what is local to this project.

**Template** — `templates/config/AGENTS.md.template`

It contains exactly four things:

1. The stack line (framework + version, router, React version, TS strict).
2. The gate commands, verbatim.
3. A pointer to this architecture skill, with the instruction to consult it before writing
   framework-specific code.
4. Project-specific bans and decisions — every deliberately-disabled option, with its **symptom**
   and its **re-enable condition**. A silently-omitted option looks like an oversight and gets
   "fixed" by the next agent.

**Acceptance** — the file is under ~40 lines (the template says so too) and names no architecture
rule that this skill already states. A second copy of a rule is a rule that will disagree within a
month.

**Gate** — none (docs only). See `references/11-tooling-and-gates.md`.

---

### A20 — The first vertical feature module

**Do** — build one module end to end. It is the acceptance test for A1–A19: if any layer is wrong,
this step surfaces it. Worked example: `billing`, entity `Invoice`.

**Step 1 — declare the boundary first.**

```js
// eslint.config.mjs
const MODULES = ['billing'];
```

**Step 2 — schema** (`src/common/schemas/invoice.ts`):

```ts
import { z } from 'zod';
import { paginated } from '@/common/schemas/envelopes';
import { isoDate, looseString, looseDecimal } from '@/common/schemas/helpers';

export const invoiceStatuses = ['draft', 'sent', 'paid', 'void'] as const;

/** READ schema: tolerant at the leaves, strict at the shape. */
export const invoiceSchema = z.object({
  id: z.number(),
  number: looseString,
  status: z.enum(invoiceStatuses),
  total: looseDecimal,
  issued_at: isoDate,
});
export type Invoice = z.infer<typeof invoiceSchema>;

export const paginatedInvoicesSchema = paginated(invoiceSchema);

/** WRITE schema: exact. Tolerance here ships garbage upstream. */
export const invoiceUpdateSchema = z.object({
  number: z.string().min(1),
  status: z.enum(invoiceStatuses),
});
export type InvoiceUpdateBody = z.infer<typeof invoiceUpdateSchema>;
```

**Step 3 — service** (`src/common/services/invoice-service.ts`):

```ts
import 'server-only';
import { apiFetch } from './api-client';
import { invoiceSchema, paginatedInvoicesSchema } from '@/common/schemas/invoice';
import type { InvoiceUpdateBody } from '@/common/schemas/invoice';

export function listInvoices(page = 1) {
  return apiFetch(`/billing/invoices/?page=${page}`, paginatedInvoicesSchema);
}

export function updateInvoice(id: number, body: InvoiceUpdateBody) {
  return apiFetch(`/billing/invoices/${id}/`, invoiceSchema, { method: 'PATCH', json: body });
}
```

**Step 4 — action** (`src/modules/billing/actions/invoice-actions.ts`):

```ts
'use server';
import { z } from 'zod';
import { toActionResult } from '@/common/services/action-result';
import type { ActionResult } from '@/common/services/action-result';
import { updateInvoice } from '@/common/services/invoice-service';
import { invoiceUpdateSchema, type Invoice } from '@/common/schemas/invoice';
import { readSession } from '@/common/services/session';

/**
 * An action is a public HTTP endpoint. Re-validate and re-authorize here — the UI that
 * called it is not a security boundary, and the owner id comes from the session, never
 * from an argument.
 */
export async function updateInvoiceAction(
  id: number,
  input: unknown,
): Promise<ActionResult<Invoice>> {
  const { access } = await readSession();
  if (!access) return { ok: false, status: 401 };

  const parsed = invoiceUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  return toActionResult(() => updateInvoice(id, parsed.data));
}
```

**Step 5a — the screen component** (`src/modules/billing/components/InvoiceListPage.tsx`).

This module uses the **server-rendered** data path, not the query cache: the list is derivable from
the request and read-only on this screen, so row 1 of the decision table in
`references/08-state-and-data-flow.md` §1 applies and shipping a client fetch for it would be a
defect. Use the other path — prefetch + `HydrationBoundary` — only once the client will mutate,
poll, paginate or reorder the same data in place.

```tsx
// No 'use client'. No fetch. No schema parse — the service already did it exactly once.
import { listInvoices } from '@/common/services/invoice-service';
import { Button } from '@/common/components/ds/Button';

export async function InvoiceListPage({ page }: { page: number }) {
  const { results, count } = await listInvoices(page);

  if (results.length === 0) {
    return <p className="py-12 text-center text-sm">No invoices yet.</p>;
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-xl font-medium">Invoices ({count})</h1>
      <ul className="flex flex-col gap-2">
        {results.map(invoice => (
          <li key={invoice.id} className="flex h-control items-center gap-4 rounded-control border border-control px-4">
            <span className="font-medium">{invoice.number}</span>
            <span className="text-sm">{invoice.status}</span>
            <span className="ms-auto tabular-nums">{invoice.total}</span>
            <Button size="sm" variant="outline" asChild>
              {/* relative sibling import — never through this module's own barrel */}
              <a href={`/billing/${invoice.id}`}>Open</a>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

**Step 5b — the skeleton** (`src/modules/billing/components/InvoiceListSkeleton.tsx`).

It mirrors the **exact box model** of the real list — same wrapper, same `h-control`, same radius,
same gaps — because a centered spinner collapses the container to zero height and everything below
jumps when data lands. Keep it hook-free and server-safe so `loading.tsx` and a server `<Suspense>`
can both render it.

It imports `Skeleton` from `common/components/loader/`. A12 built only one **control**, so that
four-line primitive does not exist yet: copy it now from `references/02-design-system.md` §6, which
also carries the side-by-side worked example of a real component and its loader.

```tsx
import { Skeleton } from '@/common/components/loader/Skeleton';

export function InvoiceListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    // aria-hidden: the Suspense boundary's own live region announces loading; a screen
    // reader narrating a tree of empty boxes is worse than silence.
    <section aria-hidden className="flex flex-col gap-4">
      <Skeleton className="h-7 w-40" />
      <ul className="flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="flex h-control items-center gap-4 rounded-control border border-control px-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="ms-auto h-4 w-20" />
          </li>
        ))}
      </ul>
    </section>
  );
}
```

**Step 5c — the barrel**:

```ts
// src/modules/billing/index.ts — THE public API of this module. Everything else is private.
export { InvoiceListPage } from './components/InvoiceListPage';
export { InvoiceListSkeleton } from './components/InvoiceListSkeleton';
export { updateInvoiceAction } from './actions/invoice-actions';
export type { Invoice } from '@/common/schemas/invoice';
```

A module's own files import each other **relatively** (`./components/X`), never through their own
barrel — importing your own barrel is a circular-import trap that shows up as `undefined` exports
at runtime.

**Step 6 — route** (`src/app/(site)/billing/page.tsx`):

```tsx
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { InvoiceListPage, InvoiceListSkeleton } from '@/modules/billing';

export const metadata: Metadata = { title: 'Invoices' };

// Next.js 16: searchParams is a Promise. (15.x: the sync object still works, deprecated.)
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  return (
    <Suspense fallback={<InvoiceListSkeleton />}>
      <InvoiceListPage page={Number(page ?? 1)} />
    </Suspense>
  );
}
```

**Acceptance for A20 — all five must hold**

1. `rm -rf src/modules/billing` + deleting `app/(site)/billing` + removing `'billing'` from
   `MODULES` leaves the app type-checking clean. (If it doesn't, something imported module
   internals and the barrel rule was already broken.)
2. A deliberate `import … from '@/modules/billing/components/InvoiceListPage'` in `src/app` fails
   lint with your teaching message.
3. The page renders server-side against the mock front-db with no backend running.
4. Breaking the mock's response shape makes the **service** throw a schema error — not a component
   three levels down.
5. Ordering holds in **both** directions, because authorize-then-validate is the rule:
   with a session present, `updateInvoiceAction(1, {})` returns `{ ok: false, status: 422 }` and
   never throws; with no session it returns `{ ok: false, status: 401 }` **before** parsing.
   Do not "fix" a 401 in a unit test by moving the auth check after validation — that is a security
   regression. Make it testable instead:

   ```ts
   vi.mock('@/common/services/session', () => ({
     readSession: vi.fn(async () => ({ access: 'test-token', refresh: 'test-refresh' })),
   }));
   ```

   See `references/09-mocking-and-testing.md` §9.4 for the full action-test setup.

**Gate** — full gate, then commit `feat(billing): first vertical module`.

---

## Part A — copy-paste checklist

```
[ ] A1  scaffold with every flag explicit (--yes); no --turbopack flag on 16; example pages deleted
[ ] A1  every package installed, incl. radix-ui, prettier-plugin-tailwindcss, devtools, workshop
[ ] A1b canonical scripts + lint-staged merged into package.json from package.scripts.json
[ ] A2  tsconfig template copied: strict, @/* alias, BOTH .next/types and .next/dev/types includes
[ ] A2b next.config.ts (standalone, env-driven remotePatterns, reactCompiler off + reason)
[ ] A2b postcss.config.mjs, components.json, globals.css @theme tokens + @source inline
[ ] A3  eslint.config.mjs boundary enforcer with MODULES = []; a11y override block deleted
[ ] A3  .prettierrc; boundary proven live by a deliberate violation that ERRORS (then removed)
[ ] A4  husky pre-commit/commit-msg/pre-push; commitlint.config.ts; lint-staged
[ ] A5  src/{app,modules,common,mocks,test} skeleton
[ ] A6  common/errors/* — types, messages, parse-body, map-error, barrel
[ ] A7  common/config/env.ts (fail-fast, no local defaults) + common/constants/api.ts + .env.example
[ ] A8  common/services/{http-types,http,api-client}.ts; server-only on everything but http
[ ] A9  common/services/{session,jwt}.ts; three-state rotation; single-flight; per-request secure
[ ] A10 common/schemas/{envelopes,helpers}.ts; no server-only in the schema graph
[ ] A11 common/services/action-result.ts
[ ] A12 components/{ui,ds,form,variants} + cn() + one control with story and axe test
[ ] A12 .storybook/{main.ts,preview.tsx}; a11y set to 'error', not 'todo'
[ ] A12b hooks/applyFieldErrors.ts + components/form/{Form,FormInput,FormButton}.tsx
[ ] A13 lib/query-client.ts, api/query-keys.ts, observability/dev-log.ts, stores/session-store.ts
[ ] A13 lib/mock-ready.ts + app/providers.tsx; both fenced blocks decided, not left dangling
[ ] A14 mocks/{db,handlers,browser,node,init}; instrumentation.ts uncommented; npx msw init public/
[ ] A14 pending-backend.ts if any endpoint is unshipped; the two mock flags kept distinct
[ ] A15 vitest.config.ts with server-only alias; test/setup.ts with jsdom polyfills
[ ] A16 app shell: root layout, providers mounted, global-error, not-found, robots, sitemap, group
[ ] A17 config/private-routes.ts (TODOs resolved) + proxy.ts (REQUEST headers, not response)
[ ] A18 ci.yml as-is; Dockerfile standalone + non-root + build-arg public env; app/api/health
[ ] A19 AGENTS.md ≤ ~40 lines: stack, gate, skill pointer, bans with symptom + re-enable condition
[ ] A20 first module end to end; all five A20 acceptance checks pass
[ ] --  full gate green; every TODO(project) in every copied template resolved
```

---

# Part B — Brownfield migration

**Sequencing rules.**

- Phases are in **dependency order**. Do not start a phase before its entry criteria hold.
- Phases P0–P2 must be **behavior-frozen**: no visible change. That is what makes them revertable
  and what makes a later regression attributable.
- Within P1–P6, migrate **module by module**, not concern by concern. One fully-migrated module is
  shippable; six half-migrated concerns are a permanent fork.
- Every phase ends with the full gate and one commit: `refactor(arch): <phase>`.
- Old and new must not coexist past the end of the phase that introduced the new. Delete the old
  path in the same phase.

| Phase | Name                        | Guide                                          |
| ----- | --------------------------- | ---------------------------------------------- |
| P0    | Honest build + gates        | `references/11-tooling-and-gates.md`           |
| P1    | Boundaries                  | `references/01-layering-and-boundaries.md`     |
| P2    | Server data layer + schemas | `references/03-server-data-layer.md`, `references/05-contracts-and-schemas.md` |
| P3    | Actions and forms           | `references/04-actions-and-mutations.md`, `references/07-forms.md` |
| P4    | Error system                | `references/06-error-system.md`                |
| P5    | State                       | `references/08-state-and-data-flow.md`         |
| P6    | Design system               | `references/02-design-system.md`               |
| P7    | Mocks and tests             | `references/09-mocking-and-testing.md`         |
| P8    | Performance + final audit   | `references/10-routing-and-app-shell.md`, Part C |

---

### P0 — Make the build honest, install the gates

**Symptoms that make this urgent** — `ignoreBuildErrors` or `ignoreDuringBuilds` in the framework
config; `// @ts-nocheck` or file-level `/* eslint-disable */` headers; a lint script that passes
because it lints nothing; tests that are `.skip`-ed or absent with `--passWithNoTests` hiding it;
`--no-verify` in anyone's muscle memory; a red CI badge everyone ignores.

**Entry criteria** — none. This is always first.

**Work**

1. Delete every build suppression flag. Run `npm run typecheck` and `npm run lint` and record the
   raw error count — that number is the real debt, and you cannot manage it while it is invisible.
2. Fix errors in this order: type errors that indicate real bugs → type errors that need a schema
   → lint errors → formatting. Where a fix needs a product decision, add a narrowly-scoped
   `eslint-disable-next-line` **with a comment naming the reason and the follow-up**, never a file
   or blanket disable.
3. Install the canonical scripts (A3), husky hooks (A4), and CI mirroring the gate (A18).
4. Add `.env.example` documenting every variable the app already reads.
5. Ban list into `AGENTS.md` with symptom + re-enable condition for anything left off.

**Gate** — full gate green, with zero suppressions. This is the only phase where "green" is the
entire deliverable.

**Rollback** — the suppression flags can be restored in one commit, but do not: a repo that needs
them is a repo where every subsequent audit result is fiction. If the error count is
unmanageable in one pass, keep suppression **off** and add a temporary per-file
`eslint-disable-next-line` inventory instead, so new violations are impossible while old ones burn
down.

---

### P1 — Boundaries

**Symptoms** — deep imports like `@/modules/a/components/Thing/Thing`; `common/` importing from
`modules/`; two modules importing each other (often a cycle); no `index.ts` anywhere under
`modules/`; three different module folder shapes; a rename that touches 40 files.

**Entry criteria** — P0 gate green.

**Work** (mechanical, zero behavior change)

1. Inventory the violations before moving anything:
   ```bash
   grep -rn "from '@/modules/" src/common src/app | grep -v "from '@/modules/[a-z-]*'"
   grep -rn "from '@/app/" src/common src/modules
   ```
2. Create `src/{app,modules,common}` if the repo doesn't have them, and move files by **layer
   smell**: does it know a URL (`app`), a feature (`modules`), or neither (`common`)?
3. Add `index.ts` to every module and rewrite external deep imports to the barrel. Do one module
   per commit.
4. Break cycles by **promotion**, never by a shared "utils" module: if `a` and `b` both need `X`,
   `X` moves to `common/`. Promote on the second consumer, not the first.
5. Fix `common → modules` inversions with a prop or a slot. A shared layout that imports a
   feature's store is the classic case; it takes the resolved value as a prop instead.
6. Turn on the A3 lint zones **one module at a time**: add the name to `MODULES`, fix its
   violations, commit. Existing violations elsewhere stay invisible until their module's turn.
7. Normalize module anatomy (`components/ actions/ hooks/ schemas/ stores/ data/ lib/ types.ts`)
   and directory casing last, when nothing else is in flight.

**Gate** — full gate; plus `rm -rf` one migrated module + its routes + its `MODULES` entry
type-checks clean.

**Rollback** — per-module commits revert independently. A module whose barrel proves impossible
usually has a genuine second boundary inside it; split it rather than reverting the whole phase.

---

### P2 — Server data layer and schemas at the network edge

**Symptoms** — a client-side fetch wrapper that attaches bearer tokens in the browser; an internal
API route whose only job is handing tokens to client JavaScript; `as SomeType` casts on JSON
responses; a backend shape change that surfaces as `Cannot read properties of undefined` deep in a
component; hand-written interfaces that mirror API responses; `fetch(` inside components; a
literal origin string in more than one file.

**Entry criteria** — P1 done for at least the modules being migrated.

**Work**

1. Add rings 1–2 (A8) and `env`/`API_URL` (A7). Do not port the old wrapper's design; port its
   **hard-won details** (retry status list, timeout, signal merging) into the new `http.ts`.
2. Add `session.ts` (A9) and move token cookie access into it. Delete any endpoint that exposes
   tokens to the browser — that endpoint hands the session to any same-origin script, which is the
   entire thing httpOnly cookies exist to prevent.
3. Per resource: write `common/schemas/<r>.ts`, then `common/services/<r>-service.ts`, then
   convert callers. Read schemas tolerant, write schemas exact.
4. Convert the module's reads to server components calling services; keep genuinely interactive
   reads in the query cache, now seeded from the server.
5. Delete the old client wrapper and its per-module mirrors the moment the last caller is gone.
6. Rotation moves to the proxy (A17). **RSC renders cannot write cookies** — do not try to persist
   a rotation from inside a service called during render; the in-render refresh applies to that one
   request only.

**Gate** — full gate; plus `grep -rn "as [A-Z]" src/common/services` returns nothing, and every
service file imports `server-only`.

**Rollback** — keep the old wrapper alive but **unreferenced** until the phase's gate passes, then
delete it in the same commit. Reverting is a single import-path revert per module.

---

### P3 — Actions and forms onto the `ActionResult` contract

**Symptoms** — mutations are client `fetch` calls; actions `throw` on validation failure; every
action has its own bespoke try/catch return shape; the client branches on `error.message` text;
forms show a generic toast because field errors were lost crossing the boundary; an action takes a
`userId` argument.

**Entry criteria** — P2 done for the resources this module writes.

**Work**

1. Add `action-result.ts` (A11) if it isn't there.
2. Per module: create `actions/<entity>-actions.ts` with `'use server'` at the top of the file.
   Each action re-validates its input with the write schema, re-authorizes from the session, calls
   the service, and returns through `toActionResult`.
3. **Never accept an owner/tenant id as an argument** — read identity from the session. An action
   is a public endpoint; the UI that calls it is not a security boundary.
4. Client mutations call the action and pass the result through `unwrap`, so `onError` fires with
   status and body intact and optimistic rollback still works.
5. Forms: pick the tier per `references/07-forms.md`. Simple, mostly-server forms move to
   `useActionState`; rich forms keep react-hook-form and hand off to the action on submit, binding
   the normalized `fieldErrors` back via `setError`.
6. Server-cache invalidation belongs to the action; client-cache invalidation belongs to the hook.
   Neither reaches into the other's layer.
7. `redirect()` and `notFound()` throw by design — call them **last** and never inside a `try`.

> **Version note.** Next.js 16: `revalidateTag(tag, profile)` — the single-argument form is
> deprecated on 16, so pass a cache-life profile (`'max'` is the sane default). `updateTag(tag)`
> gives read-your-own-writes within the same request. On 15.x: `revalidateTag(tag)`.

**Gate** — full gate; plus a test per migrated action asserting the failure path returns
`{ ok: false, status }` rather than throwing.

**Rollback** — actions are additive; the old client mutation path can stay until the module's forms
are switched, then both go in one commit.

---

### P4 — The error system

**Symptoms** — three different ways of reading an error body in three files; a toast that renders
`Error:` with nothing after it; `instanceof` checks that stopped working after errors started
crossing the action boundary; a 403 displayed as "network error"; raw `error.message` rendered in
a production boundary; `catch {}`.

**Entry criteria** — P2 (there is one place errors originate) and P3 (there is one place they are
normalized into results).

**Work**

1. Add `common/errors/*` (A6) and route every call site through `mapError` / `errorMessage` /
   `fieldErrors`. Delete the ad-hoc extractors.
2. **Extract `status`/`body` by duck-typing, never `instanceof`.** An error that crossed the action
   RPC boundary or a structured clone is no longer an instance of your class, and `instanceof`
   silently downgrades a real 403 to a generic network error.
3. Fill `DEFAULT_BY_STATUS` / `DEFAULT_BY_CODE` — this is the localization seam, and the last
   candidate in the chain is an unconditional constant so no UI ever renders an empty message.
4. Trust body-derived strings only when `status > 0`. At `status === 0` the "body" is an internal
   JS message and showing it leaks implementation detail.
5. Install the boundary tiers: `global-error.tsx` (own `<html>`/`<body>`, inline styles), one
   boundary per route group, per-route boundaries only where the failure is local.
6. Audit every `catch`: a failure may be swallowed only with a written reason and a narrow guard.
7. Wire `devLog`/`devError` at the network edge and on query/mutation failures, guarded by
   `NODE_ENV`.

**Gate** — full gate; plus `grep -rn "instanceof HttpError" src/modules src/app` returns nothing,
and `grep -rn "catch {}" src` returns nothing.

**Rollback** — purely additive until the old extractors are deleted; delete them in the same
commit as the last call-site conversion.

---

### P5 — State

**Symptoms** — server data duplicated into a client store; `useEffect` + `setState` fetching;
a global store with 40 unrelated keys; `localStorage` read during render (hydration mismatch);
every page refetching the same "who am I" call; a loading spinner on data the server already had.

**Entry criteria** — P2 (server reads exist) and P4 (failures are visible).

**Work**

1. Classify every piece of state with the decision table in `references/08-state-and-data-flow.md`:
   server-rendered / query cache / URL / client store / local component state. Default to the
   server.
2. Move server data **out** of stores. A store holds cross-route ephemeral UI state, wizard drafts,
   the resolved session identity, the "currently selected X" — never a copy of a server record.
3. Replace `useEffect` fetching with a server component or a query. An effect-fetch has no cache,
   no dedupe, no retry policy, and double-fires in strict mode.
4. Introduce SSR prefetch + `HydrationBoundary` for client-heavy pages, with **exactly matching**
   query keys — a mismatched key silently double-fetches and the hydration payload is wasted.
5. Persisted stores hydrate in an effect or via `skipHydration`, never during render.
6. Add the `*Sync` bootstrap components (render-nothing, mounted once above the tree) that resolve
   app-wide identity so routes inherit one resolved state, and clear everything on sign-out.

**Gate** — full gate; plus no client-side loading flash on a migrated page (its content appears in
view-source).

**Rollback** — per-page. Prefetch is additive; removing it restores the previous client-fetch
behavior without touching components.

---

### P6 — Design-system consolidation

**Symptoms** — four button implementations; `className` string concatenation with template
literals; inline `style` objects for anything but a computed value; product code importing
generated primitives directly; controlled inputs receiving `undefined`; spinners where the content
shape is known; no story, no axe test, no `displayName`.

**Entry criteria** — P1 (there is a `common/components` to consolidate into).

**Work**

1. Create the four tiers (A12) and move the best existing implementation of each control into
   `ds/`, its styling into `variants/`, its generated base (if any) into `ui/`.
2. Convert call sites control by control; delete each duplicate as its last caller moves.
3. Every class list terminates in `cn()` with caller overrides merged **last**, or your override
   prop silently loses to the base class.
4. Coalesce controlled-input values (`?? ''`, `?? false`, `?? []`). A controlled input that
   receives `undefined` flips to uncontrolled and React warns once, then the field stops updating.
5. Replace spinners with skeletons that mirror the exact box model — same widths, heights, radii,
   gaps, breakpoints — or you have traded a spinner for layout shift.
6. Add a story and a jest-axe test per `ds/` control; axe failures fail CI.

**Gate** — full gate; plus `grep -rn "from '@/common/components/ui/" src/app src/modules` returns
nothing, and the axe suite passes.

**Rollback** — per-control commits.

---

### P7 — Mocks and tests

**Symptoms** — no way to run the app without the backend; each test file defines its own mock
response array; tests that pass because they assert on mocks of the code under test; a jsdom crash
on `matchMedia`; server code untestable because `server-only` throws.

**Entry criteria** — P2 (there is a network edge worth intercepting).

**Work**

1. Build the front-db (A14): a real in-memory store with a deterministic seed, handlers per
   resource, a `_shared` helper for envelopes/pagination/auth checks.
2. Wire **both** runtimes — browser worker and node server via `instrumentation.ts` — gated on the
   env flag so mock code never enters a production build.
3. Add the readiness signal so server-rendered HTML is not blanked while the browser worker boots;
   only client queries with no server data gate on it.
4. Test harness (A15), then fill the pyramid bottom-up: pure utils → schemas against **captured**
   payloads (not imagined ones) → services/api-client against the mock server → actions (mock the
   service, assert the `ActionResult`) → hooks with a query-client wrapper → `ds` components with
   testing-library → axe.
5. Add deliberate error injection to the mock so 4xx/5xx paths are exercisable on demand.

**Gate** — full gate; plus the app runs end to end with the backend switched off.

**Rollback** — entirely additive.

---

### P8 — Performance and the final audit

**Symptoms** — a client bundle containing a server-only dependency; every page a client component;
raw `<img>`; no metadata beyond a root title; no `sitemap.ts`/`robots.ts`; heavy libraries loaded
on routes that never use them.

**Entry criteria** — P0–P7 done for every module.

**Work**

1. Push `'use client'` down to the leaves; use the children/slot pass-through so a server subtree
   is not clientified by a client parent.
2. Framework caching per `references/10-routing-and-app-shell.md`: classify each route as static /
   cached / streamed, give every cache scope an explicit lifetime and tag, and make sure every
   declared tag has a real purge path. A tag nothing ever purges is a comment, not a cache.
3. Images through the framework component with an allowlisted remote-pattern set driven by env;
   fonts self-hosted; `sizes` on responsive images; `priority` on exactly the LCP image.
4. Metadata: `metadataBase`, per-route `generateMetadata`, `sitemap.ts`, `robots.ts`.
5. Run the bundle analyzer; dynamic-import heavy client-only libraries.
6. Run **Part C** end to end. Every unmet item is fixed or recorded with a justification.

**Gate** — full gate; Part C score at or above the target grade; no unmet blockers.

**Rollback** — each optimization is independent and individually revertable; caching changes are
the only user-visible ones and must be listed in the final report.

---

# Part C — Audit checklist

Run against any repo. Each item is **yes/no** and objectively checkable. The command hints assume
`src/` layout and a POSIX shell; they are starting points — read the hits, do not just count them.

**Severity**

- **blocker** — a security, correctness, or trust-in-the-gate defect. Any unmet blocker fails the
  audit outright.
- **major** — an architectural violation that compounds: it makes the next change harder.
- **minor** — a consistency or hygiene defect.

Mark an item **N/A** only with a written reason (e.g. no auth in this app). N/A items leave the
denominator.

---

### C1 · Boundaries — `references/01-layering-and-boundaries.md`

| ID     | Check                                                                     | Sev     | How to verify                                                                                        |
| ------ | ------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| BND-01 | `common/` imports nothing from `modules/` or `app/`                        | blocker | `grep -rnE "from '@/(modules\|app)/" src/common` returns nothing                                     |
| BND-02 | No cross-module imports, including type-only                               | blocker | for each `m`: `grep -rn "from '@/modules/" src/modules/$m \| grep -v "@/modules/$m"` returns nothing  |
| BND-03 | Every module has an `index.ts` barrel                                      | major   | `for d in src/modules/*/; do test -f "$d/index.ts" \|\| echo "$d"; done` prints nothing               |
| BND-04 | Outside code imports only module barrels, never internals                  | major   | `grep -rn "from '@/modules/[a-z-]*/" src/app src/common` returns nothing                              |
| BND-05 | `modules/` never imports from `app/`                                       | major   | `grep -rn "from '@/app/" src/modules` returns nothing                                                 |
| BND-06 | Boundary rules are machine-enforced, generated from a `MODULES` array      | blocker | `grep -n "MODULES" eslint.config.mjs` shows the array; every folder in `src/modules` appears in it    |
| BND-07 | Every restriction carries a `message` that teaches the fix                 | minor   | every `group:` in the config has a sibling `message:`                                                 |
| BND-08 | A module's files import each other relatively, not via their own barrel    | major   | for each `m`: `grep -rn "from '@/modules/$m'" src/modules/$m` returns nothing                         |
| BND-09 | `app/` files contain no domain JSX or business logic                       | major   | `find src/app -name 'page.tsx' \| xargs wc -l \| sort -rn \| head` — pages over ~60 lines are suspect |
| BND-10 | A module is a unit of deletion                                             | major   | `rm -rf` one module + its routes + its `MODULES` entry ⇒ `npm run typecheck` clean (do it on a branch)|
| BND-11 | Cross-layer imports use the `@/` alias, not `../../..`                     | minor   | `grep -rn "from '\.\./\.\./\.\./" src` returns nothing                                                |
| BND-12 | No `common/` helper with exactly one caller (promotion discipline)         | minor   | spot-check: for a sample of `common/utils/*` and `common/hooks/*`, count importers                    |

### C2 · Design system — `references/02-design-system.md`

| ID    | Check                                                                   | Sev     | How to verify                                                                            |
| ----- | ----------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| DS-01 | Product code never imports `ui/` directly                                | major   | `grep -rn "components/ui/" src/app src/modules` returns nothing                            |
| DS-02 | The three tiers exist and flow one way (`ui → ds → form`)                | major   | `grep -rnE "components/(ds\|form)/" src/common/components/ui` returns nothing             |
| DS-03 | Style lives in `variants/*.ts`, not inline in `ds/` bodies               | major   | `grep -rn "cva(" src/common/components/ds` returns nothing (all `cva` in `variants/`)      |
| DS-04 | Every class list terminates in `cn()`                                    | minor   | `grep -rn 'className={' src/common/components/ds` — every hit passes through `cn(...)`|
| DS-05 | No duplicate implementations of one control                             | major   | `ls src/common/components/ds` has one file per control; grep the app for rival local ones  |
| DS-06 | Controlled inputs never receive `undefined`                             | major   | `grep -rn "value={" src/common/components/form` — each has a `??` coalesce                 |
| DS-07 | Every `ds/` control has a story                                         | minor   | count `ds/*.tsx` vs `ds/*.stories.tsx`                                                     |
| DS-08 | Every `ds/` control has a jest-axe test and axe failures fail CI         | major   | `grep -rln "toHaveNoViolations" src/common/components/ds \| wc -l` ≈ control count         |
| DS-09 | Skeletons mirror the real box model                                     | minor   | each `*Skeleton` shares the widths/heights/gaps of its component                           |
| DS-10 | Icons are typed components drawn in `currentColor`                      | minor   | `grep -rn "fill=\"#" src/common/icons` returns nothing (hard-coded colors)                  |
| DS-11 | Design values live in ONE token layer that the variants tier consumes    | major   | `grep -n "@theme" src/app/globals.css` shows the token block; then `grep -rnE "#[0-9a-fA-F]{3,8}\|rgb\(\|oklch\(" src/common/components src/modules` returns nothing — a colour literal in a component is a value no theme, no dark mode and no rebrand can reach |
| DS-12 | Every runtime-composed class is declared to the scanner                 | minor   | v4 reads source **text**: a class built by concatenation or emitted by a primitive's `data-[state=…]` is not generated. Each must appear in an `@source inline(...)`; verify by grepping one out of the built CSS in `.next/static/css/` (v3: `safelist`) |

### C3 · Server data layer — `references/03-server-data-layer.md`

| ID      | Check                                                                     | Sev     | How to verify                                                                                     |
| ------- | ------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| DATA-01 | No token, secret, or bearer header is constructed in client code           | blocker | `grep -rn "Bearer" src \| grep -v "common/services"` returns nothing                                |
| DATA-02 | No endpoint exposes session tokens to the browser                          | blocker | no route handler returns cookie values; `grep -rn "cookies()" src/app/api`                          |
| DATA-03 | Every file that talks to the backend imports `server-only`                 | blocker | `grep -rL "^import 'server-only'" src/common/services/*.ts` lists only `http.ts`, `http-types.ts`, `jwt.ts` and `action-result.ts` — the four runtime-agnostic modules. Match the import line, not the word: some of those files name `server-only` in a comment explaining why they omit it. Every file that constructs an authenticated request or reads a cookie must appear in the complement |
| DATA-04 | Responses are zod-parsed in exactly one place (`api-client`)               | blocker | `grep -rn "\.parse(" src/common/services` — hits only in `api-client.ts`                            |
| DATA-05 | No `as` cast on a network response                                         | blocker | `grep -rnE "as unknown as\|: any\b" src` returns nothing; spot-check `as <Type>` in services       |
| DATA-06 | Components never call `fetch` and never build a URL                        | major   | `grep -rn "fetch(" src/modules src/app --include=*.tsx` returns nothing                             |
| DATA-07 | One service module per backend resource, thin and React-free               | major   | `grep -rnE "use client\|useState\|'use server'" src/common/services` returns nothing                 |
| DATA-08 | The API base URL comes from validated env, never a literal                 | blocker | `grep -rnE "https?://" src --include=*.ts \| grep -v config/env \| grep -v mocks` is empty   |
| DATA-09 | Env is zod-parsed at import time and fails fast                            | blocker | `common/config/env.ts` throws on parse failure; no production-critical var has a local default      |
| DATA-10 | Public env vars are read by static property access                         | major   | `grep -rn "process.env\[" src` returns nothing                                                      |
| DATA-11 | `session.ts` is the only module touching auth cookies                      | blocker | `grep -rn "cookies()" src --include=*.ts` hits only `session.ts` and route handlers. `proxy.ts` must NOT appear — at the edge it uses `request.cookies`/`response.cookies` |
| DATA-12 | Rotation is a three-state verdict; only `rejected` clears cookies          | blocker | read `rotateSession`: an unreachable backend must not delete cookies                                |
| DATA-13 | Rotation is single-flighted per refresh token                             | major   | `rotateSession` shares one in-flight promise keyed by the token                                     |
| DATA-14 | Cookie `secure` derives from the request, not `NODE_ENV`                   | major   | `grep -n "NODE_ENV" src/common/services/session.ts` returns nothing                                 |
| DATA-15 | Cookie `maxAge` derives from the token's `exp`                             | minor   | `accessCookieMaxAge` / `refreshCookieMaxAge` decode the token                                       |
| DATA-16 | No cookie write during an RSC render                                       | blocker | no `cookies().set` outside actions, route handlers, and the proxy                                   |
| DATA-17 | Not-yet-shipped endpoints fall back in one greppable module                | minor   | fallbacks live in `common/services/pending-backend.ts`, not sprinkled through services              |

### C4 · Actions and mutations — `references/04-actions-and-mutations.md`

| ID     | Check                                                                    | Sev     | How to verify                                                                                  |
| ------ | ------------------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------ |
| ACT-01 | Write actions return a discriminated result; they never throw            | blocker | `grep -rn "throw " src/modules/*/actions src/common/actions` — only `redirect`/`notFound`       |
| ACT-02 | One normalizer: `toActionResult` server-side, `unwrap` client-side       | major   | `grep -rn "try {" src/modules/*/actions` — bespoke try/catch shapes are the violation           |
| ACT-03 | Every action re-validates its input with a schema                        | blocker | every exported action body contains a `safeParse`/`parse` before the service call               |
| ACT-04 | Every action re-authorizes from the session                              | blocker | every non-public action reads the session before acting                                         |
| ACT-05 | No action accepts a user/tenant/owner id as an argument                  | blocker | `grep -rnE "userId\|ownerId\|tenantId" src/modules/*/actions` — none in a parameter list          |
| ACT-06 | Actions call services, never `fetch`; no URLs or schema parses in bodies | major   | `grep -rnE "fetch\(\|API_URL" src/modules/*/actions` returns nothing                              |
| ACT-07 | `'use server'` is at the top of the file, not sprinkled inline           | minor   | `grep -rn "'use server'" src` — each hit is line 1 of an `actions/` file                        |
| ACT-08 | `redirect()`/`notFound()` are never inside a `try`                       | major   | read each call site: they work by throwing; a catch turns navigation into a swallowed error     |
| ACT-09 | Branching is on status/code/field key, never message text                | major   | `grep -rnE "message\.includes\|message ===" src` returns nothing                                 |
| ACT-10 | One exported hierarchical `as const` query-key factory                   | major   | `grep -rn "queryKey: \['" src` returns nothing (all keys via `queryKeys`)                       |
| ACT-11 | The action owns server-cache invalidation; the hook owns client-cache    | major   | `grep -rn "invalidateQueries" src/modules/*/actions` returns nothing                            |
| ACT-12 | Optimistic mutations cancel, snapshot, write, and roll back + settle     | major   | each `onMutate` has `cancelQueries` + `getQueryData`; each has `onError` rollback + `onSettled` |
| ACT-13 | Optimistic rollback surfaces the cause, not just the revert              | minor   | `onError` also raises a message; a silent rollback makes the user's edit vanish unexplained     |
| ACT-14 | Route handlers exist only for external consumers, not internal proxying  | major   | each `src/app/api/**/route.ts` has a non-browser consumer named in a comment                    |
| ACT-15 | Cache tags declared are actually purged somewhere                        | major   | for each `tags: [...]`, grep the tag name for a `revalidateTag`/`updateTag` caller               |
| ACT-16 | No single-argument `revalidateTag` on Next.js 16 (deprecated, not removed) | minor  | `grep -rn "revalidateTag([^,)]*)" src` returns nothing (16.x only)                               |

### C5 · Contracts and schemas — `references/05-contracts-and-schemas.md`

| ID     | Check                                                                | Sev     | How to verify                                                                            |
| ------ | -------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| SCH-01 | Validation happens at the boundary exactly once                      | blocker | no `.parse(` in components or hooks: `grep -rn "\.parse(" src/modules --include=*.tsx`     |
| SCH-02 | Wire types are derived with `z.infer`, never hand-written            | major   | `grep -rn "^export interface" src/common/types` — none mirrors an existing schema           |
| SCH-03 | One schema module per resource, mirroring services                   | minor   | `ls src/common/schemas` pairs with `ls src/common/services/*-service.ts`                   |
| SCH-04 | Read schemas are tolerant at the leaves                              | major   | leaf fields use the `helpers` (`looseString`, `nullToUndefined`, …), not bare `z.string()` |
| SCH-05 | Write schemas are exact (no tolerance, no passthrough)               | major   | `*UpdateSchema` / `*CreateSchema` use plain types and `.strict()` where supported          |
| SCH-06 | The schema graph imports no `server-only`, component, hook, service  | blocker | `grep -rnE "server-only\|@/common/services\|components" src/common/schemas` returns nothing |
| SCH-07 | Enum values live in exactly one `as const` array                     | major   | `grep -rn "z.enum(\['" src` returns nothing (all enums via a shared const array)           |
| SCH-08 | Wire schemas and form schemas are separate files                     | major   | form schemas live in `*-forms.ts` or `modules/*/schemas/`, never mixed with wire shapes    |
| SCH-09 | Schema tests parse **captured** payloads, not invented ones          | major   | fixtures under `__tests__` are labelled with where/when they were captured                 |
| SCH-10 | No `as`, `any`, or `@ts-expect-error` at a boundary                  | blocker | `grep -rnE "@ts-expect-error\|@ts-ignore\|: any\b" src` returns nothing                     |
| SCH-11 | No hand-duplicated type that a schema already describes              | major   | cross-check `src/common/types/*.ts` against `src/common/schemas/*.ts`                      |

### C6 · Error system — `references/06-error-system.md`

| ID     | Check                                                                   | Sev     | How to verify                                                                                |
| ------ | ----------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| ERR-01 | Exactly one error shape reaches the UI                                  | blocker | `grep -rnE "\.response\?\.data\|body\?\.errors\|\.detail" src \| grep -v common/errors` is empty  |
| ERR-02 | `mapError` is the only interpreter of a thrown value                    | blocker | `grep -rln "mapError" src` — call sites use it rather than re-deriving                        |
| ERR-03 | Status/body extraction is duck-typed, never `instanceof`                | blocker | `grep -rnE "instanceof (HttpError\|ActionError)" src/modules src/app` returns nothing |
| ERR-04 | `message` is never empty (chain ends in a constant)                     | major   | `GENERIC_MESSAGE` is the final fallback in `mapError`                                         |
| ERR-05 | Body-derived strings are trusted only when `status > 0`                 | major   | read `mapError`: a `status === 0` body must not become the user-facing message                |
| ERR-06 | No raw `error.message` rendered in a production boundary                | blocker | `find src/app -name 'error.tsx' -o -name 'global-error.tsx' \| xargs grep -n 'error.message'` returns nothing (globstar is off in a default POSIX shell, so a `**` glob silently matches nothing) |
| ERR-07 | `global-error.tsx` renders its own `<html>`/`<body>` with inline styles | major   | read the file; no imported stylesheet, no app provider                                        |
| ERR-08 | Boundary tiers exist: global + per route group                          | major   | `find src/app -name 'error.tsx' -o -name 'global-error.tsx'` covers every group               |
| ERR-09 | `not-found.tsx` exists wherever `notFound()` is called                  | minor   | `grep -rln "notFound()" src` ⇒ each route tree has a `not-found.tsx` above it                 |
| ERR-10 | Dev logging is guarded by one `NODE_ENV` constant                       | major   | `grep -rn "console\." src \| grep -v observability` returns nothing                           |
| ERR-11 | No empty catch; every swallow has a written reason and a narrow guard   | blocker | `grep -rnE "catch \{\}\|catch \(.*\) \{\}" src` returns nothing                                      |
| ERR-12 | Client-cache failures are visible in dev                                | minor   | the query client wires `logQueryError` / `logMutationError`                                   |

### C7 · Forms — `references/07-forms.md`

| ID     | Check                                                                | Sev   | How to verify                                                                          |
| ------ | -------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------- |
| FRM-01 | Each form's tier matches the decision table (action-state vs RHF)    | minor | simple server forms use `useActionState`; rich forms use RHF + resolver                  |
| FRM-02 | Field errors from the backend are bound into the form, not toasted   | major | failure paths call `setError` (or `applyFieldErrors`) with the normalized `fieldErrors`  |
| FRM-03 | Submit is disabled while pending; double-submit is impossible        | major | every submit button reads the pending flag                                               |
| FRM-04 | Inputs have label association, `aria-invalid`, and `aria-describedby`| major | the axe tests cover each form control                                                    |
| FRM-05 | Multi-step wizard drafts survive refresh/back (store, not lifted)    | minor | wizard state lives in a store, not in a parent component's `useState`                    |
| FRM-06 | Form schemas are separate from wire schemas, with explicit mappers   | major | see SCH-08; a mapper converts form values → write body                                   |
| FRM-07 | If RHF is used, the React Compiler is off **or** components are safe | major | symptom: `isValid`/`isDirty` stop updating and submit never enables. Check the config comment |

### C8 · State — `references/08-state-and-data-flow.md`

| ID     | Check                                                          | Sev     | How to verify                                                                            |
| ------ | -------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| STA-01 | No server data duplicated into a client store                  | blocker | read each store: fields mirroring an API record are the violation                          |
| STA-02 | No `useEffect` + `setState` data fetching                      | major   | `grep -rln "useEffect" src --include=*.tsx \| xargs -r grep -lE "fetch\(\|await "` is empty   |
| STA-03 | One `makeQueryClient()`: server-fresh, browser-singleton       | major   | `grep -rn "new QueryClient" src` hits only `common/lib/query-client.ts`                    |
| STA-04 | The query client is not created in `useState`                  | major   | read `providers.tsx`                                                                       |
| STA-05 | Retry policy does not retry 4xx                                | minor   | the default `retry` inspects the status                                                    |
| STA-06 | Devtools are gated out of production                           | minor   | `grep -rn "Devtools" src` — guarded by `NODE_ENV` or a dynamic import                      |
| STA-07 | SSR-prefetched keys match the client query keys exactly        | major   | both sides use `queryKeys`; a literal on either side is the violation                      |
| STA-08 | Persisted stores never read storage during render              | blocker | `grep -rnE "localStorage\|sessionStorage" src --include=*.tsx` — all inside effects/hydrate |
| STA-09 | `'use client'` sits at the leaves, not on page shells          | major   | `grep -rln "'use client'" src/app` returns nothing (or only `providers.tsx`)               |
| STA-10 | Sign-out clears the query cache and the stores                 | major   | the logout path calls `queryClient.clear()` and resets stores                               |
| STA-11 | Bootstrap identity resolves once above the tree, not per page  | minor   | a `*Sync` component is mounted once in the root/provider tree                              |

### C9 · Mocking and testing — `references/09-mocking-and-testing.md`

| ID     | Check                                                                 | Sev     | How to verify                                                                        |
| ------ | --------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| TST-01 | The app runs end to end with the backend switched off                 | major   | set the mock flag, stop the backend, exercise a real flow                              |
| TST-02 | Mocks are wired on **both** the browser and the server runtime        | major   | `instrumentation.ts` registers the node server behind a runtime guard                  |
| TST-03 | Mock code cannot enter a production build                            | blocker | the import is dynamic and gated on an env flag; check the build output                 |
| TST-04 | Handlers are backed by a real store with a deterministic seed         | major   | `src/mocks/db/` exists; handlers read/write it rather than returning literals          |
| TST-05 | Server-rendered HTML is not blanked while the worker boots            | major   | view-source on first load shows content                                                |
| TST-06 | `server-only` is aliased to a no-op in the test config                | major   | `grep -n "server-only" vitest.config.ts`                                               |
| TST-07 | jsdom polyfills for matchMedia/ResizeObserver/IntersectionObserver    | minor   | `grep -n "matchMedia" src/test/setup.ts`                                               |
| TST-08 | `clearMocks` + `restoreMocks` are on                                  | minor   | `grep -n "clearMocks\|restoreMocks" vitest.config.ts`                                  |
| TST-09 | Schemas, services, actions, hooks, and ds components each have tests  | major   | one `__tests__` per layer; count files                                                 |
| TST-10 | No `.skip` / `.only` committed                                        | major   | `grep -rnE "\.(skip\|only)\(" src` returns nothing                                      |
| TST-11 | Error paths (4xx/5xx) are exercisable on demand from the mock         | minor   | the mock supports deliberate error injection                                           |

### C10 · Routing and app shell — `references/10-routing-and-app-shell.md`

| ID     | Check                                                                     | Sev     | How to verify                                                                          |
| ------ | ------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| RTE-01 | Pages are thin: params + page-level fetch + composition + metadata         | major   | see BND-09                                                                               |
| RTE-02 | `params`/`searchParams`/`cookies()`/`headers()` are awaited               | blocker | `grep -rnE "cookies\(\)\.\|headers\(\)\.\|searchParams\." src` — no sync member access        |
| RTE-03 | Route groups separate chrome and error boundaries                        | minor   | `ls -d src/app/(*)/` shows purposeful groups, named for the area not the chrome           |
| RTE-04 | Request interception is `proxy.ts` (16.x) / `middleware.ts` (15.x), one only | major | exactly one of the two exists                                                            |
| RTE-05 | The proxy injects **request** headers, not response headers               | blocker | `grep -n "NextResponse.next({ headers" src/proxy.ts` returns nothing                      |
| RTE-06 | The proxy matcher excludes api/static/image assets                        | blocker | read `config.matcher`; a redirecting proxy over `/api` corrupts handler payloads          |
| RTE-07 | Private routes come from one declarative list                             | major   | `src/common/config/private-routes.ts` is the only source                                  |
| RTE-08 | The sign-in redirect carries a return path                                | minor   | the redirect URL includes the originating path                                            |
| RTE-09 | Slow content is behind `loading.tsx` or `<Suspense>` with real skeletons  | major   | every data-fetching segment has one; fallbacks match the content shape                    |
| RTE-10 | No raw `<img>` for content images                                         | major   | `grep -rn "<img " src` returns nothing                                                    |
| RTE-11 | Remote image patterns are an allowlist driven by env                     | minor   | `next.config.*` builds `remotePatterns` from a validated variable                         |
| RTE-12 | `metadataBase` set; dynamic routes export `generateMetadata`             | minor   | `grep -rn "metadataBase" src/app/layout.tsx`                                              |
| RTE-13 | `sitemap.ts` and `robots.ts` exist for public sites                       | minor   | `ls src/app/sitemap.ts src/app/robots.ts`                                                 |
| RTE-14 | Every parallel-route `@slot` has a `default.tsx`                          | major   | `for d in $(find src/app -type d -name '@*'); do test -f "$d/default.tsx" \|\| echo "$d"; done` |

### C11 · Tooling and gates — `references/11-tooling-and-gates.md`

| ID      | Check                                                                | Sev     | How to verify                                                                        |
| ------- | -------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| TOOL-01 | No build-error suppression in the framework config                   | blocker | `grep -rnE "ignoreBuildErrors\|ignoreDuringBuilds" . --exclude-dir=node_modules` returns nothing                   |
| TOOL-02 | The full gate passes from a clean checkout                           | blocker | `npm ci && npm run typecheck && npm run lint && npm run build && npm run test`         |
| TOOL-03 | CI runs the same command SET as the local gate                       | blocker | compare the CI steps to the gate command list as a SET, not a sequence. Three deviations are sanctioned and must not be flagged: `typegen` prepended, `test` before `build`, `build-storybook` appended (A18) |
| TOOL-04 | Canonical script names are present and correct                       | major   | `dev build start lint lint:fix typecheck typegen test test:watch format format:check`  |
| TOOL-05 | TypeScript `strict` is on and `any` is a lint error                  | blocker | `grep -n '"strict": true' tsconfig.json`; `no-explicit-any` not disabled               |
| TOOL-06 | The `@/*` → `src/*` alias exists and matches the lint patterns       | blocker | `grep -n '"@/\*"' tsconfig.json`                                                       |
| TOOL-07 | No blanket `eslint-disable` file headers                             | major   | `grep -rnE "^/\* eslint-disable \*/\|@ts-nocheck" src` returns nothing                  |
| TOOL-08 | Each narrow disable carries a comment naming the false positive      | minor   | every `eslint-disable-next-line` has an adjacent reason                                |
| TOOL-09 | Husky pre-commit, commit-msg, and pre-push hooks are installed       | major   | `ls .husky`                                                                            |
| TOOL-10 | Commit messages are linted (conventional type enum, scoped)          | minor   | a bad message is rejected                                                              |
| TOOL-11 | `.env.example` documents every variable the app reads                | major   | diff the keys in `.env.example` against `grep -rho "process.env.[A-Z_]*" src \| sort -u`|
| TOOL-12 | Container build is multi-stage, standalone, non-root                 | minor   | read the `Dockerfile`                                                                  |
| TOOL-13 | Public env vars are passed as **build** args, not runtime env        | major   | they are inlined at build time; a runtime-only value arrives `undefined` in the browser|
| TOOL-14 | An agent-instructions file names the stack, the gate, and this skill | major   | `AGENTS.md` / `CLAUDE.md` exists and is current                                        |
| TOOL-15 | Every deliberately-disabled option records symptom + re-enable rule  | minor   | read the config comments                                                               |

---

### Scoring rubric

1. **Blockers are a gate, not a score.** Any unmet blocker ⇒ grade **F**, regardless of the rest.
   Report unmet blockers first, in severity-then-file order, with the failing command output.
2. **Weighted score** over the remaining items: major = 3, minor = 1, N/A excluded.

   ```
   score = (3 × majors_met + 1 × minors_met) / (3 × majors_applicable + 1 × minors_applicable)
   ```

3. **Grades** — A ≥ 0.90 · B ≥ 0.75 · C ≥ 0.60 · D < 0.60.
4. **Report format** — for each unmet item: ID, severity, the command and its output, the smallest
   fix, and the Part B phase that owns it. Do not filter findings by confidence; list uncertain
   ones and mark them.
5. **Grade ≠ done.** A grade-A repo with an unmet blocker is a failing repo. A grade-C repo with no
   blockers is safe to build on and has a clear P-phase backlog.

---

## Anti-patterns

| Never do this                                                                  | Because                                                                                                     | Do this instead                                                                              |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Start a greenfield project with the first feature and add lint zones "later"    | Every violation written before the rule becomes load-bearing; the retrofit is a project, not a commit          | Declare the enforcer with an empty `MODULES` array in step A3                                |
| Leave build-error suppression on "until we have time"                          | Every audit, gate, and test result afterwards is fiction — you cannot measure a codebase that cannot fail      | Remove it in P0 and burn the errors down behind narrow, commented disables                   |
| Migrate one concern across all modules at once                                  | Nothing is shippable until the last file lands, and a revert takes the whole app with it                       | Migrate module by module; each finished module ships                                          |
| Run both the old and new data layer "during the transition"                     | Two sources of truth for auth and caching produce bugs neither layer can explain                               | Delete the old path in the same phase that completes the new one                              |
| Copy a template file and leave its `TODO(project):` markers                     | The marker is an unmade decision; the default is right for no project                                          | Resolve every marker before the phase gate                                                    |
| Add a `common/` helper for its first caller                                     | `common/` fills with single-use code and becomes a god-module with better branding                            | Promote on the second consumer                                                                |
| Fix a `common → modules` import by moving the module code into `common/`        | It smuggles feature knowledge into the shared layer and the cycle returns under a new name                    | Invert with a prop or a slot; promote only the genuinely shared part                          |
| Skip the gate because "it's only a rename"                                      | Renames are exactly what breaks barrels, aliases, and generated route types                                    | Gate every phase, including the mechanical ones                                               |
| Combine a structural phase with a feature or a redesign                         | The bisect is useless and the reviewer cannot separate "moved" from "changed"                                  | Behavior-freeze P0–P2; ship features between phases, never inside one                         |
| Score the audit and stop                                                        | The score is a communication device; unmet blockers are the actual output                                      | Fix blockers first, then hand the weighted list to the owning Part B phase                    |
| Write the project agent file as a second architecture doc                       | Two sources of architecture drift, and agents read the shorter one                                             | Keep it to stack, gate, skill pointer, and project-specific bans                              |
| Turn on the enforcer for every module at once on a legacy repo                  | Hundreds of errors land in one commit, nobody can review it, and someone disables the rule                    | Add one name to `MODULES`, fix, commit; repeat                                                |
