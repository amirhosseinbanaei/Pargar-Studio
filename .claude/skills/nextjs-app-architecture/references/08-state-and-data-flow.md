# State: server components, query cache, and client stores

**Read this when:** you are deciding where a piece of state lives (start at the §1 table), a page
flashes a spinner over data the server already had, a store and the cache disagree, or you are
wiring SSR prefetch and hydration.

Every piece of state in the app has exactly one home, and the choice is mechanical, not stylistic.
This file gives the decision table, the Server-Component-first composition rules, the TanStack Query
client and SSR hydration setup, the narrow lane client stores are allowed to occupy, and the
render-nothing bootstrap components that resolve app-wide state once for every route.
Read `references/04-actions-and-mutations.md` first for query keys, mutations, and invalidation.

> **Versions.** Every example leads with the **Next.js 16** form; the 15.x equivalent is given
> inline wherever they differ. Zod examples are **zod 4** (see `references/05-contracts-and-schemas.md`
> for the zod 3 spellings).

## Invariants

- **Pick the state's home with the decision table in §1, top row first.** Every row below the first
  match costs more JavaScript, more round-trips, and one more thing that can desynchronize.
- **Server Components are the default; `'use client'` goes on the leaf that needs it.** The
  directive marks a boundary, not a file — everything a client file transitively imports becomes
  client code, so one misplaced directive ships an entire subtree to the browser.
- **A Client Component may not import a Server Component, but it may receive one as `children` or
  a slot prop.** That is the only way to keep a server-rendered subtree inside a client wrapper.
- **One `makeQueryClient()` factory, consumed through `getQueryClient()`: a fresh client per server
  request, a stable singleton in the browser.** A module singleton on the server bleeds one user's
  cache into another user's render; a per-render client in the browser loses the cache whenever the
  provider suspends.
- **Never create the browser query client with `useState`.** It does not survive a suspend of the
  provider itself — React discards the state and you silently get a second, empty cache.
- **`staleTime` must be greater than zero.** With the default of `0`, every hydrated query refetches
  the instant the client mounts and the whole server prefetch was wasted work.
- **Never retry a 4xx.** Retrying a 401/403/404/422 cannot succeed, doubles the latency of every
  error state, and multiplies the load your backend sees during an incident.
- **Server prefetch and the client hook must use the same `queryOptions` factory.** A key or
  `queryFn` mismatch means the hydrated entry is never read and the client refetches everything it
  just received in the HTML.
- **Hydrate a query only if its key is knowable on the server at request time.** Keys derived from
  client state (a selected entity, a typed filter) stay client-fetched.
- **Server data never goes in a client store.** The store copy and the cache copy drift the moment
  either one refetches, and the UI shows whichever one re-rendered last.
- **Never read `localStorage` (or any persisted store) during render.** The server has no storage,
  so the first client render disagrees with the server HTML and React throws away the tree.
- **Stores are client-only.** A module-level store on the server is one object shared by every
  concurrent request — reading or writing it during SSR leaks state across users.
- **Sign-out clears the query cache, not just invalidates it,** and refreshes the router. Invalidated
  data is still rendered while it refetches, so the next user sees the previous user's rows.

## 1. The decision table

Ask these in order. **The first row that matches wins** — do not skip to a lower row because it
feels more familiar.

| # | Ask | If yes, the home is | Mechanism |
| - | --- | ------------------- | --------- |
| 1 | Is it derivable from the request (path, `params`, cookies, session) and read-only on this screen? | **Server render** | `async` Server Component, `<Suspense>` if it is per-request dynamic |
| 2 | Is it the same for all users (or per-key shareable) and read-mostly? | **Server cache** | Next 16: `'use cache'` + `cacheLife` + `cacheTag`, rendered in an RSC. 15.x: `unstable_cache` / segment `revalidate` |
| 3 | Should it survive refresh, be shareable as a link, and drive the back button? | **URL** | `searchParams` (server) / `useSearchParams` + `router.replace` (client) |
| 4 | Is it server data the client will subsequently mutate, poll, paginate, reorder, or invalidate? | **Query cache** | prefetch + `HydrationBoundary` when the key is server-knowable; client-only otherwise |
| 5 | Is it client-only state that two or more unrelated subtrees read? | **Client store** | one small store with typed actions and selectors |
| 6 | Anything else | **Local component state** | `useState` / `useReducer`, colocated with the component |

What each home costs and guarantees:

| Home | In the HTML | Survives refresh | Shareable link | Client JS | Who owns writes |
| ---- | ----------- | ---------------- | -------------- | --------- | --------------- |
| Server render | yes | yes | via URL only | none | the server |
| Server cache | yes (static shell) | yes | via URL only | none | `updateTag(tag)` (Next 16); `revalidateTag(tag)` on 15.x |
| URL | yes | yes | yes | tiny | the router |
| Query cache (hydrated) | yes | refetch | no | the hook + its deps | mutations |
| Query cache (client-only) | no | no | no | the hook + its deps | mutations |
| Client store | no | only if persisted | no | the store + subscribers | store actions |
| Local state | no | no | no | the component | the component |

