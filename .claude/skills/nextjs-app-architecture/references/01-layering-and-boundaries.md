# The three-layer contract: app / modules / common

**Read this when:** you are deciding where a new file goes, an import was rejected by lint and you
need to know why, two features want the same helper, or you are creating or deleting a module.

This is the load-bearing rule of the architecture: every file in `src/` belongs to exactly one of
three layers, and dependencies flow one way only. Get this right first — every later decision
(where a service lives, what a barrel exports, which folder a promoted helper lands in) is a
consequence of it. Boundaries that live only in a README rot within weeks, so §7 points at the
ESLint config that makes violations impossible to merge.

> **Versions.** Every example leads with the **Next.js 16** form; the 15.x equivalent is given
> inline wherever they differ. Zod examples are **zod 4** (see `references/05-contracts-and-schemas.md`
> for the zod 3 spellings).

## Invariants

- **Dependency direction is one-way: `app → modules → common`.** Never upward, never sideways.
- **No cross-module imports, ever** — not even type-only ones. Shared code is _promoted_ to
  `common/`, never borrowed sideways.
- **A module's `index.ts` barrel is its entire public API.** Outside code imports
  `@/modules/<name>` and never `@/modules/<name>/anything`.
- **`common/` imports nothing from `modules/` or `app/`.** If a shared thing needs feature
  knowledge, invert it with a prop/slot instead of importing.
- **`app/` is routing and composition only** — parse params, fetch page-level data, compose module
  exports, export metadata. No domain JSX, no business logic, no mappers.
- **A module is a unit of deletion.** `rm -rf src/modules/<name>` + delete its routes + delete its
  lint entry must leave the app compiling. If it doesn't, the boundary is already broken.
- **Every boundary rule is machine-enforced** in `eslint.config.mjs`, generated from a `MODULES`
  array so the contract cannot drift as modules are added.
- **Every restriction carries a `message` that teaches the fix**, not just "forbidden".
- **Cross-layer imports use the `@/` path alias**; relative imports never climb out of their own
  module or folder subtree.
- **A module's own files import each other relatively**, never through their own barrel
  (circular-import trap).
- **Promote on the second consumer, not the first** — a `common/` full of single-caller helpers is
  a god-module wearing a different hat.
- **Design-system layering:** product code imports `common/components/{ds,form}`, never
  `common/components/ui/*` directly.

## 1. The three layers

| Layer                 | Contains                                                                                                                                                            | Must never contain                                                               | May import                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `src/app/`            | Route files only: `page/layout/loading/error/not-found/route/default/template`, `metadata`/`generateMetadata`, segment config, `sitemap.ts`, `robots.ts`, providers | Domain components, forms, mappers, stores, schemas, `useState` logic             | module **barrels** + any of `common/` (except `ui/`)      |
| `src/modules/<name>/` | One self-contained vertical feature area: its screens, actions, hooks, stores, schemas, module-private services, data, icons, types                                 | Anything another module needs (promote it), any import from `app/`               | its **own** subtree (relative) + `common/` (except `ui/`) |
| `src/common/`         | Everything shared and domain-agnostic: design system, server data layer, session, error mapping, utilities, config, cross-cutting stores                            | Any knowledge of a specific feature module; any import from `modules/` or `app/` | itself only                                               |

Root-level files (`src/proxy.ts`, `src/instrumentation.ts`) sit outside the three layers and may
import `common/` only — they run before/around routing and must not depend on any feature. What
each layer's folders are *for* is detailed in the guide that owns them:
`common/components/{ui,ds,form,variants}` → `references/02-design-system.md`;
`common/services` + `common/config` → `references/03-server-data-layer.md`;
`common/schemas` → `references/05-contracts-and-schemas.md`; `common/errors` →
`references/06-error-system.md`; `common/{stores,api,lib}` →
`references/08-state-and-data-flow.md`; `app/` and `proxy.ts` →
`references/10-routing-and-app-shell.md`.

