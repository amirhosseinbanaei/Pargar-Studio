# The mock backend and the testing pyramid

**Read this when:** the app must run with no backend, you are writing any test, a test cannot see
its `vi.mock`, or a request escaped to the real network.

One in-memory database behind request-level handlers, running identically in the browser, in the
Node server process, and in the test runner. It lets the whole frontend be built, demoed and tested
before a backend exists, and it is the same fixture the test suite runs against — so mock rot fails
CI instead of a demo.

> **Versions.** Every example leads with the **Next.js 16** form; the 15.x equivalent is given
> inline wherever they differ. Zod examples are **zod 4** (see `references/05-contracts-and-schemas.md`
> for the zod 3 spellings).

## Invariants

- **Mock data lives in exactly one typed store (the "front-db"), never in per-component fixture
  arrays.** Scattered arrays cannot model a write, so no mutation flow is ever exercised.
- **The store imports the same types the production services use.** A backend contract change then
  breaks the mock at `tsc`, not in a demo.
- **The seed is deterministic** — fixed ids, fixed ISO dates, no `Date.now()`, no `Math.random()`.
  Non-deterministic seeds produce tests that pass 95% of the time.
- **Handlers are registered against the real API base URL**, so the app's own services are the
  thing under test — never a stubbed transport.
- **The store module is pure and JSON-serializable.** No `window`, no `indexedDB`, no `Buffer`. It
  must load unchanged in the browser worker, the Node interceptor and the test runner.
- **Mock code is reachable only through a dynamic `import()` behind an env flag.** A static import
  from app code drags the entire mock tree — and its seed data — into the production bundle.
- **Server-side interception is registered in the framework startup hook, guarded to the Node
  runtime.** The interceptor cannot run on the edge runtime.
- **`onUnhandledRequest: 'bypass'` in the app, `'error'` in tests.** The app process makes framework
  fetches that must not 501; in tests an unhandled request is a missing handler, i.e. a bug.
- **Server-rendered HTML is never blanked while the worker boots.** Only client queries with no
  server-provided data gate on a readiness flag.
- **Any mock state that cannot live in the JSON store (a `Map`, a counter closure) exports its own
  reset function**, wired into the same `afterEach` as the store reset.
- **Every test file starts from a freshly reset store.** Test order must never matter.
- **Never assert against the mock by reaching into the store from the app side.** Assert through the
  same interface production uses.
- **`server-only` is aliased to an empty module in the test runner**, or no server code is testable.
- **Accessibility assertions run inside the normal test command**, not only in a component-explorer
  panel nobody opens in CI.

---

## 1. Why a front-db beats fixture arrays

| Per-component fixtures                                       | Front-db                                                                |
| ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Each component invents its own shape; they drift             | One typed store; drift is a type error                                  |
| Cannot model a write — "create" has nowhere to go            | POST/PATCH/DELETE mutate real rows; the next GET reflects them          |
| No relations — a deleted parent leaves orphan children       | Cascades are written once in the handler                                |
| Two developers see two different datasets                    | One seed, so screenshots and bug reports are comparable                 |
| Error paths untested (nobody hand-writes a 422 fixture)      | Fault injection returns real 4xx/5xx bodies on demand                   |
| Tests stub the transport, skipping URL building and parsing  | Tests exercise service → client → transport → schema, end to end        |

Canonical layout:

```text
src/
├── mocks/
│   ├── db/
│   │   ├── store.ts          # the typed database + nextId/resetDb/loadSnapshot
│   │   └── seed.ts           # deterministic seed data
│   ├── handlers/
│   │   ├── _shared.ts        # api()/ok()/paginate()/requireAuth()/fault injection
│   │   ├── accounts.ts       # one file per backend resource
│   │   ├── billing.ts
│   │   ├── catalog.ts
│   │   └── index.ts          # composes them in registration order
│   ├── browser.ts            # setupWorker(...handlers)
│   ├── node.ts               # setupServer(...handlers)
│   ├── init.ts               # startMocking() — the ONLY app-side touchpoint
│   ├── persist.ts            # optional browser persistence (dynamically imported)
│   └── __tests__/front-db.test.ts
├── instrumentation.ts        # server startup hook -> node interceptor
└── test/
    ├── setup.ts              # matchers, polyfills, mock lifecycle
    ├── empty-module.ts       # alias target for `server-only`
    └── vitest-axe.d.ts       # a11y matcher types
```

This guide uses MSW (`msw@2`) as the interceptor. Any request-level interceptor works; what is
architectural is *intercept at the network boundary, back it with a real store*.

---

## 2. Store design

```ts
// src/mocks/db/store.ts
/**
 * The front-db — a typed, in-memory database standing in for the real backend.
 * It imports the SAME domain types the services use, so the mock cannot drift
 * from the production contract without failing `tsc`.
 *
 * Pure and JSON-serializable: no `window`/`indexedDB` here (that lives in
 * `persist.ts`), so this module runs identically in the worker, the Node
 * interceptor and the test runner.
 */
import type { Account } from '@/common/schemas/account';
import type { Invoice, LineItem } from '@/common/schemas/invoice';
import type { Product } from '@/common/schemas/product';

/** A stored row may carry server-only fields the wire shape must never expose. */
export interface StoredAccount extends Account {
  passwordHash: string;
}

export interface Db {
  accounts: StoredAccount[];
  invoices: Invoice[];
  lineItems: LineItem[]; // children of an invoice — deleting a parent must cascade
  products: Product[];
  counters: { next: number };
}

export function createEmptyDb(): Db {
  return { accounts: [], invoices: [], lineItems: [], products: [], counters: { next: 10_000 } };
}

/** The singleton database, seeded on first import. */
export const db: Db = createEmptyDb();
seedDb(db);

/** Monotonic id generator, starting well above every seeded id. */
export function nextId(dbRef: Db): number {
  dbRef.counters.next += 1;
  return dbRef.counters.next;
}

/** Re-seed to the deterministic initial state. Called from `afterEach`. */
export function resetDb(): void {
  const fresh = createEmptyDb();
  seedDb(fresh);
  Object.assign(db, fresh); // mutate in place: handlers captured `db` by reference
}

/** Replace live contents from a persisted snapshot (browser hydrate only). */
export function loadSnapshot(snapshot: Db): void {
  Object.assign(db, snapshot);
}
```