Worked classification, using the example domain:

| Datum | Home | Why |
| ----- | ---- | --- |
| Marketing/product copy, catalog category tree | Server cache | Same for everyone, read-mostly, wanted in the static shell for SEO |
| Currency / country / unit dictionaries | Server cache | Changes on the order of days; render into `<option>`s server-side |
| Invoice detail on a read-only receipt page | Server render | Per-user, read-only on this screen — no reason to ship a fetch for it |
| Invoice line items on the editable invoice screen | Query cache, hydrated | Per-user, edited in place with optimistic add/remove/reorder |
| Product search results while the user types | Query cache, client-only | Exists only because of client interaction; key changes per keystroke |
| Catalog list filters, sort, page number | URL | Must be linkable and back-buttonable; the server reads them to prefetch |
| "Which account am I acting as" | Client store | A user choice, read by many routes, not derivable from the request |
| Multi-step invoice wizard position | Client store (feature-local) | Cross-component within one flow, not server data |
| Whether a dropdown is open | Local state | Nothing outside the component cares |
| Access/refresh tokens | **None of the above** | httpOnly cookies, server-side only — see `references/03-server-data-layer.md` |

Two corollaries worth stating as rules:

- **The query cache never owns first-paint data.** If a screen shows a spinner on initial load for
  data the server already had, that is a defect, not a loading state.
- **A dataset has exactly one owner.** Rendering it in a Server Component *and* reading it with
  `useQuery` gives you two owners that diverge after the first client refetch.

## 2. Server Components by default, `'use client'` at the leaves

A component must be a Client Component only if it uses at least one of: `useState`/`useReducer`/
`useEffect`, event handlers, browser APIs, router hooks (`useRouter`, `usePathname`,
`useSearchParams`), form hooks (`useActionState`, `useOptimistic`, react-hook-form), query hooks, or
a store. Everything else — layout, formatting, data display, markdown — stays on the server.

### 2.1 Push the directive down

```tsx
// ❌'use client' at the top of the page → 300 lines of static markup ship to the browser
//    because one <ApproveButton /> needs an onClick.
// ✅ page stays a Server Component; only the button hydrates.
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;                 // Next 15+: params is a Promise. ≤14: a plain object.
  const invoice = await getInvoice(Number(id));
  return (
    <article>
      <InvoiceHeader invoice={invoice} />      {/* server */}
      <LineItemTable items={invoice.lines} />  {/* server */}
      <ApproveButton invoiceId={invoice.id} /> {/* 'use client' lives in this file only */}
    </article>
  );
}
```

### 2.2 Server children through a client parent

A Client Component cannot *import* a Server Component, but props are opaque to it — so it can
*render* one it was handed. This is what keeps providers, tabs, accordions, and modals from
clientifying their content.

```tsx
// common/components/layout/Panel.tsx
'use client';
export function Panel({ title, children }: { title: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section>
      <button onClick={() => setOpen(o => !o)}>{title}</button>
      {open && children}          {/* rendered on the server, arrives as an opaque payload */}
    </section>
  );
}

// app/(dashboard)/billing/page.tsx — Server Component
export default async function BillingPage() {
  return (
    <Panel title="Invoices">
      <InvoiceSummary />          {/* stays a Server Component; zero JS added */}
    </Panel>
  );
}
```

Slot props (`header`, `sidebar`, `footer: ReactNode`) work identically and are the right tool when
you need more than one hole.

### 2.3 Streaming a promise across the boundary

When the client component genuinely needs the *data* (not just the markup), pass the unawaited
promise and unwrap it with `use()`. The shell renders immediately; the data streams.

```tsx
// server
export default function CatalogPage() {
  const productsPromise = listProducts();      // deliberately not awaited
  return (
    <Suspense fallback={<ProductGridSkeleton />}>
      <ProductGrid promise={productsPromise} />
    </Suspense>
  );
}

// client
'use client';
import { use } from 'react';
export function ProductGrid({ promise }: { promise: Promise<Product[]> }) {
  const products = use(promise);
  return <Grid items={products} />;
}
```

Props crossing the boundary must be RSC-serializable: primitives, plain objects/arrays, `Date`,
`Map`/`Set`, typed arrays, JSX, promises, and Server Actions. **Not** class instances, arbitrary
functions, or symbols. Pass ids and plain data, never ORM/model objects.

Guard the modules that must never cross: `import 'server-only'` at the top of anything touching
secrets, tokens, or the data layer — it turns an accidental client import into a build failure
instead of a leaked credential.

## 3. URL state

Filters, sort order, pagination, and the selected tab belong in the URL, because a store copy of
them breaks the back button, cannot be linked, and cannot be read by the server to prefetch.

