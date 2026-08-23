// src/common/api/query-keys.ts
/**
 * The central, typed, hierarchical query-key factory.
 *
 * What it must never do: be bypassed. No call site may inline a key literal, and no
 * module may keep a private key factory of its own.
 *
 * The failure it prevents: two modules independently reach for `['products']` — one for
 * a lookup list of `{ id, label }`, one for a paginated grid of full entities. They are
 * now the SAME cache entry with two incompatible shapes, so whichever renders second
 * reads the other's data and crashes on a missing field, and either module's
 * invalidation silently wipes the other's cache.
 *
 * `as const` preserves literal tuples, so `invalidateQueries({ queryKey })` and
 * `setQueryData` stay type-checked instead of degrading to `string[]`.
 *
 * Dependencies: none (plain data). `@tanstack/react-query` consumes it.
 */

/**
 * Structure: **first segment = domain (one per module), second = collection or entity,
 * then parameters.** Prefix matching then gives invalidation granularity for free:
 *
 * | Call                                                | Invalidates          |
 * | --------------------------------------------------- | -------------------- |
 * | `invalidateQueries({ queryKey: keys.billing.all })` | every billing query  |
 * | `invalidateQueries({ queryKey: keys.billing.invoices() })` | the invoice list only |
 * | `invalidateQueries({ queryKey: keys.billing.invoice(7) })` | one invoice     |
 *
 * Conventions that keep it usable:
 * - **Parameterized keys are functions; static roots are values.** A uniform shape means
 *   a caller never has to guess whether to call it.
 * - **Normalize optional parameters** (`filter ?? ''`). `undefined` and `''` would
 *   otherwise be two cache entries for the same screen.
 * - **Never key on a placeholder id without `enabled`.** `lineItems(id ?? 0)` is correct
 *   only alongside `enabled: id != null`; without it every unresolved id shares the `0`
 *   entry and one row's data appears under another's.
 */
/**
 * EMPTY ON PURPOSE, and for the same reason `MODULES` is empty in `eslint.config.mjs`:
 * no module exists yet. A namespace is added here in the SAME commit that creates the
 * module that owns it — `projects`, `design`, `media`, `studio`, `contact`, `dashboard`
 * as prompts 3–6 land them — never in advance. A speculative namespace is a key nothing
 * invalidates, which is indistinguishable from a stale cache when someone finally uses it.
 *
 * The factory ships now, before its first key, so that the first call site has somewhere
 * to put one and no module ever invents a private key literal to work around its absence.
 *
 * Scope note: most of this app is Server Components reading through `'use cache'` +
 * `cacheTag`, which is a SERVER cache and has nothing to do with these keys. React Query
 * — and therefore this factory — is confined to the client-side dashboard in prompt 6.
 */
export const queryKeys = {} as const;

/**
 * The shape every key in this factory has. Use it to type helpers that accept "any
 * key" (cache updaters, optimistic engines) instead of `unknown[]` — `readonly` is the
 * part that matters: it keeps the `as const` tuples above assignable without a cast and
 * stops a helper from mutating a key it was handed.
 */
export type AppQueryKey = readonly unknown[];