> **Version note.** `proxy.ts` is the Next.js 16 name for request interception; on 15.x the same
> file is `middleware.ts` with an exported `middleware()` function. Everything below is otherwise
> identical on 15.x/16.x.

### The layer smell test

Ask, in order:

1. _Is this a URL?_ → `app/`. Nothing else goes there.
2. _Would a different product in a different domain want this verbatim?_ → `common/`.
3. _Otherwise_ → the one module that owns the feature. If two modules want it, go to §6
   (Promotion) — do **not** import sideways.

## 2. Canonical `src/` tree

Create only the folders a module actually needs; empty scaffolding directories are noise. Every
line below is `mkdir`-able as-is.

```text
src/
├── app/                             # LAYER 1 — routing + composition only
│   ├── (site)/                      # route group: one chrome/area (parens = invisible in the URL)
│   │   ├── layout.tsx               # chrome for the group (navbar/footer shell)
│   │   ├── page.tsx                 # composes module exports; ~10-40 lines
│   │   ├── error.tsx                # 'use client' error boundary for the group
│   │   └── billing/                 # one folder per URL segment
│   │       ├── page.tsx             # awaits params/searchParams, delegates to the module
│   │       ├── loading.tsx          # renders a skeleton exported by the module barrel
│   │       └── error.tsx
│   ├── (auth)/                      # second group with different chrome (login, reset, …)
│   ├── api/<resource>/route.ts      # HTTP endpoints for external/non-RSC consumers only
│   ├── layout.tsx                   # root layout: <html>/<body>, fonts, providers
│   ├── providers.tsx                # 'use client' provider tree (query client, theme, …)
│   ├── global-error.tsx             # root error boundary (renders its own <html>/<body>)
│   ├── not-found.tsx
│   ├── sitemap.ts robots.ts         # metadata routes
│   └── opengraph-image.tsx          # static/generated OG image
├── proxy.ts                         # request interception: auth gating, session rotation (v15: middleware.ts)
├── instrumentation.ts               # server startup hook: register() — mock server, tracing
├── common/                          # LAYER 3 — shared, domain-agnostic
│   ├── components/
│   │   ├── ui/                      # unstyled/generated primitives (shadcn-style). PRIVATE: only ds/form may import
│   │   ├── ds/                      # the branded design system: Button, Input, Dialog… built on ui/
│   │   ├── form/                    # form-bound wrappers around ds/ (RHF-aware field components)
│   │   ├── variants/                # cva variant definitions shared by ui/ and ds/
│   │   ├── layout/                  # Navbar, Footer, page shells (feature-agnostic; use slots for feature bits)
│   │   ├── feedback/                # ErrorState, LoadingState, EmptyState
│   │   ├── loader/                  # Skeleton primitives + spinners
│   │   └── <shared-feature>/        # UI promoted from ≥2 modules (e.g. auth card, file picker)
│   ├── services/                    # SERVER-ONLY data layer: http.ts, api-client.ts, session.ts, <resource>-service.ts
│   ├── schemas/                     # zod schemas per backend resource + shared envelopes/enums
│   ├── actions/                     # 'use server' actions any layer may call (session, lookups)
│   ├── api/                         # client-side query keys + queryOptions factories
│   ├── stores/                      # app-wide client state (session, active profile) — never server data
│   ├── hooks/                       # reusable client hooks (useX.ts, one per file)
│   ├── lib/                         # framework glue: query-client, cn(), instrumentation helpers
│   ├── utils/                       # pure functions, no React, no I/O
│   ├── config/                      # env.ts (zod-parsed), route lists, feature flags
│   ├── constants/                   # frozen literal tables (socials, timeouts)
│   ├── types/                       # shared TS types not derived from a schema + ambient .d.ts
│   ├── errors/                      # error normalization: map-error.ts, messages.ts, types.ts + index.ts
│   ├── observability/               # dev logging, query logging
│   ├── validators/                  # reusable field validators shared by schemas
│   ├── icons/{outline,solid,brand}/ # shared SVG components
│   └── stories/                     # page/flow-level Storybook stories
├── modules/                         # LAYER 2 — one folder per vertical feature area
│   ├── billing/
│   │   ├── index.ts                 # THE PUBLIC API. Everything else here is private.
│   │   ├── components/              # screens + sections; sub-folders per screen
│   │   ├── actions/                 # 'use server' mutations (<entity>-actions.ts)
│   │   ├── hooks/                   # client hooks incl. queries.ts (queryOptions factories)
│   │   ├── schemas/                 # module-private zod (form schemas, wizard steps)
│   │   ├── stores/                  # module-private client state (wizard step, filters)
│   │   ├── data/                    # static content tables (copy, option lists)
│   │   ├── lib/                     # pure view-model mapping (API shape → render shape)
│   │   ├── icons/                   # module-local SVGs + index.ts re-export
│   │   ├── types.ts                 # module-wide types (or types/ if it outgrows one file)
│   │   └── __tests__/               # colocated next to the code under test
│   ├── catalog/
│   ├── accounts/
│   └── dashboard/                   # a module with sub-areas — see §5
│       ├── index.ts                 # ONE barrel for the whole boundary module
│       ├── overview/{components,index.ts}
│       └── reports/{components,hooks,index.ts}
├── mocks/                           # request-mocking front-db: handlers/, db/, browser.ts, node.ts
└── test/                            # test setup files, ambient test types
```