```tsx
// app/(dashboard)/catalog/page.tsx — Server Component
type SearchParams = Promise<{ q?: string; page?: string }>;   // Next 15+: a Promise.
                                                              // ≤14: a plain object, no await.
export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const { q = '', page = '1' } = await searchParams;
  const products = await listProducts({ q, page: Number(page) });
  return <ProductTable products={products} />;
}
```

```tsx
'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function CatalogFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');                     // changing a filter must reset pagination
    // `replace` (not `push`) for keystroke-rate updates: one history entry per filter session,
    // not one per character.
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }
  return <SearchInput onChange={v => setParam('q', v)} />;
}
```

`useSearchParams` opts its subtree into request-time rendering — wrap the component that calls it in
`<Suspense>` so the rest of the page can still be prerendered into the static shell.

## 4. The query client

Copy `templates/src/common/lib/query-client.ts`. It exports `makeQueryClient()` (the factory) and
`getQueryClient()` (the accessor **every** caller uses, including server prefetch). Four of its
defaults are decisions, not preferences:

| Default                                        | Why it must stay                                                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `staleTime: 60_000` (anything `> 0`)           | At the library default of `0`, every hydrated query is stale on arrival and refetches the moment the client mounts — the prefetch you paid for on the server is thrown away and the user sees a spinner over data that was already on screen. |
| `retry` as a **status-aware predicate**        | A bare `retry: 1` retries 4xx. A 401/403/404/422 cannot succeed on retry: it doubles the time to show the error and multiplies backend load during an incident. The only exceptions are the statuses that mean "try again" — 408 and 429. |
| `shouldDehydrateQuery` including **pending**   | This is what makes the non-awaited (streaming) prefetch in §5.2 work: the server ships the promise placeholder with the HTML and the client adopts it instead of starting a second identical request. |
| `refetchOnWindowFocus: false`                  | Refetch-on-focus turns every tab switch into a request storm and makes forms flicker mid-edit. Opt individual live views back in. |

The retry predicate reads `status` by **structural check**, not `instanceof` — errors reach it
after crossing at least one boundary (a Server Action result rebuilt on the client, a dehydrated
cache entry), where class identity is already gone and `instanceof` silently turns "never retry a
4xx" into "retry everything".

**Why not `useState(makeQueryClient)`.** It is the pattern most tutorials show, and it is wrong once
you suspend: if the provider component itself suspends (a streamed parent, a lazy import), React may
discard its state and re-run it, producing a second empty cache while the first one still holds the
hydrated data. The module-scoped browser singleton cannot be lost that way. The `isServer` branch is
what keeps that singleton from becoming a cross-request leak — a module singleton on the server
means one user's prefetched data is dehydrated into another user's HTML.

### 4.1 The provider

Copy `templates/src/app/providers.tsx`. It is a thin `'use client'` wrapper mounted once by the
root layout, taking `children` as a **prop** — which is what keeps the whole route tree
server-rendered (§2.2). Importing page content into it instead would drag the entire tree into the
client bundle, with no error to warn you.

Three things it must do and one it must not:

- Get the client from `getQueryClient()`, never `useState` (§4) and never a second provider
  anywhere — two React trees with two clients means an invalidation after a mutation updates
  nothing and the stale list survives until a reload.
- Mount the render-nothing bootstrap components **above** `children` (§7), so every route inherits
  one resolved answer instead of each page resolving it again. The template mounts `SessionSync`
  (a one-line wrapper around `useSessionBootstrap()`) and takes a `bootstrap?: ReactNode` slot for
  the rest — a slot rather than imports, so `app/` does not accumulate an import from every module.
- Load devtools through `next/dynamic` with `ssr: false` behind a `NODE_ENV` check. The check
  controls **rendering**, `dynamic` controls **downloading**, and you want both; a static import
  ships the panel to every user regardless.
- It must not fetch anything. Providers wire context and bootstrap; data belongs to Server
  Components and query hooks.

## 5. SSR prefetch and hydration

For screens where the client will own the data afterwards, the server prefetches the first-paint
queries into a request-scoped client, dehydrates it, and hands the state to a `HydrationBoundary`.
The client hooks then read a warm cache: real content in the HTML, zero loading flash, and React
Query still in charge of subsequent edits.

### 5.1 Awaited (blocking) variant

```tsx
// app/(dashboard)/billing/invoices/page.tsx — Server Component
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getQueryClient } from '@/common/lib/query-client';
import { invoicesOptions, accountOptions } from '@/modules/billing/hooks/queries';
import { InvoicesScreen } from '@/modules/billing/components/InvoicesScreen';

export default async function InvoicesPage() {
  const queryClient = getQueryClient();

  // Parallel and awaited: both land in the dehydrated payload. Sequential awaits — or
  // awaits spread across nested Server Components — are a request waterfall.
  await Promise.all([
    queryClient.prefetchQuery(invoicesOptions()),
    queryClient.prefetchQuery(accountOptions()),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <InvoicesScreen />
    </HydrationBoundary>
  );
}
```

