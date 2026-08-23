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
// TODO(project): one top-level namespace per module; delete these and add your own.
export const queryKeys = {
  catalog: {
    all: ['catalog'] as const,
    products: (filter?: string) => ['catalog', 'products', filter ?? ''] as const,
    product: (id: number) => ['catalog', 'product', id] as const,
  },
  billing: {
    all: ['billing'] as const,
    invoices: (filter?: string) => ['billing', 'invoices', filter ?? ''] as const,
    invoice: (id: number) => ['billing', 'invoice', id] as const,
    lineItems: (invoiceId: number) => ['billing', 'line-items', invoiceId] as const,
  },
  accounts: {
    all: ['accounts'] as const,
    list: () => ['accounts', 'list'] as const,
    account: (id: number) => ['accounts', 'account', id] as const,
    /** The signed-in identity. Keyed separately from `account(id)`: it has its own
     *  lifetime and must be invalidated on sign-in/sign-out, not on an account edit. */
    current: () => ['accounts', 'current'] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    summary: (range: string) => ['dashboard', 'summary', range] as const,
  },
} as const;

/**
 * The shape every key in this factory has. Use it to type helpers that accept "any
 * key" (cache updaters, optimistic engines) instead of `unknown[]` — `readonly` is the
 * part that matters: it keeps the `as const` tuples above assignable without a cast and
 * stops a helper from mutating a key it was handed.
 */
export type AppQueryKey = readonly unknown[];