Rules, and the failure each prevents:

- **`Object.assign(db, fresh)` — never `db = fresh`.** Handler modules imported the binding at load
  time; rebinding leaves them pointing at the old object and `resetDb()` silently does nothing.
- **Id counter starts above every seeded id.** Overlapping ids make a "created row" collide with a
  seeded one, and the resulting test failure looks like a handler bug.
- **Ids are monotonic across resets only within a run.** Because `resetDb()` rewinds the counter,
  any non-store state keyed by id (see §3) must be reset too, or a stale token from the previous
  test validates against a freshly reused id.
- **Model relations explicitly and cascade on delete.** The real backend has foreign keys; a mock
  that leaves orphans hides the bug where a list still renders children of a deleted parent.
- **Strip server-only fields at the handler boundary, not in the store.** Keeping `passwordHash` in
  the store is what makes a credential check possible at all; a `toPublic*` mapper keeps it off the
  wire.

```ts
// src/mocks/db/seed.ts — fixed ids, fixed dates, no randomness.
import type { Db } from './store';

export const DEMO_EMAIL = 'demo@example.com';
/** The demo password must satisfy the app's own registration rules, or it cannot be typed in. */
export const DEMO_PASSWORD = 'password1';

export function seedDb(db: Db): void {
  db.accounts = [{ id: 1, email: DEMO_EMAIL, name: 'Demo', tier: 'pro', passwordHash: DEMO_PASSWORD }];
  db.products = [
    { id: 101, name: 'Starter', priceCents: 900, active: true },
    { id: 102, name: 'Team', priceCents: 4900, active: true },
  ];
  db.invoices = [
    { id: 201, accountId: 1, productId: 101, status: 'paid', amountDue: 900, dueDate: '2024-01-31' },
    { id: 202, accountId: 1, productId: 102, status: 'open', amountDue: 4900, dueDate: '2024-02-29' },
  ];
}
```

Seed enough rows that pagination, empty states and long-text overflow are all reachable — a two-row
seed means the paginated list is never rendered in its real form.

---

## 3. Handler conventions

**One `_shared.ts` for URL building, envelopes, pagination, auth and faults.** Without it, every
handler file re-derives the base URL and re-invents the error body, and the shapes drift.

```ts
// src/mocks/handlers/_shared.ts
import { HttpResponse, delay, type HttpResponseResolver } from 'msw';
import { API_URL } from '@/common/constants/api';

/** Absolute URL for a backend path, so the interceptor matches the calls the app really makes.
 *  `API_URL` is already trailing-slash-normalized by `common/constants/api`, so paths passed
 *  here always start with `/` and the two never produce a double slash the matcher misses. */
export const api = (path: string) => `${API_URL}${path}`;

export const ok = (data: unknown, status = 200) =>
  HttpResponse.json(data as Parameters<typeof HttpResponse.json>[0], { status });

export const noContent = () => new HttpResponse(null, { status: 204 });

/**
 * Field-keyed validation errors, e.g. `{ email: ['already registered'] }`.
 * Match whatever shape your backend actually emits — many frameworks key errors by
 * field name; some wrap them in `{ errors: {...} }`. Mocking the WRONG shape is worse
 * than not mocking it: the error mapper is then never exercised against reality.
 */
export const fieldError = (fields: Record<string, string[]>, status = 400) =>
  HttpResponse.json(fields, { status });

export const notFound = (message = 'Not found') => HttpResponse.json({ message }, { status: 404 });
export const unauthorized = (message = 'Invalid credentials') =>
  HttpResponse.json({ message }, { status: 401 });

/** Envelope matching `paginated()` from `@/common/schemas/envelopes`. */
export function paginate<T>(rows: T[], request: Request, pageSize = 20) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const start = (page - 1) * pageSize;
  const withPage = (n: number) => {
    const next = new URL(url);
    next.searchParams.set('page', String(n));
    return next.toString();
  };
  return {
    count: rows.length,
    next: start + pageSize < rows.length ? withPage(page + 1) : null,
    previous: page > 1 ? withPage(page - 1) : null,
    results: rows.slice(start, start + pageSize),
  };
}

/** Returns a 401 response when the request carries no bearer token, else null. */
export function requireAuth(request: Request): Response | null {
  const header = request.headers.get('authorization');
  return header?.startsWith('Bearer ') ? null : unauthorized('Authentication required');
}
```

**One file per resource, one index that composes them — and registration order matters.**

```ts
// src/mocks/handlers/index.ts
import { accountHandlers } from './accounts';
import { billingHandlers } from './billing';
import { catalogHandlers } from './catalog';

/**
 * The full front-db request surface. Order matters: static paths (`…/summary/`) are
 * registered before their dynamic siblings (`…/:id/`), or the interceptor captures a
 * literal segment as a param and the wrong handler answers.
 */
export const handlers = [...accountHandlers, ...billingHandlers, ...catalogHandlers];
```