`tsconfig.json` must define the alias the whole contract is written against:

```json
{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }
```

## 3. The dependency rule

```text
   app/  ──────────►  modules/  ──────────►  common/
    │                                          ▲
    └──────────────────────────────────────────┘
        (app may import common directly)

   FORBIDDEN:  modules/a ──► modules/b        common/ ──► modules/
               modules/ ──► app/               common/ ──► app/
```

What each violation actually costs:

| Violation                     | Concrete failure it causes                                                                                                                                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `modules/a → modules/b`       | Cycles form the moment `b` needs anything back (`a↔b` import cycles produce `undefined` at module-init time in ways that only reproduce in the production bundle). Deleting `b` breaks `a`. Two features become one un-testable blob.                                                      |
| `common → modules`            | `common/` stops being reusable: a "shared" navbar that imports a feature store cannot render on any page that doesn't ship that feature, and pulls the whole feature's client bundle into every route. It also inverts the graph, so lint/tsc can no longer tell you what depends on what. |
| `modules → app`               | Modules become unrunnable outside this exact routing tree — no Storybook, no unit tests, no reuse. Route-file changes ripple into feature code.                                                                                                                                            |
| Deep import past a barrel     | Every internal file becomes de-facto public. Renaming a component is a repo-wide diff, so nobody renames anything and the module's internals ossify.                                                                                                                                       |
| Type-only cross-module import | The same coupling as a value import (the type is a contract), and it is a one-line change away from becoming a value import.                                                                                                                                                               |

`app/` importing `common/` directly is **allowed and normal** — layouts render `common/components/layout`
chrome, pages call `common/services` for page-level reads.

## 4. The barrel rule

A module's `index.ts` _is_ its public API. Everything not exported there is private by omission.

```ts
// src/modules/billing/index.ts
/**
 * Public API of the `billing` module. The `(site)/billing` routes compose these screens;
 * the forms, wizard store, mappers, and schemas stay private behind this barrel.
 */
export { InvoiceBoard } from './components/core/InvoiceBoard';
export { InvoiceBoardSkeleton } from './components/core/InvoiceBoardSkeleton';
export { PaymentMethodDialog } from './components/PaymentMethodDialog';

// Server-prefetch contract: the route prefetches these into the query cache and hydrates
// them to the module's client hooks. Exporting the *options*, not the hook, keeps the
// fetching policy owned by the module.
export { invoicesOptions, paymentMethodsOptions } from './hooks/queries';

// Server Actions are RPC stubs and are safe to re-export to any consumer.
export { cancelInvoiceAction } from './actions/invoice-actions';

// Types the route layer needs to annotate props it forwards.
export type { Invoice, InvoiceStatus } from './types';
```

