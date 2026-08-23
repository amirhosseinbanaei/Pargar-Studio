---
name: nextjs-app-architecture
description: 'A three-layer (app → modules → common) architecture contract for Next.js 15/16 App Router + TypeScript-strict applications, covering layering, the design system, the server data layer, Server Actions, schemas, errors, forms, state, mocking, routing and quality gates. Use when starting a new Next.js/React app; when adding a feature module, page, route, component, form, Server Action, API service, schema or store; when setting up project structure, module boundaries, a design system, a data layer or the CI gate; and when auditing or refactoring an existing App Router codebase.'
disable-model-invocation: false
---

# Next.js app architecture

**Start here — do not read a topic guide first.**

| You are…                                                          | Open                                             |
| ----------------------------------------------------------------- | ------------------------------------------------ |
| In an empty directory or a bare `create-next-app` output          | `references/12-adoption-playbook.md` **Part A**, execute A1 → A20 in order |
| Bringing an existing App Router app into this architecture        | `references/12-adoption-playbook.md` **Part B**, phases P0 → P8 |
| Scoring a repo before deciding anything                           | `references/12-adoption-playbook.md` **Part C**  |
| Doing one task in a project already on this architecture          | the routing table below                          |

The playbook tells you which guide to open at each step. Reading twelve guides front-to-back is
not the intended use of this skill.

One idea holds the whole thing together: **every rule is either machine-enforced or it does not
exist.** Boundaries live in `eslint.config.mjs`, contracts live in zod schemas parsed at the edge,
outcomes live in a discriminated `ActionResult`, and correctness lives in four commands that must
pass. Anything left to discipline drifts within a month.

## The invariants

Non-negotiable across every guide. Each is stated in full, with its reasoning, in the guide named.

- **Dependencies flow `app → modules → common`, one way, never sideways** (01) — the direction is
  what makes a module deletable.
- **No cross-module imports, not even type-only; a module is consumed through its `index.ts`
  barrel only** (01) — shared code is *promoted* to `common/`, never borrowed sideways.
- **`app/` is routing and composition only** (01, 10) — no domain JSX, no business logic, no
  mappers; a `page.tsx` past ~40 lines has absorbed a module's job.
- **Product code imports `ds/` and `form/`, never `ui/`; style lives in `variants/*.ts` and every
  class list terminates in `cn()`** (02) — `ui/` is regenerable, so anything you write into it dies
  at the next regeneration.
- **Design values live in one token layer; no colour literal in a component** (02) — a hex in a
  component is a value no theme, no dark mode and no rebrand can reach.
- **Each transport ring imports only the ring below: `services → api-client → http`** (03) —
  skipping a ring is how an unauthenticated or unparsed request gets shipped.
- **Every file that reads a token or talks to the backend imports `server-only`** (03) — a client
  import then fails the *build* instead of leaking a token in production.
- **The response is zod-parsed in exactly one place, `api-client`; nothing downstream casts** (03,
  05) — a cast is an unverifiable claim, `.parse()` is one the runtime enforces.
- **Components never call `fetch` and never build a URL** (03) — they call a service (server) or an
  action (client).
- **`session.ts` is the only module that touches auth cookies, and cookie writes happen only in
  Server Actions, Route Handlers and request interception** (03) — never during an RSC render.
- **Environment config is zod-parsed at import time; public vars are read by static property
  access** (03, 11) — a missing variable must fail at boot, not at the first user click.
- **A write Server Action RETURNS a discriminated `ActionResult`; it never throws for an expected
  failure** (04) — a throw is sanitized crossing the RPC boundary, destroying the status and body
  that rollback and field-error binding need. `toActionResult` normalizes server-side, `unwrap`
  client-side, and nothing else.
- **Every action re-validates its input and re-authorizes from the session, and never accepts a
  user/tenant/owner id as an argument** (04) — an action is a public HTTP endpoint; the UI that
  calls it is not a security boundary.
- **One exported hierarchical `as const` query-key factory per app** (04) — ad-hoc key strings
  collide across modules and silently cross-invalidate.
- **Types are derived with `z.infer`; read schemas are tolerant at the leaves and strict at the
  shape, write schemas are exact** (05) — one unanticipated `null` in one leaf otherwise blanks an
  entire route.
- **`mapError` is the only place a thrown value is interpreted, and exactly one shape
  `{ status, code, message, fieldErrors }` reaches the UI** (06) — extracted by duck-typing, never
  `instanceof`, because an error that crossed the RPC boundary is no longer an instance of anything.
- **Branch on `status`, `code`, or a named field key — never on message text** (04, 06) — messages
  get localized and copy-edited; string matching breaks silently.
- **State's home comes from the decision table, not from taste; Server Components are the default
  and `'use client'` sits on the leaf that needs it; server data never enters a client store** (08)
  — two copies of one record drift the moment either refetches.
- **Mock code is reachable only through a dynamic `import()` behind an env flag** (09) — a static
  import drags the seed data into the production bundle.
- **The request-interception layer is a coarse UX gate, never an authorization decision, and it
  injects REQUEST headers** (10) — `NextResponse.next({ headers })` sets response headers and
  breaks every Server Action.
- **The gate is `npm run typecheck && npm run lint && npm run build && npm run test`, and every
  suppression flag is banned** (11) — `ignoreBuildErrors`, `ignoreDuringBuilds`, `--no-verify`,
  blanket `eslint-disable`, `.skip` on a test you just broke.

## The canonical tree