```ts
// modules/billing/hooks/queries.ts — the single definition BOTH sides import
import { queryOptions } from '@tanstack/react-query';
import { queryKeys } from '@/common/api/query-keys';
import { listInvoicesAction } from '../actions/invoice-actions';

export function invoicesOptions() {
  return queryOptions({
    queryKey: queryKeys.billing.invoices(),
    queryFn: () => listInvoicesAction(),
  });
}

// modules/billing/components/InvoicesScreen.tsx
'use client';
export function InvoicesScreen() {
  // Same factory as the page → same key → cache hit → no spinner on first paint.
  const { data: invoices = [] } = useQuery(invoicesOptions());
  return <InvoiceTable invoices={invoices} />;
}
```

**The key-must-match rule.** The prefetch and the hook must import the *same* `queryOptions`
factory. Re-declaring the key inline on either side — even with what looks like the same tuple —
means the hydrated entry sits unread in the cache while the hook fetches its own copy: you pay for
the server call, ship the payload, and still show a spinner.

The `queryFn` runs in **both** runtimes — on the server during prefetch, in the browser on every
later refetch — so it must be callable from both. A server-only service is not; wrap it. Two
sanctioned transports:

| Transport | Use when | Why |
| --------- | -------- | --- |
| A Server Action | Occasional refetch after an invalidation; a handful of page-level queries | Simplest, reuses the action layer. Actions serialize over the client→server channel, so this is only safe at low concurrency |
| A thin Route Handler calling the same service | Frequent, parallel, or interaction-driven refetches | No serialization queue; the handler is internal plumbing for the cache, not a public API |

Prefetching with an action is safe because during prefetch it is an ordinary async call under
`Promise.all` (no RPC at all), and `staleTime > 0` keeps the client from refetching on mount. Do not
generalize it to a screen with many concurrent client-driven initial queries.

### 5.2 Streaming (non-blocking) variant

Drop the `await` and keep the prefetch. The pending promise is dehydrated (this is what the
`shouldDehydrateQuery` extension in §4 enables) and streams to the client, where
`useSuspenseQuery` picks it up behind a `<Suspense>` boundary. The shell paints immediately.

```tsx
export default function InvoicesPage() {          // not async
  const queryClient = getQueryClient();
  queryClient.prefetchQuery(invoicesOptions());   // fire, do not await

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<InvoiceTableSkeleton />}>
        <InvoicesPanel />                         {/* useSuspenseQuery(invoicesOptions()) */}
      </Suspense>
    </HydrationBoundary>
  );
}
```

Pick one style per screen. Awaited + `useQuery` gives a complete HTML payload; streaming +
`useSuspenseQuery` gives a faster shell. Mixing them on one screen makes the loading behaviour
unpredictable to reason about.

### 5.3 What not to prefetch

| Query | Prefetch? | Why |
| ----- | --------- | --- |
| Per-user singletons the session identifies (current account, profile, settings) | Yes | The key is fully knowable from the request |
| List queries keyed only by route `params` / `searchParams` | Yes | Same — read them and pass them into the options factory |
| Lists keyed by a client selection (active account id, selected row) | No | The server does not know the selection; the key would be a guess |
| Search-as-you-type, dependent dropdowns, infinite scroll pages 2+ | No | They exist only because of client interaction |
| Anything the client only reads and never mutates | No — don't use the cache at all | Render it in a Server Component and pass JSX down (§1 row 1) |

Also never call `queryClient.fetchQuery()` in a Server Component in order to *render* the result
there. A Server Component is a place to prefetch, nothing more; rendering from it while a client
hook also reads the key recreates the two-owners problem.

## 6. Client stores

### 6.1 The lane

| Belongs in a store | Never in a store |
| ------------------ | ---------------- |
| The resolved session identity and role the UI renders | Access/refresh tokens (httpOnly cookies, server-side only) |
| "Currently selected X" that several routes key off | Any server list, entity, or paginated page (that is the query cache) |
| Multi-step wizard position and draft answers | Derived values you can compute in a selector or during render |
| Cross-route ephemeral UI: sidebar collapsed, theme, density | Form field values (the form library owns those) |
| Feature flags resolved once on the client | Filters/sort/pagination (those belong in the URL) |

Placement follows the layering rule: a store read by one feature lives in `modules/<feature>/stores/`;
a store two unrelated features read is promoted to `common/stores/`. Promoting late has a specific
cost — state that lives inside a feature module only exists once that module's code has loaded, so a
user who lands anywhere else has no value at all.

### 6.2 Canonical store

Copy `templates/src/common/stores/session-store.ts`. Its exports are the names every other file in
this skill assumes:

```ts
useSessionStore                       // the store itself — subscribe through a selector, never bare
useSessionBootstrap()                 // mount ONCE, in providers.tsx (§7)
configureSessionBridge(bridge)        // inject the two Server Actions — see below
useIsAuthenticated / useSessionUser / useSessionRole / useSessionHydrated / useIsAdmin
getSessionSnapshot()                  // non-reactive read, for event handlers only
// store actions: setSession, clearLocalSession, signOut, reconcile, setHydrated
```