| Belongs in the barrel                                               | Stays private                                   |
| ------------------------------------------------------------------- | ----------------------------------------------- |
| Screen/section components a route composes                          | Sub-components, layout fragments, cells         |
| The module's skeleton components (routes' `loading.tsx` needs them) | Internal skeleton pieces                        |
| `queryOptions` factories the route prefetches                       | The hooks that consume them, the query keys     |
| Server Actions callable from another layer                          | Module-private services and fetchers            |
| Types that appear in exported component props                       | Form schemas, mappers, stores, icons, constants |

Hard rules:

- **Never `export *` from an internal folder** (`export * from './components'`) — it re-publishes
  every future file automatically, which is the exact opposite of a public API. The one legal
  `export *` is re-exporting a _curated sub-area barrel_ (§5).
- **A module's own files import each other relatively** (`../hooks/queries`, `./InvoiceRow`),
  never `@/modules/billing`. Importing your own barrel creates a cycle
  (`index → component → index`) whose symptom is an `undefined` export at runtime, only in the
  production build.
- **Do not re-export `server-only` code** (service modules, anything touching `cookies()`) from a
  barrel that Client Components import. The barrel is one module graph node: a client import of
  it drags every re-exported file into the client compilation and the build fails on
  `server-only`. Export the _action_, not the service.
- **Keep the doc comment.** One 3-line header per barrel stating what the module is and what stays
  private is the cheapest available defense against the next agent deep-importing.
- Folder-level barrels _inside_ `common/` (e.g. `common/errors/index.ts`) are fine and encouraged —
  they are curated and their consumers are in the same layer.

## 5. Sub-areas inside one boundary module

Sometimes one feature area legitimately contains several sub-features that must reference each
other (a report screen that reads the selection state of the overview screen). Model this as **one
boundary module with internal sub-areas**, not as two modules:

```text
modules/dashboard/
├── index.ts                 # the ONE public API for the whole boundary
├── overview/
│   ├── index.ts             # curated sub-barrel (private to the module, used by siblings)
│   └── components/…
└── reports/
    ├── index.ts
    └── components/…
```

```ts
// src/modules/dashboard/index.ts
/**
 * Public API of the `dashboard` boundary module. `overview` and `reports` are internal
 * sub-areas that may depend on each other (reports read the overview's selected range),
 * so they are one boundary and share this single barrel.
 */
export * from './overview';   // legal: re-exporting a curated sub-barrel
export * from './reports';
```

- **One boundary module = one entry in the lint `MODULES` array = one barrel.** Sub-areas get no
  lint entries; they are free to import each other relatively.
- Sub-areas import each other **relatively** (`../overview/hooks/use-range`), never via `@/modules/dashboard`.

**Split into two modules instead when all three hold:** (a) neither sub-area imports the other,
(b) they are owned/changed independently, (c) you could delete one and ship. If a "cycle" between
two candidate modules is the only reason to merge them, first check whether the shared thing is
really infrastructure — promoting it to `common/` often dissolves the cycle and lets both stay
separate. A cycle between two session-ish modules almost always means they are one flow.

## 6. Promotion: what to do when two modules need the same thing

Never `import { thing } from '@/modules/other'`. Run this procedure instead:

1. **Confirm the second consumer is real.** One consumer = leave it in the module. Promotion on
   speculation is how `common/` becomes a junk drawer.
2. **Strip the domain.** Rename parameters and types so the extracted unit knows nothing about
   either module (`formatInvoiceDate` → `formatDate(value, options)`). If you cannot strip the
   domain, the thing is not shared infrastructure — go to step 6.
3. **Move it** to the `common/` folder chosen by the table below, `git mv` in its own commit with
   no logic change, so the review diff is a pure move.