```text
src/
├── app/            LAYER 1 — routes, layouts, boundaries, metadata. Composition only.
│   ├── (group)/    route groups = the app shell: one chrome + one error boundary per area
│   ├── api/        route handlers, for external/non-RSC consumers only
│   └── providers.tsx   the single client provider tree
├── proxy.ts        request interception (Next 16; `middleware.ts` on 15.x)
├── instrumentation.ts  server startup hook
├── modules/        LAYER 2 — one folder per vertical feature area, e.g. billing, catalog,
│                   accounts, dashboard. Each has index.ts (its entire public API),
│                   components/ actions/ hooks/ schemas/ stores/ lib/ __tests__/
├── common/         LAYER 3 — shared and domain-agnostic; imports nothing above it
│   ├── components/ ui/ (private primitives) → ds/ (public API) → form/ (RHF-bound)
│   │               plus variants/ layout/ feedback/ loader/
│   ├── services/   server-only data layer: http → api-client → <resource>-service, session
│   ├── schemas/    zod per resource + envelopes, helpers, enums
│   ├── errors/     map-error, messages, types + index barrel
│   ├── api/        query keys and queryOptions factories
│   ├── stores/     app-wide client state — never server data
│   └── config/ constants/ hooks/ lib/ utils/ types/ observability/ validators/ icons/
├── mocks/          the front-db: db/, handlers/, browser.ts, node.ts
└── test/           setup and ambient test types
```

## Routing table — read this before you write code

| If you are about to…                                                        | Read first                                          |
| --------------------------------------------------------------------------- | --------------------------------------------------- |
| Create a project (empty dir / fresh `create-next-app`)                      | `references/12-adoption-playbook.md` Part A         |
| Migrate an existing app                                                     | `references/12-adoption-playbook.md` Part B         |
| Audit a repo / produce a conformance score                                  | `references/12-adoption-playbook.md` Part C         |
| Add a feature module                                                        | `references/01-layering-and-boundaries.md` §9, then playbook A20 |
| Decide where a file goes, or fix an import lint rejected                    | `references/01-layering-and-boundaries.md`          |
| Add a page, layout, route group, `loading.tsx` or `error.tsx`               | `references/10-routing-and-app-shell.md`            |
| Change auth gating, metadata, sitemap, robots or image hosts                | `references/10-routing-and-app-shell.md` §6, §8, §9 |
| Add or restyle a component; choose a tier; fix a skeleton or an axe failure | `references/02-design-system.md`                    |
| Call a backend, add a service, wire env config, touch session cookies       | `references/03-server-data-layer.md`, then `05`     |
| Model a response or an action input; a `ZodError` blanked a route           | `references/05-contracts-and-schemas.md`            |
| Add a write: Server Action, mutation hook, cache invalidation               | `references/04-actions-and-mutations.md` (+ `07` if a form renders it) |
| Build a form, wizard or upload field; bind backend field errors             | `references/07-forms.md`                            |
| An error renders wrong, blank or as raw JSON; place an error boundary       | `references/06-error-system.md`                     |
| Decide where a piece of state lives; wire SSR prefetch/hydration; add a store | `references/08-state-and-data-flow.md` §1 table    |
| Run the app with no backend; mock an endpoint; write any test               | `references/09-mocking-and-testing.md`              |
| Repair the gate, CI, hooks, Docker, `.env.example` or script names          | `references/11-tooling-and-gates.md`                |

`references/README.md` carries the same twelve guides with a one-line "read this when" each.

## Templates

`templates/` holds copy-then-own files, and **it is the source of truth for every identifier,
signature and import path in this skill — where a guide's inline code disagrees with a template,
the template wins**, because the templates have been type-checked as a program and the guides were
written in parallel with them. `templates/src/**` are runtime modules (the error system, the four
transport rings, session, `action-result`, query keys, query client, `cn()`, the session store,
`providers.tsx`, `proxy.ts`, `instrumentation.ts`); `templates/config/**` are repository configs
(`tsconfig.json`, `eslint.config.mjs`, the gate scripts, `next.config.ts`, `env.example`, vitest,
husky, commitlint, CI, Docker, Storybook, `AGENTS.md.template`). Each file's target path is stated
in its first line or header comment. Do not invent a copy order: `templates/src/README.md` gives a
tier order in which nothing ever fails to resolve, and `templates/config/README.md` marks what is
required versus a real choice and which files are coupled pairs.

**Every `// TODO(project):` marker in a copied template is an unmade decision, and it must be
resolved before that step's gate.** The default is right for no project; leaving the marker is how
a template becomes cargo cult.

## The gate

```bash
npm run typecheck && npm run lint && npm run build && npm run test
```

All four pass, or the change is not done — not "mostly passes", not "fails on unrelated files".
Before the app has any routes, use the partial gate (`typecheck && lint`) and say so in the commit
body. Suppression is banned outright: `typescript.ignoreBuildErrors`, `eslint.ignoreDuringBuilds`,
`git commit/push --no-verify`, file-level or blanket `eslint-disable`, and `.skip`/`.only` on a
test you just broke. A narrow, single-rule, one-line disable with a comment naming the false
positive is the only sanctioned escape hatch.

## Using this skill

1. **New project** — `references/12-adoption-playbook.md` Part A, A1 → A20 in order. Read its
   anti-patterns table *before* A1; most of its rows are ordering mistakes that cost one commit at
   A3 and a project by A20. Gate at every step.
2. **Existing project** — Part C first for an objective gap list, then Part B phases P0 → P8. One
   phase, one commit, one gate; behaviour freeze during structural phases; delete the old path in
   the same phase the new one lands.
3. **One task** — find the row in the routing table, open that guide, read its Invariants box and
   the one section you need. Then run the gate.

## Version drift

The guides target Next.js 16 with the 15.x equivalent given inline, React 19, TypeScript strict,
zod 4 (zod 3 spellings in `references/05-contracts-and-schemas.md`) and Tailwind v4. When the
installed package and these guides disagree, **the installed package wins** — it is the thing that
runs — and the discrepancy should be reported rather than silently worked around.