```ts
// src/mocks/handlers/billing.ts
import { http } from 'msw';
import type { Invoice } from '@/common/schemas/invoice';
import { db, nextId } from '../db/store';
import { persistDb } from '../persist';
import { api, fieldError, noContent, notFound, ok, paginate, requireAuth } from './_shared';

export const billingHandlers = [
  // Static path FIRST — `/summary/` would otherwise be captured as `:id`.
  http.get(api('/billing/invoices/summary/'), () =>
    ok({ open: db.invoices.filter(i => i.status === 'open').length }),
  ),

  http.get(api('/billing/invoices/'), ({ request }) => {
    const denied = requireAuth(request);
    if (denied) return denied;
    const status = new URL(request.url).searchParams.get('status');
    const rows = status ? db.invoices.filter(i => i.status === status) : db.invoices;
    return ok(paginate(rows, request));
  }),

  http.get(api('/billing/invoices/:id/'), ({ params }) => {
    const invoice = db.invoices.find(i => i.id === Number(params.id));
    return invoice ? ok(invoice) : notFound('Invoice not found');
  }),

  http.post(api('/billing/invoices/'), async ({ request }) => {
    const body = (await request.json()) as Omit<Invoice, 'id'>;
    // A real validation failure, so the field-error binding in forms is exercisable.
    if (!db.products.some(p => p.id === body.productId)) {
      return fieldError({ productId: ['Unknown product.'] });
    }
    const invoice: Invoice = { ...body, id: nextId(db) };
    db.invoices.push(invoice);
    await persistDb();
    return ok(invoice, 201);
  }),

  http.delete(api('/billing/invoices/:id/'), async ({ params }) => {
    const id = Number(params.id);
    db.invoices = db.invoices.filter(i => i.id !== id);
    db.lineItems = db.lineItems.filter(l => l.invoiceId !== id); // cascade, like a real FK
    await persistDb();
    return noContent();
  }),
];
```

**State the JSON store cannot hold gets its own reset export.** One-time codes, issued tokens and
rate-limit counters are naturally `Map`s, which do not survive `structuredClone` into persistence
and are therefore *not* cleared by `resetDb()`:

```ts
// src/mocks/handlers/accounts.ts
const resetTokens = new Map<string, string>();

/** Clears issued reset tokens. MUST be called alongside `resetDb()` in `afterEach`. */
export function resetAuthState(): void {
  resetTokens.clear();
}
```

Forgetting this is a specific, hard-to-diagnose bug: a token minted in test A stays valid in test B
while the id counter has rewound, so a "forged token must be rejected" assertion passes for the
wrong reason.

---

## 4. Latency and deliberate fault injection

The mock's job is not only to be fast and correct — it is to make loading states and error paths
reachable. Both are opt-in per request so the default run stays fast and green.

```ts
// src/mocks/handlers/_shared.ts (continued)
export type Fault = 'slow' | 'error' | 'invalid' | 'offline';

/**
 * A fault is requested per-request (`?__fault=error` or an `x-mock-fault` header) or
 * globally (`window.__mockFault = 'slow'` from the devtools console). Never make faults
 * random: a flaky mock produces flaky tests, and nobody trusts the suite again.
 */
const FAULTS: readonly string[] = ['slow', 'error', 'invalid', 'offline'];

function faultFor(request: Request): Fault | null {
  const value =
    new URL(request.url).searchParams.get('__fault') ??
    request.headers.get('x-mock-fault') ??
    (globalThis as { __mockFault?: string }).__mockFault;
  return value && FAULTS.includes(value) ? (value as Fault) : null;
}

/** Wrap a resolver so it honours fault requests and a baseline latency. */
export function faulty(resolver: HttpResponseResolver): HttpResponseResolver {
  return async info => {
    switch (faultFor(info.request)) {
      case 'slow':
        await delay(3_000); // long enough to see skeletons and cancel-on-unmount
        break;
      case 'error':
        return HttpResponse.json({ message: 'Something went wrong' }, { status: 500 });
      case 'invalid':
        return HttpResponse.json({ amountDue: ['Must be a positive number.'] }, { status: 422 });
      case 'offline':
        return HttpResponse.error(); // rejects like a real network failure
      default:
        await delay(120); // baseline: enough that pending states actually render
    }
    return resolver(info);
  };
}
```

Use `faulty()` on read handlers you want to demo failures for; wrap all of them if you want a
global chaos switch. Then:

- **In the browser**, type `window.__mockFault = 'error'` and reload — every screen's error
  boundary and retry affordance becomes reachable without touching code.
- **In tests, prefer a scoped override** to a global flag, because it is explicit and auto-reverts:

  ```ts
  server.use(http.get(api('/billing/invoices/'), () => HttpResponse.json(null, { status: 500 })));
  ```

  `server.resetHandlers()` in `afterEach` removes it. This is also how you test a 401→refresh→retry
  path: return 401 on the first call and 200 on the second from a counter in the test closure.
- **Baseline latency must be non-zero but small.** At 0 ms, promises resolve within the same tick,
  loading states never paint, and you ship a skeleton nobody has ever seen.

---

## 5. Booting on both runtimes

Two interceptors share one handler set: a Service Worker in the browser and a Node interceptor in
the server process.

```ts
// src/mocks/browser.ts
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/** Browser worker — intercepts client-side fetches. */
export const worker = setupWorker(...handlers);
```

```ts
// src/mocks/node.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** Node interceptor — intercepts Server Component / Route Handler / test fetches. */
export const server = setupServer(...handlers);
```