Four bans define the file, and each one is a production bug someone shipped:

1. **It never holds a token.** Access/refresh live in httpOnly cookies. A token in this store is a
   token in `localStorage`, readable by any injected script, and the httpOnly protection was
   pointless.
2. **It never holds server data.** This is UI identity only. A store copy of server data is a
   second cache with no invalidation story, and the UI shows whichever copy re-rendered last.
3. **It never claims authority.** The cookie is authoritative; `reconcile()` may only **downgrade**
   to signed-out, never upgrade. Reconstructing an identity from a cookie the client cannot read is
   impossible, so a signed-out store stays signed out until a real sign-in populates it.
4. **It never reads storage during render.** `skipHydration: true` defers the `localStorage` read
   until after mount, and `useSessionBootstrap` drives `rehydrate()` then `reconcile()`. Without it
   the first client render shows the signed-in header while the server rendered the signed-out one,
   and React discards the tree on that mismatch.

#### The server bridge

The store cannot import a feature module's Server Actions without inverting the dependency graph
(`common/` may not import `modules/`), so the two server calls it needs are **injected once** at app
start. The template's defaults are deliberately the safe side of each failure: `isSignedIn` returns
`true`, so an unconfigured app never spuriously signs a user out, and `signOut` resolves without
doing anything, so the UI still clears locally.

```ts
// src/common/stores/session-bridge.ts — one file, imported for its side effect only.
'use client';
import { isAuthenticatedAction, signOutAction } from '@/common/actions/session';
import { configureSessionBridge } from './session-store';

configureSessionBridge({ signOut: signOutAction, isSignedIn: isAuthenticatedAction });
```

The two actions are `signOutAction` and `isAuthenticatedAction` from
`references/03-server-data-layer.md` §6.4. They live in `common/actions/session.ts`, **not** in a
feature module, for the same reason the store does: `common/` may not import `modules/`, so a bridge
file inside `common/stores/` can only reach them there. `isSignedIn` returns a **boolean** — an
action must never hand a token back to the client, even indirectly.

Import the bridge file from `app/providers.tsx`. **Skipping it is silent**: the injected default
`isSignedIn` reports `true`, so `reconcile()` always concludes "still signed in" and a sign-out in
another tab or an expired session never downgrades this tab. That default is deliberate — the other
direction would sign users out of a correctly-working app that simply forgot to call
`configureSessionBridge` — which is exactly why the omission has to be caught by reading this rule
rather than by a symptom.

**Selectors, not whole-store subscriptions.** `const store = useSessionStore()` re-renders the
component on *every* field change anywhere in the store — with a store the whole app reads, that is a
re-render storm on every navigation. Subscribe to one primitive per hook. When you genuinely need
several fields at once, wrap the object selector in the library's shallow-compare helper
(`useShallow`), because a fresh object literal is a new reference on every call and defeats the
equality check entirely.

**Persist only what the user would be annoyed to lose.** Persisting a transient flag — a dialog's
open state, a "submitting" boolean — makes the modal reopen or the spinner stick on the next page
load. Keep those out of `partialize`.

### 6.3 Scoping a selection to its owner

A persisted "currently selected X" is per-identity. Store the owner alongside it and refuse to read
it for anyone else, or the second user on a shared browser inherits the first user's selection — a
stale id that 404s every query keyed by it.

```ts
// common/stores/active-account-store.ts — same persist config as §6.2
// (createJSONStorage, partialize to { activeAccountId, ownerKey }, skipHydration,
//  onRehydrateStorage → setHydrated(true)). Only the state and the read differ:
interface ActiveAccountState {
  activeAccountId: number | null;
  /** Identity the selection belongs to; `null` while signed out. */
  ownerKey: string | null;
  hydrated: boolean;
}
interface ActiveAccountActions {
  setActiveAccount: (id: number | null, ownerKey: string | null) => void;
  clearActiveAccount: () => void;
  setHydrated: (hydrated: boolean) => void;
}

/**
 * The only safe read: the raw field is deliberately NOT exported as a selector, so a
 * cross-user id can never reach a query key.
 */
export function useActiveAccountId(ownerKey: string | null): number | null {
  return useActiveAccountStore(s =>
    s.ownerKey != null && s.ownerKey === ownerKey ? s.activeAccountId : null,
  );
}
export const useActiveAccountHydrated = () => useActiveAccountStore(s => s.hydrated);
```