4. **Rewrite both modules' imports** to `@/common/...` and delete the original.
5. **Run the type checker** — `tsc --noEmit` is the truth for a missed import, not the dev server.
6. **If the domain cannot be stripped** (a shared _layout_ component that needs feature state),
   invert the dependency instead of moving code: give the `common/` component a `ReactNode` slot
   prop and let the `app/` layer inject the module's component into it. The arrow becomes
   `app → modules`, which is legal.

```tsx
// common/components/layout/Navbar.tsx — knows nothing about any feature
export function Navbar({ accountSlot }: { accountSlot?: React.ReactNode }) {
  return (
    <nav>
      <Logo />
      <div className="ms-auto">{accountSlot}</div>
    </nav>
  );
}

// app/(site)/layout.tsx — the only layer allowed to know both sides
import { Navbar } from '@/common/components/layout/Navbar';
import { AccountMenu } from '@/modules/accounts';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header><Navbar accountSlot={<AccountMenu />} /></header>
      <main>{children}</main>
    </>
  );
}
```

The alternative to a slot, when the shared state is genuinely cross-cutting (session, active
tenant, theme): promote the **state itself** to `common/stores` + `common/actions`, so both the
shared chrome and every module read it from the same place, and no module owns it.

### Where in `common/` it lands

| The thing you promoted                                      | Destination                                                                      |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Pure function, no React, no I/O                             | `common/utils/<kebab-name>.ts`                                                   |
| React hook                                                  | `common/hooks/useThing.ts`                                                       |
| zod schema describing a backend resource                    | `common/schemas/<resource>.ts`                                                   |
| Server fetch of a backend resource                          | `common/services/<resource>-service.ts`                                          |
| `'use server'` mutation any layer may call                  | `common/actions/<topic>.ts`                                                      |
| Query key / `queryOptions` factory used by ≥2 modules       | `common/api/`                                                                    |
| Cross-cutting client state                                  | `common/stores/<topic>-store.ts`                                                 |
| Branded reusable UI built from primitives                   | `common/components/ds/`                                                          |
| A multi-component shared _feature_ UI (auth card, uploader) | `common/components/<feature>/`                                                   |
| Unstyled primitive (generated)                              | `common/components/ui/` — product code must never import it                      |
| Route lists, env access, feature flags                      | `common/config/`                                                                 |
| Frozen literal tables                                       | `common/constants/`                                                              |
| Types not derived from a schema                             | `common/types/` (schema-derived types stay `z.infer` exports in the schema file) |
| Error normalization / message mapping                       | `common/errors/`                                                                 |

## 7. Mechanical enforcement (ESLint flat config)

This is the part most projects skip, and it is exactly why their boundaries rot. Generate one
zone per module from a single array so the contract cannot drift when modules are added.

**The config is a template, not a snippet: copy `templates/config/eslint.config.mjs` to
`<repo-root>/eslint.config.mjs`.** It is the single canonical copy — no guide restates it, because
a second copy of a rule is a rule that will disagree within a month. Three edits are required on
arrival:

1. Set `MODULES` to your real module list. **On a new project that is `[]`** — an empty array is
   correct and is the single most important ordering decision in the file, because a module added
   without an entry has no boundary rules at all and lint stays green forever.
2. Delete the sample `jsx-a11y/alt-text` override block. It is scoped to a path your project does
   not have; it is there as the *shape* of a legitimate override (files / rule / why it is wrong
   **here**), not as a rule for your app.
3. Delete the `eslint-plugin-storybook` import and its spread if the project has no component
   workshop, and the `NO_MOCKS` const plus Zone E if it has no mock layer. Both are marked in the
   file.

### The zones it declares