```ts
// src/mocks/init.ts
import { isMockEnabled } from '@/common/config/env';
import { hydrateDb } from './persist';

let started: Promise<void> | null = null;

/**
 * Start the browser worker exactly once. No-op unless mocking is enabled and we are in
 * the browser. This is the SINGLE app-side touchpoint of the mock layer — services,
 * pages and components never import anything under `src/mocks/`.
 */
export function startMocking(): Promise<void> {
  if (!isMockEnabled || typeof window === 'undefined') return Promise.resolve();
  if (started) return started; // React 18+ double-invokes effects in dev; without this the
  started = (async () => {   // worker registers twice and logs a confusing warning
    await hydrateDb();
    const { worker } = await import('./browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: '/mockServiceWorker.js' },
      quiet: true,
    });
  })();
  return started;
}
```

The server half is the framework startup hook: copy `templates/src/instrumentation.ts` and
uncomment its `await import('@/mocks/node')` block once `src/mocks/node.ts` exists. Its two guards
are both load-bearing and neither is optional:

| Guard | Omitting it |
| --- | --- |
| `process.env.NEXT_PUBLIC_API_MOCKING !== 'enabled'` — compared against a literal, never truthiness | `NEXT_PUBLIC_API_MOCKING=false` is a non-empty string, so a truthiness check enables mocks in production |
| `process.env.NEXT_RUNTIME !== 'nodejs'` | `register()` also runs on the edge runtime, where a Node interceptor cannot run at all — the edge instance throws at boot and every request 500s before any of your code executes |

The same file is where `onRequestError` goes when you add a server-side error tracker; the template
carries that skeleton commented out.

Version note — `instrumentation.ts` with an exported `register()` is stable in **Next.js 16** and in
15.x alike. On 14 it required `experimental: { instrumentationHook: true }` in the config. Nothing
about the mock layer changes between 15 and 16; `proxy.ts` (16) vs `middleware.ts` (15) is
orthogonal.

Rules:

- **`onUnhandledRequest: 'bypass'` in both app-side interceptors.** The server process also performs
  framework and RSC-payload fetches; `'error'` there turns a working dev server into a wall of 501s.
  Tests invert this — see §8.
- **The env flag is checked with a literal `process.env.NEXT_PUBLIC_*` read**, and the mock module
  is reached only via `await import()`. A static `import { worker } from '@/mocks/browser'` anywhere
  in app code pulls the entire seed dataset into the production client bundle, because bundlers
  cannot tree-shake a module whose side effect is `setupWorker(...)`.
- **Enforce that mechanically.** Only `src/mocks/**`, `src/instrumentation.ts`, `src/test/**` and
  the client provider file may reference `@/mocks/*`; add it to the boundary lint rules described in
  the layering guide (see `references/01-layering-and-boundaries.md`).
- **The worker script must be generated and committed** (`npx msw init public/`), and regenerated on
  every interceptor upgrade. A stale worker version silently fails to intercept and every request
  hits the real network.
- **The two interceptors share handler code but not state.** They are separate processes with
  separate `db` singletons. Therefore: *a dataset lives on exactly one side at a time.* When a
  resource's reads move server-side, its writes move in the same change — otherwise a client write
  updates the worker's copy while the server render reads the Node copy, and the UI "loses" writes.
- **Cached server functions capture mock data into cache entries.** After a mutation that skips
  cache invalidation, a cached read legitimately serves stale mock data. That is correct behaviour,
  not a mock bug — it exercises the same invalidation graph as production. Test invalidation
  *through* the actions, never by poking the store.

---

## 6. The mock-ready signal

**Never render nothing until the worker boots.** The obvious implementation — hold the whole tree
behind `if (!ready) return null` — throws away every server-rendered byte, so mock mode stops
testing the thing you built (streaming, SSR HTML, instant shells) and every screen flashes blank.

Render the markup immediately, and let only client queries that have *no* server-provided data wait.
Two templates carry the whole mechanism: `templates/src/common/lib/mock-ready.ts` (the context and
the `useMockReady()` hook) and the marked mock block in `templates/src/app/providers.tsx` (the
effect that starts the worker and flips the flag). Copy both, or delete both.

```ts
// the only call site: a client query with NO server-provided initial data
const mockReady = useMockReady();
const { data } = useQuery({ ...invoiceQuery(id), enabled: mockReady });
```

Four rules the code alone does not state:

- **The context defaults to `true`** — "nothing to wait for". Any tree *not* under the provider (a
  test, a workshop story, a component rendered in isolation) then behaves as if mocking is off
  instead of deadlocking on a flag nobody will flip.
- **`.finally`, never `.then`.** If the worker fails to register, the flag must still flip;
  otherwise every gated query stays permanently disabled and mock mode hangs with nothing on screen
  to explain it.
- **Never gate the render.** `if (!mockReady) return null` around the provider's children discards
  every server-rendered byte — see the top of this section.
- **Queries that hydrate from a server prefetch need no gate.** Their data is already present, and
  the revalidation that follows happens long after the worker booted. Server-side needs no gate at
  all: `register()` completes before the first request is served.

---

## 7. Persistence, and when it is a mistake