Derive `ownerKey` from something stable and unique per account (the account's id or email), never
from a render-order counter. A signed-in-but-identity-less session should still get a constant key
so the feature degrades to "works, but shared" rather than "never resolves".

### 6.4 Reading storage without the persist middleware

Same rule, hand-rolled: initial state is the fallback for the server render **and** the hydrating
client render; storage is read in an effect on the next commit.

```ts
'use client';
export function useLocalStorage<T>(key: string, fallback: T) {
  // Reading storage in the initializer would make the first client render disagree with
  // the server HTML and blow up hydration.
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* private mode / quota / corrupt JSON — keep the fallback */
    }
    setLoaded(true);
  }, [key]);   // `fallback` is intentionally not a dep: re-reading because a caller passed
               // a new object literal would clobber what the user has since stored.

  useEffect(() => {
    // Write back only after the stored value has been read, or the first commit
    // overwrites the user's saved value with the fallback.
    if (loaded) localStorage.setItem(key, JSON.stringify(value));
  }, [key, value, loaded]);

  return [value, setValue] as const;
}

/**
 * `false` during SSR AND during the first client render; `true` from the first commit.
 * Gate every browser-only read on this — viewport width, media queries, observers,
 * persisted-store reads. `typeof window !== 'undefined'` is NOT enough: it is already
 * true during the hydrating render, which is exactly the render that must match the HTML.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
```

## 7. The `*Sync` bootstrap pattern

App-wide state — who is signed in, which entity is active — is resolved **once**, by render-nothing
client components mounted above `children` in the providers. Every route then inherits one resolved
answer.

The failure this prevents is concrete: when the only thing that ever resolved "which entity is
active" was the switcher widget on one screen, every other screen that keyed queries off it worked
only if the user had visited that screen first in this browser. Everything else loaded forever or
404'd on a selection persisted from an earlier session.

### 7.1 Session bootstrap

The session's post-mount lifecycle already ships as `useSessionBootstrap()` in the store template
(§6.2). It does two things, in order:

1. **Rehydrate** the persisted store — deferred by `skipHydration`, so it cannot cause a hydration
   mismatch. `rehydrate()` may be sync (`localStorage`) or async (an IndexedDB adapter), so it is
   wrapped in `Promise.resolve` and reconcile runs after it either way. Reconciling first would
   reconcile an empty store and do nothing.
2. **Reconcile** against the real httpOnly cookie. The cookie is authoritative: if it is gone —
   signed out in another tab, an expired refresh, cookies cleared by hand — this downgrades the
   store, so the header can never stay stuck showing signed-in controls for a session that no
   longer exists.

Mount it exactly once, in a component that renders `null`, above `children` in the providers:

```tsx
function SessionSync(): null {
  useSessionBootstrap();
  return null;
}
```

Calling it in several places is harmless but pointless; calling it in none means the store never
leaves its signed-out default and every user looks logged out.

Note the asymmetry: `reconcile` **downgrades only**. Without a server endpoint that rebuilds the
full identity from a token, an upgrade would have to guess — so a signed-out store stays signed out
until an explicit sign-in records it.

### 7.2 Active-entity bootstrap

```tsx
// common/components/bootstrap/ActiveAccountSync.tsx
'use client';
import { useEffect } from 'react';
import { useMounted } from '@/common/hooks/useMounted';
import { useSessionHydrated } from '@/common/stores/session-store';
import { useActiveAccountHydrated, useActiveAccountStore } from '@/common/stores/active-account-store';
import { resolveActiveAccountId, useAccounts, useOwnerKey } from '@/common/hooks/useActiveAccount';

/**
 * Resolves "which account am I acting as" for the whole app, once.
 *
 * It deliberately does NO work before the first commit. This component is mounted in the
 * providers — ABOVE every route's `HydrationBoundary` — and its `useAccounts()` call would
 * otherwise create that query in the cache before the boundary ran. React Query hydrates a
 * query that already exists from an effect (brand-new ones hydrate synchronously), and
 * effects never run on the server, so the observer made the server render an empty list
 * while the client rendered a full one. React then discarded and re-rendered the entire
 * route on every load. The `useMounted()` gate keeps the server HTML and the first client
 * render identical and lets the boundary hydrate first.
 */
export function ActiveAccountSync() {
  return useMounted() ? <ActiveAccountReconciler /> : null;
}

function ActiveAccountReconciler() {
  const sessionHydrated = useSessionHydrated();
  const accountHydrated = useActiveAccountHydrated();
  const ownerKey = useOwnerKey();
  const { data: accounts } = useAccounts();

  const storedId = useActiveAccountStore(s => s.activeAccountId);
  const storedOwner = useActiveAccountStore(s => s.ownerKey);
  const setActiveAccount = useActiveAccountStore(s => s.setActiveAccount);
  const clearActiveAccount = useActiveAccountStore(s => s.clearActiveAccount);

  useEffect(() => {
    void useActiveAccountStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    // Both stores must have read storage first. Acting earlier clears a valid persisted
    // selection, because the session still looks signed-out at that point.
    if (!sessionHydrated || !accountHydrated) return;
    if (!ownerKey) {
      if (storedId !== null || storedOwner !== null) clearActiveAccount();
      return;
    }
    // A selection made by another account is not a selection for this one.
    const current = storedOwner === ownerKey ? storedId : null;
    const next = resolveActiveAccountId(accounts, current);
    if (next !== storedId || storedOwner !== ownerKey) setActiveAccount(next, ownerKey);
  }, [sessionHydrated, accountHydrated, ownerKey, accounts, storedId, storedOwner,
      setActiveAccount, clearActiveAccount]);

  return null;
}
```

Keep the decision itself pure and outside React, so the bootstrap rules are unit-testable without
rendering anything:

```ts
/**
 *  - list not loaded yet          → keep the current selection (avoids a null flash)
 *  - no accounts                  → nothing can be active
 *  - current selection still real → keep it; a user's choice is never overridden
 *  - otherwise                    → the primary account, else the first
 */
export function resolveActiveAccountId(
  accounts: Account[] | undefined,
  current: number | null,
): number | null {
  if (!accounts) return current;
  if (accounts.length === 0) return null;
  if (current != null && accounts.some(a => a.id === current)) return current;
  return (accounts.find(a => a.isPrimary) ?? accounts[0]).id;
}
```

### 7.3 "Unresolved" is not "empty"

Queries keyed by the selection must stay `enabled: activeId != null` — but a *disabled* query
reports `isPending`/`isLoading === false` with `data === undefined`, which reads exactly like
"loaded, and empty". Consumers that trust that paint blank inputs and empty lists for the whole
bootstrap window. Publish an explicit pending flag and OR it into the loading state:

```ts
'use client';
export function useActiveAccountPending(): boolean {
  const mounted = useMounted();
  const { data: accounts } = useAccounts();
  const activeId = useActiveAccountId(useOwnerKey());

  if (activeId != null) return false;
  // Before the first commit the persisted selection has not been read and the list query
  // may not even have been observed — nothing is knowable yet.
  if (!mounted || !accounts) return true;
  // A non-empty list must still produce a selection (the sync pins one).
  // An account-less user resolves to `false`, so their empty state is not a forever-skeleton.
  return accounts.length > 0;
}
```

Two more rules that make this work: the list query must live in a shared options factory in `common`
(the page prefetch and the bootstrap must hit the *same* cache entry, or the bootstrap triggers a
second fetch of data the page already had), and its `data` must stay `undefined` until the list is
genuinely known — defaulting it to `[]` makes "not loaded" indistinguishable from "none exist".

## 8. Cross-tab consistency and sign-out

**Sign-out must purge, not invalidate.** `invalidateQueries` marks entries stale but keeps them
renderable — components paint the previous user's rows while the refetch runs, and the refetch may
even succeed against a fresh session. Clear the cache, then refresh the router so Server Components
re-render under the new (absent) cookie.

```tsx
'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { isPrivateRoute } from '@/common/config/private-routes';
import { useSessionStore } from '@/common/stores/session-store';
import { useActiveAccountStore } from '@/common/stores/active-account-store';

/** The ONE sign-out hook in the app. A second copy always forgets `clear()`. */
export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const signOut = useSessionStore(s => s.signOut);   // store action; see §6.2
  const clearActiveAccount = useActiveAccountStore(s => s.clearActiveAccount);

  return async () => {
    await signOut();              // clears the store, then the httpOnly cookie
    clearActiveAccount();         // a selection is meaningless without its owner
    queryClient.clear();          // drop every entry AND every mutation — not invalidate
    // Leave a route this user may no longer view; otherwise re-render Server Components
    // in place under the now-absent cookie (`references/10-routing-and-app-shell.md` §6.6).
    if (isPrivateRoute(window.location.pathname)) router.replace('/');
    else router.refresh();
  };
}
```

**Cross-tab.** A sign-out in one tab leaves the others rendering signed-in chrome until something
forces a check. Two cheap listeners, added to the same `SessionSync` component that already calls
`useSessionBootstrap()`:

```tsx
// `'session'` is the persist `name` in the store template — keep the two in step.
const reconcile = useSessionStore(s => s.reconcile);

useEffect(() => {
  // Another tab wrote the persisted session key.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== 'session') return;
    void Promise.resolve(useSessionStore.persist.rehydrate()).then(() => reconcile());
  };
  // Returning to a tab that has been idle: the refresh token may have expired meanwhile.
  const onVisible = () => {
    if (document.visibilityState === 'visible') void reconcile();
  };
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisible);
  };
}, [reconcile]);
```

The `storage` event fires only in *other* tabs, which is exactly what is wanted here. If a tab needs
to hear its own broadcasts too, use a `BroadcastChannel` instead.

**Sign-in is the mirror image.** After a successful sign-in, record the identity in the store,
`queryClient.clear()` (the anonymous cache is not the new user's), and `router.refresh()`.

## 9. Local state

Local state stays local. The one shared abstraction worth extracting is `useControllableState` — it
returns the prop when the parent passes one and internal state otherwise, so a reusable input
supports both modes without duplicating logic or silently ignoring a parent's value; it belongs to
the design-system layer (`references/02-design-system.md`).

Do not reach for `useMemo`/`useCallback`/`memo` as a reflex. Enable the React Compiler and let it
memoize — **unless the app uses react-hook-form, in which case read the compiler x `formState` trap
in `references/07-forms.md` §9 first**; the compiler memoizes reads of RHF's `formState` Proxy, so
`isValid`/`isDirty` freeze and submit buttons never enable. Where the compiler is on, keep manual
memoization only where identity is semantically load-bearing, such as a value in an effect's
dependency array that must not re-fire.

## Anti-patterns

| Never | Because | Do this instead |
| ----- | ------- | --------------- |
| Copy server data into a store (`setProducts(await fetch(...))`) | Two owners of one dataset; they diverge on the first refetch and the UI shows whichever rendered last | Let the query cache own it; the store holds only the *selection* |
| `useEffect(() => { fetch(...).then(setData) }, [])` | Fires after paint (guaranteed spinner), no dedupe, no cache, no retry policy, no cancellation, and races on fast navigation | Server Component, or `useQuery` with a shared options factory |
| `useState(() => makeQueryClient())` in the provider | Lost if the provider suspends; you silently get a second, empty cache | `getQueryClient()` — module singleton in the browser, per-request on the server |
| A module-level `QueryClient` used on the server | One cache shared by all concurrent requests — one user's data renders into another's HTML | `if (isServer) return makeQueryClient()` |
| `staleTime: 0` with hydration | Everything you just streamed refetches on mount; the prefetch bought nothing | Non-zero default (60s is a sane baseline) |
| Default `retry: 3` for everything | 401/403/404/422 can never succeed; you triple the time to show an error and triple backend load in an incident | Retry-predicate that returns `false` for 4xx (except 408/429) |
| Re-declaring the query key inline next to a prefetch | Key mismatch → hydrated entry unread → server work wasted and a spinner anyway | One `queryOptions` factory imported by both sides |
| Prefetching a query whose key comes from client state | The server has to guess the key; the guess misses and you fetch twice | Leave it client-fetched with `enabled: id != null` |
| Rendering server-fetched data in the RSC *and* reading the same data with `useQuery` | Two owners; they diverge after the first client refetch | Prefetch → render in the client component, or render server-side and skip the cache |
| `queryClient.fetchQuery()` to render inside a Server Component | Server Components are a place to prefetch, nothing more; this recreates two owners | `prefetchQuery` + `HydrationBoundary` |
| Sequential `await`s across nested Server Components | Request waterfall — total latency is the sum, not the max | One `Promise.all` at the page level |
| Putting class instances or `URL` objects in dehydrated data | Dehydrated state crosses RSC serialization; non-plain values throw or arrive mangled | Dehydrate schema-parsed plain objects only |
| `useStore()` with no selector, or `useStore(s => ({ a: s.a, b: s.b }))` without shallow compare | The first re-renders on every field change anywhere in the store; the second returns a new object every call, so the equality check never matches | One narrow selector per value; wrap object selections in `useShallow` |
| Reading `localStorage` in `useState`'s initializer or during render | Server has no storage → first client render differs from the HTML → React discards the tree | `skipHydration` + rehydrate in an effect, or a `useMounted` gate |
| Persisting a store without `skipHydration` | Storage is read at module init, before React hydrates — same mismatch, harder to spot | `skipHydration: true` and a bootstrap component that calls `rehydrate()` |
| Persisting transient flags (dialog open, submitting) | The modal reopens and the spinner sticks on the next page load | Restrict `partialize` to state a user would miss |
| Enabling the React Compiler in a form-heavy app | It memoizes reads of react-hook-form's `formState` Proxy, so `isValid`/`isDirty` stop updating and every submit button stays disabled | Leave `reactCompiler` off until the form components are proven compiler-safe (`references/07-forms.md` §9) |
| Reading or writing a store from a Server Component | The store module is one object shared by every concurrent request — cross-user state leak | Stores are `'use client'`-only; add `import 'client-only'` |
| A per-screen store that other screens depend on | The state only exists once that screen's code has loaded; every other entry point sees nothing | Promote it to `common/stores/` and resolve it in a `*Sync` bootstrap |
| One global store holding session, UI flags, form drafts, and cached lists | Every subscriber re-renders on every unrelated change, and nothing can be reasoned about or torn down independently | Several small stores with one responsibility each |
| A persisted selection with no owner key | The next user on the browser inherits it; every query keyed by that id 404s | Store `ownerKey` next to the value and read through an owner-scoped selector |
| Treating a disabled query's `data === undefined` as "empty" | Disabled queries report `isLoading === false`; the UI paints blank inputs during the whole bootstrap | Publish an explicit "still resolving" flag and OR it into the loading state |
| `invalidateQueries` on sign-out, or signing out without `router.refresh()` | Invalidated entries still render, so the next user sees the previous user's rows; and server-rendered chrome produced under the old cookie stays on screen | `queryClient.clear()` then `router.refresh()` |
| Filters/sort/page kept in a store | Breaks the back button, cannot be shared as a link, and the server can no longer prefetch the right page | Put them in `searchParams` |
| Reading the session store to decide server-side authorization | Client state is attacker-controlled; the store is a rendering convenience, not a boundary | Authorize from the session cookie on the server, every time |