| Zone | Files                                        | May import                                                            |
| ---- | -------------------------------------------- | --------------------------------------------------------------------- |
| A    | `src/modules/<name>/**` (one per `MODULES`)  | itself + `common/` (not `ui/`); no other module, no `app/`, no mocks   |
| B    | `src/common/**`                              | itself only; no `modules/`, no `app/`, no `ui/` from outside, no mocks |
| C    | `common/components/{ui,ds,form}/**`, stories | as B, **plus** `ui/` — the primitives exemption                       |
| D    | `src/app/**`                                 | module **barrels** only + `common/` (not `ui/`); no mocks             |
| E    | `src/app/providers.tsx`                      | as D, **plus** the mock layer via `await import()` (optional)         |

Zones C and E exist only to *widen* one ban. Because of the replace-not-merge trap below, each of
them restates every other ban verbatim.

### The flat-config gotcha that silently disables your rules

Flat config **replaces** a rule's options for every later block that matches a file; it does not
merge them. A file under `src/common/components/ds/` matches both Zone B and Zone C, and the
_last_ one wins outright. If Zone C listed only the `ui/` allowance and omitted the modules/app
patterns, `ds/` would have silently become free to import feature modules — with a green lint run.
**Every scope must declare its complete pattern set.** The template keeps the shared pattern
objects (`NO_APP`, `NO_MODULES_FROM_COMMON`, `DS_ONLY`, `NO_MOCKS`) in consts so restating is one
identifier, not a copy-paste that drifts. Use those exact names —
`references/02-design-system.md` §1 and the audit checklist refer to them.

Legacy `.eslintrc` has the same hazard: a later `overrides[]` entry redefining the same rule
replaces its options rather than merging them.

### The one caveat that changes how you write imports

**`no-restricted-imports` matches the specifier string, not the resolved file.** A relative escape
(`../../modules/catalog/x`) is invisible to it. Therefore cross-layer imports **must** use `@/`,
and any `../` that climbs out of the current module or folder subtree is a review failure — the
rule cannot catch it for you.

The remaining caveats (type-only imports still count; dynamic-`import()` coverage varies by ESLint
version; landing the rules on an existing codebase at `error` behind a temporary burn-down list)
are documented in the template's trailing comment block. Read it once before editing the file.

## 8. Naming & file conventions

| Kind                                     | Convention                                                                                              | Example                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Hand-written component file              | `PascalCase.tsx`, export name matches the filename                                                      | `components/core/InvoiceBoard.tsx`                          |
| Generated primitive (`ui/`)              | keep the generator's `kebab-case.tsx` — regeneration must not fight you                                 | `ui/dropdown-menu.tsx`                                      |
| Component folder                         | one folder per screen/section, `core/` for the screen entry points                                      | `components/core/`, `components/legal/`                     |
| Hook                                     | `useThing.ts`, one hook per file                                                                        | `hooks/useInvoiceTotals.ts`                                 |
| Query options / keys                     | `hooks/queries.ts` (module), `common/api/query-keys.ts` (shared)                                        |                                                             |
| Server Actions                           | `actions/<entity>-actions.ts`, `'use server'` at the top of the file                                    | `actions/invoice-actions.ts`                                |
| Service / util / schema / config / store | `kebab-case.ts`                                                                                         | `invoice-service.ts`, `format-date.ts`, `wizard-store.ts`   |
| Module-wide types                        | `types.ts` at the module root; grow to `types/` only when needed                                        | `modules/billing/types.ts`                                  |
| Schema-derived types                     | `export type Invoice = z.infer<typeof invoiceSchema>` in the schema file — never re-declared            |                                                             |
| Constants                                | `common/constants/<topic>.ts`; env-derived or route lists in `common/config/`                           | `config/private-routes.ts`                                  |
| Icons                                    | shared in `common/icons/{outline,solid,brand}/`; module-local in `modules/<m>/icons/` + `index.ts`      |                                                             |
| Tests                                    | `__tests__/` colocated beside the code under test; DS components may use `Component.test.tsx` sibling   | `modules/billing/actions/__tests__/invoice-actions.test.ts` |
| Stories                                  | `Component.stories.tsx` beside the component; page-level flows in `common/stories/`                     |                                                             |
| Route groups                             | named for the area/chrome owner, not an adjective: `(site)`, `(auth)`, `(admin)` — invisible in the URL |                                                             |