```ts
// src/mocks/persist.ts
/**
 * Optional browser persistence for the front-db, gated by its own env flag.
 * Browser-only and dynamically imported, so the pure store and the Node interceptor
 * never touch the storage library or `indexedDB`.
 */
import { isMockPersistEnabled } from '@/common/config/env';
import { db, loadSnapshot, type Db } from './db/store';

const SNAPSHOT_KEY = 'front-db-v1'; // bump the suffix when `Db` changes shape

const inBrowser = () => typeof window !== 'undefined' && typeof indexedDB !== 'undefined';

/** Load a persisted snapshot into the live store. Call before serving any request. */
export async function hydrateDb(): Promise<void> {
  if (!isMockPersistEnabled || !inBrowser()) return;
  const { get } = await import('idb-keyval');
  const snapshot = (await get(SNAPSHOT_KEY)) as Db | undefined;
  if (snapshot) loadSnapshot(snapshot);
}

/** Persist current contents; call after a mutating handler. */
export async function persistDb(): Promise<void> {
  if (!isMockPersistEnabled || !inBrowser()) return;
  const { set } = await import('idb-keyval');
  await set(SNAPSHOT_KEY, structuredClone(db));
}
```

| Persist when                                                  | Do **not** persist when                                              |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| Demoing a multi-session flow (onboarding resumed after reload) | Running tests — persistence defeats `resetDb()` and order matters     |
| Manually exercising a long wizard you do not want to re-enter  | The store holds non-clonable values (`Map`, `Set`, functions, `Date`) |
| A stakeholder needs their edits to survive a refresh           | Anyone might mistake persisted junk for a real bug                    |

`structuredClone` throws on functions and silently changes `Map`/`Set` round-trips; keep the store
JSON-shaped (see §2) or persistence will corrupt it. Default the flag to **off** — a stale snapshot
from three schema versions ago is the single most confusing failure this system produces, and the
fix ("clear site data") is undiscoverable. Do not build filesystem persistence for the server-side
interceptor; accept that server state resets with the dev server, and say so in the README.

---

## 8. Test configuration

Three templates, copied verbatim:

| Template                             | Target path                | What it is                                                        |
| ------------------------------------ | -------------------------- | ------------------------------------------------------------------ |
| `templates/config/vitest.config.ts`  | `<repo-root>/vitest.config.ts` | Runner config: jsdom, the `@` alias, the `server-only` alias    |
| `templates/config/test-setup.ts`     | `src/test/setup.ts`        | Matchers, jsdom gap stubs, and the interceptor lifecycle           |
| `templates/config/test-empty-module.ts` | `src/test/empty-module.ts` | The alias target for `server-only`                               |

Six decisions inside them, and the failure each prevents:

| Decision | Why |
| --- | --- |
| `resolve.alias` mirrors `tsconfig` `paths` **exactly** | The runner does not read `tsconfig`. A missing alias surfaces as "cannot resolve module '@/…'", which reads like a typo in the import rather than a config gap |
| `server-only` aliased to an empty module | The package throws by design outside a server bundle. Without the alias, every server service, session helper and Server Action fails at load before a single assertion runs — while in the app the same import stays load-bearing, failing the build if a Client Component pulls it in |
| `clearMocks` + `restoreMocks` | A `vi.spyOn` left patched leaks into another file and produces a failure that only reproduces when the whole suite runs in that order |
| `css: false` | Parsing CSS costs seconds per run and nothing asserts on computed styles |
| Every jsdom stub is **feature-guarded** (`if (!('ResizeObserver' in globalThis))`) | A future jsdom that ships the real API must win over the no-op, or you silently test the stub forever |
| `onUnhandledRequest: 'error'` in `beforeAll` | This **inverts** the app-side `'bypass'` on purpose: in a test, an unhandled request means a missing handler, and letting it through gives a test that passes for the wrong reason (or hangs against a real host) |

Tests are **colocated** with the code they cover (`__tests__/` beside the source, or a
`Component.test.tsx` sibling), never in a mirrored top-level tree: colocated tests get deleted with
the feature they cover, while a mirror tree leaves orphans that fail months later for a feature
nobody remembers. That is what the template's `include: ['src/**/*.{test,spec}.{ts,tsx}']` encodes.

One companion file the template only describes in a comment — the axe matcher ships Jest types
only, so declare it for the runner:

```ts
// src/test/vitest-axe.d.ts
import 'vitest';
declare module 'vitest' {
  interface Assertion { toHaveNoViolations(): void }
  interface AsymmetricMatchersContaining { toHaveNoViolations(): void }
}
```

**Do not import global client stores into `setup.ts`.** Doing so pulls their transitive imports
(Server Actions, framework header modules) into the module graph *before any test file runs*, which
defeats every `vi.mock('next/headers')` in the suite — the real module is already cached by the time
the mock registers, and the symptom is "my mock has no effect" in a test file that looks completely
correct. Tests that need a store reset do it in their own `beforeEach`.

**`--passWithNoTests`:** run tests as `vitest run --passWithNoTests`, the canonical `test` script in
`references/11-tooling-and-gates.md` §1. It keeps one gate command valid across every package and
branch, including ones that legitimately have no tests yet, so CI config never has to special-case
them. The cost is that a broken `include` glob passes silently — offset it by asserting a minimum
test count in CI, or by keeping `include` narrow and reviewed.

---

## 9. The testing pyramid, layer by layer

| Layer                        | Environment      | Backend                     | Assert                                                              |
| ---------------------------- | ---------------- | --------------------------- | ------------------------------------------------------------------- |
| Pure utils, reducers, guards | none needed      | none                        | Every branch, including the ones that were bugs. No mocks at all.    |
| Zod schemas                  | none needed      | captured fixtures           | Tolerance on real payloads; rejection on invalid writes.             |
| Services / api-client        | node-ish         | front-db (+ `server.use`)   | URL hit, auth header, schema rejection on drift, 401→refresh→retry.  |
| Server Actions               | node-ish         | mocked service or front-db  | The `ActionResult` shape, field errors, side effects, invalidation.  |
| Hooks                        | jsdom            | front-db + fresh QueryClient| Cache transitions, optimistic apply/rollback.                        |
| `ds/` components             | jsdom            | none                        | Role-based queries, keyboard behaviour, and **zero axe violations**. |
| Screens                      | jsdom            | mocked actions              | The contract with actions; a11y; semantics a refactor can break.     |
| Flows                        | real browser     | app in mock mode            | 3–5 critical journeys only.                                          |