Never build a top-level mirrored `tests/` tree: colocated tests get deleted with the feature, a
mirror tree leaves orphans that fail months later.

## 9. Adding a new module — checklist

1. Add its name to `MODULES` in `eslint.config.mjs`. **First**, so the boundary exists before the
   first file does.
2. `mkdir src/modules/<name>` and create `index.ts` with the doc-comment header — even if it
   exports one component.
3. Create only the sub-folders you need now.
4. Add the route(s) under `app/`, importing only `@/modules/<name>`.
5. Run the gate — `npm run typecheck && npm run lint && npm run build && npm run test`
   (`references/11-tooling-and-gates.md` §1). Lint proves the boundary is live; add
   `import x from '@/modules/nope';` to one file in the new module once, confirm it errors with
   your teaching message, then revert it.

Deleting a module is the same list in reverse — and if `rm -rf` plus the route deletion doesn't
type-check clean, something was importing its internals and the barrel rule was already broken.

## 10. Anti-patterns

| Never do this                                                                            | Because                                                                                                    | Do this instead                                                       |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `import { x } from '@/modules/other'` inside a module                                    | Cycles, undeletable features, two features fused into one                                                  | Promote `x` to `common/` (§6) or invert with a slot                   |
| `import type { X } from '@/modules/other'`                                               | Same coupling; one keystroke from a value import                                                           | Move the type to `common/types/` or the shared schema                 |
| `import { Foo } from '@/modules/billing/components/Foo'` from `app/`                     | Makes every internal file public; renames become repo-wide diffs                                           | Export `Foo` from the module barrel deliberately                      |
| `export * from './components'` in a barrel                                               | Auto-publishes every future file; the public API becomes "whatever exists"                                 | List exports explicitly; `export *` only from a curated sub-barrel    |
| A module file importing its own barrel                                                   | `index → component → index` cycle → `undefined` export, production-only                                    | Import siblings relatively                                            |
| `common/` importing a feature store or feature constants                                 | Shared code stops being shared; pulls a feature bundle into every route                                    | Slot prop injected by `app/`, or promote the state to `common/stores` |
| Business logic, mappers, or domain JSX in `page.tsx`                                     | Route files become untestable, unreusable, and invisible to module ownership                               | Keep pages ~10-40 lines: params → data → compose module exports       |
| `PRIVATE_ROUTES`-style config living in a feature module                                 | The proxy and shared chrome need it, forcing a `common → modules` edge                                     | `common/config/<topic>.ts`                                            |
| A new module added without a `MODULES` entry                                             | It has _no_ boundary rules at all and lint stays green                                                     | Add the entry first (§9)                                              |
| A later flat-config block redeclaring `no-restricted-imports` with a partial pattern set | Silently disables every earlier restriction for those files                                                | Restate the complete set via shared const pattern objects             |
| Landing boundary rules as `warn`, or with a permanent allowlist                          | Warnings accumulate forever; the contract is decorative                                                    | `error` + a temporary per-file disable list you burn down             |
| `../../common/...` or `../../modules/...` relative escapes                               | Evades `no-restricted-imports`, which matches the specifier text                                           | `@/common/...`, `@/modules/<name>`                                    |
| Product code importing `common/components/ui/*`                                          | Bypasses the branded layer; regenerating a primitive silently restyles product screens                     | Import from `ds/` or `form/`                                          |
| Promoting to `common/` on the first consumer                                             | `common/` becomes a single-caller junk drawer nobody can navigate                                          | Promote on the second real consumer                                   |
| A `shared/` or `utils/` module under `modules/`                                          | It is a god-module: everything depends on it, nothing can be deleted, and the lint zones cannot express it | That is what `common/` is                                             |