Wide base, narrow top. Every layer below the top runs in milliseconds; push each assertion as far
down as it will go.

### 9.1 Pure functions — the biggest win per line

```ts
// src/modules/billing/__tests__/optimistic-invoices.test.ts
import { describe, expect, it } from 'vitest';
import { optimisticInvoices } from '../hooks/useInvoices';

const rows = [
  { id: 10, accountId: 1, status: 'open' as const, amountDue: 100 },
  { id: 11, accountId: 1, status: 'paid' as const, amountDue: 200 },
];

describe('optimisticInvoices', () => {
  // `kind` is the discriminant the mutation-variables union uses throughout this skill —
  // see `references/04-actions-and-mutations.md` §7.2.
  it('removes the deleted row', () => {
    expect(optimisticInvoices(rows, { kind: 'delete', data: { id: 11 } }).map(r => r.id))
      .toEqual([10]);
  });

  it('is a no-op for add — the server assigns the id', () => {
    expect(optimisticInvoices(rows, { kind: 'add', data: { accountId: 1, amountDue: 1 } }))
      .toEqual(rows);
  });

  it('does not mutate its input', () => {
    const copy = structuredClone(rows);
    optimisticInvoices(rows, { kind: 'delete', data: { id: 10 } });
    expect(rows).toEqual(copy); // in-place mutation kills structural sharing → no re-render
  });
});
```

Extract the decision out of the component and test it here. A rule like "which account is selected
after sign-in" is three pure cases; as a component test it is thirty lines of setup and still misses
the interesting branch.

### 9.2 Schemas against captured fixtures

A schema test is the only place a breaking backend change fails in CI instead of in production.
Diffing spec files does not catch it — the spec is often updated after the deploy, or not at all. A
five-line fixture test converts a 3am incident into a red build. Write the schemas themselves per
`references/05-contracts-and-schemas.md`; test them in three kinds, colocated in
`schemas/__tests__/`:

```ts
/* live-shape.test.ts — the exact bytes the real API returned.
   Captured 2024-05-12 from GET /accounts/profile/ on staging; PII scrubbed.
   Note: NO `id` key — that is the real serializer's behaviour, not an omission. */
it('parses the live profile payload', () => {
  const parsed = accountSchema.parse({
    first_name: 'probe', email: 'probe@example.com', phone: null, tier: null, avatar: null,
  });
  expect(parsed.id).toBeUndefined();
  expect(parsed.phone).toBe('');
  expect(parsed.tier).toBe('free');            // tolerantEnum fallback
});

/* tolerance.test.ts — the hostile payload: optionals null, keys missing, unknown enum value. */
it('survives an all-null row', () => {
  const row = invoiceSchema.parse({
    id: 1, account_id: 2, status: 'shipped_last_week', amount_due: null, due_date: null, note: null,
  });
  expect(row.status).toBe('draft');
  expect(row.note).toBe('');
});

/* rejection.test.ts — what must NOT pass (write and form schemas). */
it('rejects a negative amount', () => {
  expect(invoiceWriteSchema.safeParse({ amount_due: -1 }).success).toBe(false);
});
```

- **Capture fixtures from the real API; never hand-write the happy path you imagine** — the bug you
  are defending against is precisely the shape you did not imagine. Scrub secrets and PII, and
  record where and when the capture came from in a comment.
- **Assert the specific normalization**, not a whole-object snapshot. Snapshots break on every
  additive backend change and train the team to run `-u` reflexively.
- **Reproduce every production parse failure as a test before fixing it.** That test's comment is
  the institutional memory for why the field is tolerant.
- **Config gets the same discipline, at module load.** Assert that a missing required URL throws at
  import — that is the behaviour `templates/src/common/config/env.ts` exists to guarantee, and it is
  invisible in every other kind of test.

### 9.3 Services and the api-client, through the interceptor

```ts
// src/common/services/__tests__/invoice-service.test.ts
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/node';
import { API_URL } from '@/common/constants/api';
import { HttpError } from '@/common/services/http-types';
import { listInvoices } from '../invoice-service';

describe('listInvoices', () => {
  it('hits the documented path with the auth header and parses the envelope', async () => {
    const seen: Request[] = [];
    server.events.on('request:start', ({ request }) => seen.push(request));

    const page = await listInvoices(2);

    expect(page.results.length).toBeGreaterThan(0);
    const url = new URL(seen.at(-1)!.url);
    expect(url.pathname).toBe('/billing/invoices/');
    expect(url.searchParams.get('page')).toBe('2');
    expect(seen.at(-1)!.headers.get('authorization')).toMatch(/^Bearer /);
  });

  it('throws on contract drift — a dropped required field must not pass silently', async () => {
    server.use(
      http.get(`${API_URL}/billing/invoices/`, () =>
        HttpResponse.json({ count: 1, next: null, previous: null, results: [{ id: 1 }] }),
      ),
    );
    await expect(listInvoices()).rejects.toThrow();
  });

  it('surfaces a 500 as HttpError with the status intact', async () => {
    server.use(http.get(`${API_URL}/billing/invoices/`, () => new HttpResponse(null, { status: 500 })));
    await expect(listInvoices()).rejects.toBeInstanceOf(HttpError);
  });
});
```

**Never stub `apiFetch`.** Stubbing the client skips URL construction, header attachment and the
schema parse — the three things most worth testing. Intercept at the network layer instead.

### 9.4 Server Actions

Default to mocking the service and asserting the `ActionResult`: it is fast, and it isolates the
action's own job (validate input, call the service, shape the result, invalidate).

```ts
// src/modules/billing/actions/__tests__/invoice-actions.test.ts
import { describe, expect, it, vi } from 'vitest';

const cookieStore = new Map<string, string>();
vi.mock('next/headers', () => ({
  // Next.js 16: `cookies()` is async. On 15 and earlier, drop the `async`.
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name) } : undefined,
    set: (o: { name: string; value: string }) => cookieStore.set(o.name, o.value),
    delete: (name: string) => cookieStore.delete(name),
  }),
}));

const createInvoice = vi.fn();
vi.mock('@/common/services/invoice-service', () => ({ createInvoice: (...a: unknown[]) => createInvoice(...a) }));

// The action re-authorizes BEFORE it validates (`references/04-actions-and-mutations.md` §3),
// so an unmocked session makes every case below a 401. Mock the session, never reorder the
// action's checks to suit the test.
vi.mock('@/common/services/session', () => ({
  readSession: vi.fn(async () => ({ access: 'test-token', refresh: 'test-refresh' })),
}));

const updateTag = vi.fn();
vi.mock('next/cache', () => ({ updateTag, revalidateTag: updateTag }));

import { createInvoiceAction } from '../invoice-actions';

describe('createInvoiceAction', () => {
  it('rejects invalid input before touching the service', async () => {
    const result = await createInvoiceAction({ productId: 0, amountDue: -1 });
    expect(result.ok).toBe(false);
    // A write action reports field errors in `body`, not a `fieldErrors` key: the
    // failure branch of `ActionResult` is exactly `{ ok, status, body }`. (A tier-1
    // action returning `ActionState` is the one that has `fieldErrors` — see
    // `references/04-actions-and-mutations.md` §1.)
    if (!result.ok) expect(result.status).toBe(422);
    if (!result.ok) expect(result.body).toHaveProperty('amountDue');
    expect(createInvoice).not.toHaveBeenCalled(); // the action is a public endpoint
  });

  it('returns ok:false — never throws — when the backend rejects', async () => {
    createInvoice.mockRejectedValue(
      Object.assign(new Error('bad'), { status: 422, body: { productId: ['Unknown product.'] } }),
    );
    const result = await createInvoiceAction({ productId: 999, amountDue: 100 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(422);
  });

  it('invalidates the tag it claims to, only after success', async () => {
    createInvoice.mockResolvedValue({ id: 1, productId: 101, amountDue: 100 });
    const result = await createInvoiceAction({ productId: 101, amountDue: 100 });
    expect(result.ok).toBe(true);
    expect(updateTag).toHaveBeenCalledWith('billing:invoices'); // invisible in every other test
  });
});
```

Version note — on Next.js 16 use `updateTag(tag)` for immediate invalidation and
`revalidateTag(tag, profile)` with a cache-life profile; the single-argument `revalidateTag(tag)`
is deprecated on 16 and is the only form on 15.x. Mock whichever your code calls.
A second, complementary suite runs the *real* action against the front-db: it proves the edge
schemas accept the shapes the handlers actually emit, which service mocks by definition cannot.

**Assert `ok: false`, never `rejects`.** A test expecting a throw is asserting the bug the
`ActionResult` contract exists to prevent (see `references/04-actions-and-mutations.md`).

### 9.5 Hooks, with a fresh QueryClient per test

```tsx
// src/modules/billing/hooks/__tests__/useInvoices.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { makeQueryClient } from '@/common/lib/query-client';
import { useInvoices } from '../useInvoices';

/**
 * A FRESH client per test — a shared one leaks cached data and makes order matter.
 * Build it OUTSIDE the wrapper component: constructing it in the render body would
 * hand every re-render a new empty cache, and the query would never settle.
 */
function makeWrapper() {
  const client = makeQueryClient();
  // Retries turn a deliberate 500 into a multi-second timeout instead of an assertion.
  client.setDefaultOptions({ queries: { retry: false, gcTime: 0 } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useInvoices', () => {
  it('loads the seeded invoices from the front-db', async () => {
    const { result } = renderHook(() => useInvoices({ status: 'open' }), {
      wrapper: makeWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.results.length).toBeGreaterThan(0);
  });
});
```

### 9.6 Design-system components and the accessibility gate

```tsx
// src/common/components/ds/Button.test.tsx
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button a11y', () => {
  it('has no axe violations with a text label', async () => {
    const { container } = render(<Button>Save changes</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

- **Query by role and accessible name**, not by test id or class. A `getByRole('button', { name })`
  query fails exactly when a screen reader user would be lost — that is the point.
- **Portalled content (dialogs, popovers, listboxes) is not in `container` when closed.** Either
  open it first and pass `document.body`, or assert on the always-rendered trigger and give it an
  accessible name. Silently axe-ing an empty container is a green test that checks nothing.
- **Screen-level tests assert semantics a refactor can break**: heading levels and hierarchy, that
  status is spelled out and not conveyed by colour alone, that link targets are right, and that
  direction-sensitive values carry an explicit `dir` where your locale needs it.

### 9.7 Where browser tests earn their place

Use a real-browser runner (Playwright or equivalent) for exactly what jsdom cannot do, and nothing
more: **async Server Components, streaming and suspense boundaries, real navigation, Service Worker
behaviour, and anything involving layout or scroll.** jsdom cannot render an async Server Component
— do not try.

Budget three to five journeys, run against the app in mock mode so they are deterministic and need
no backend: sign in; create-edit-delete one entity round trip; one paginated list; one deliberate
failure via the fault switch (§4). Every additional browser test costs minutes of CI and produces
flakes; push everything else down the pyramid.

---

## 10. Environment gotchas worth recording

| Symptom                                                              | Cause                                                                 | Fix                                                                |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `ResizeObserver is not defined` on mount                             | jsdom implements no layout APIs                                       | No-op polyfill in setup (§8)                                       |
| `matchMedia is not a function`                                       | Same                                                                  | Stub returning `matches: false`                                    |
| Test passes but the run is red with an unhandled rejection           | A library calls a missing DOM API from a timer, outside any test tick | Polyfill it (`elementFromPoint`, `scrollIntoView`)                 |
| `Cannot find module 'server-only'` / it throws on import             | The package is RSC-only by design                                     | Alias to an empty module (§8)                                      |
| `vi.mock('next/headers')` has no effect                              | The real module was loaded by a setup-file import chain first         | Never import app modules with server deps in `setup.ts`            |
| A test passes alone and fails in the suite                           | Leaked store rows, an issued token, or a module singleton             | `resetDb()` + every non-JSON reset in `afterEach`                  |
| Requests reach the real network in the browser                       | Stale or missing `mockServiceWorker.js`                               | Re-run the interceptor's `init` after every upgrade                |
| A deliberate 500 test takes 15 seconds                               | Query retries are on by default                                       | `retry: false` in the test query client                            |
| Timers/date assertions drift                                         | Seed or handler used `Date.now()`                                     | Fixed ISO strings in the seed; `vi.useFakeTimers()` where needed   |
| The production bundle grew by the size of the seed                   | A static import of a mock module                                      | Dynamic `import()` behind the env flag + a boundary lint rule      |

---

## Anti-patterns

| Never do this                                                      | Because                                                                                                       | Do this instead                                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `const MOCK_INVOICES = [...]` inside a component or hook           | Cannot model a write; drifts from the real shape; ships to production because nobody can find it              | One typed front-db behind the real endpoints                                |
| Stubbing `fetch`, `apiFetch`, or a service in a service test       | Skips URL building, auth headers and schema parsing — precisely what breaks in production                     | Intercept at the network layer; override per test with `server.use()`       |
| A static `import` of anything under `src/mocks/` from app code     | Bundlers cannot tree-shake a module whose side effect is registering handlers; the seed ships to every browser | `await import('@/mocks/init')` behind an env flag, plus a boundary lint rule |
| Running the Node interceptor without a runtime guard               | It cannot run on the edge runtime; the build or the request fails opaquely                                    | `if (process.env.NEXT_RUNTIME !== 'nodejs') return`                         |
| `onUnhandledRequest: 'error'` in the app process                   | The server also makes framework/RSC fetches; every one becomes a 501 and the dev server looks broken          | `'bypass'` in the app, `'error'` in tests                                   |
| Gating the whole tree on `mockReady`                               | Discards all server-rendered HTML, so mock mode stops testing streaming/SSR and every screen flashes blank    | Render markup always; gate only client queries with no server data          |
| `db = createEmptyDb()` in `resetDb()`                              | Handlers hold the old reference; the reset silently does nothing and tests leak into each other               | `Object.assign(db, fresh)`                                                  |
| A seed using `Math.random()` / `Date.now()`                        | Tests pass 95% of the time; the 5% is blamed on "flaky CI" for months                                         | Fixed ids and fixed ISO strings                                             |
| Non-store mock state (`Map`) with no reset export                  | `resetDb()` cannot clear it; a token from the previous test validates while ids have rewound                  | Export `resetXState()` and call it in the same `afterEach`                  |
| Zero-latency handlers                                              | Loading states never paint, so skeletons and cancel-on-unmount are never seen or tested                       | A small baseline delay plus an explicit `slow` fault                        |
| Random failure injection                                           | Flaky mocks make a flaky suite, and the team stops trusting red builds                                        | Deterministic, explicitly requested faults (`?__fault=error`)               |
| Asserting a mock result by reading `db` from app-side test code    | Tests the mock, not the app; passes while the real code path is broken                                        | Assert through the same service/action production calls                     |
| Persisting the mock store by default                               | A snapshot from an older schema surfaces as an unreproducible bug with an undiscoverable fix                  | Off by default; version the snapshot key; never persist in tests            |
| Sharing one `QueryClient` across tests                             | Cached data leaks between tests and order starts to matter                                                    | Fresh client per test, `retry: false`                                       |
| Importing global stores into the test setup file                   | Their transitive server imports load before any test, defeating every `vi.mock` in the suite                  | Reset stores in the test file's own `beforeEach`                            |
| `expect(action()).rejects` for a write action                      | Asserts the exact bug the `ActionResult` contract exists to prevent                                           | `expect(result.ok).toBe(false)` and assert `status`/`fieldErrors`           |
| Treating the component-explorer a11y panel as the gate             | Nobody opens a panel in CI; violations ship                                                                   | `toHaveNoViolations()` inside the normal test command                       |
| Snapshot-testing whole API responses or rendered trees             | Breaks on every additive change; trains everyone to run `-u` without reading                                  | Assert the specific normalization or the specific role/name                 |
| Driving every flow through browser tests                           | Minutes of CI per run, flakes, and failures that do not localize                                              | Push assertions down the pyramid; 3–5 browser journeys total               |
