# Server Actions, the ActionResult contract, and mutations

**Read this when:** you are adding a write of any kind, wiring a mutation hook, deciding what a
route should invalidate after a write, or choosing between a Server Action and a Route Handler.

Every write goes through a Server Action, and every Server Action **returns** its outcome as a
typed value instead of throwing. This file defines that contract, the mutation hook that consumes
it, the query-key factory that drives invalidation, and the two cache layers each write must
settle. Read `references/03-server-data-layer.md` first for the service layer actions call; the
form that renders a write is `references/07-forms.md`.

> **Versions.** Every example leads with the **Next.js 16** form; the 15.x equivalent is given
> inline wherever they differ. Zod examples are **zod 4** (see `references/05-contracts-and-schemas.md`
> for the zod 3 spellings).

## Invariants

- **A write Server Action RETURNS a discriminated result; it never throws for an expected
  failure.** Thrown errors are sanitized crossing the RPC boundary, destroying the status code and
  response body that rollback and field-error binding need.
- **`unwrap` is the only place a client turns a failed result back into a throw** — it re-throws an
  `ActionError` carrying `status` + `body`, so React Query's `onError` fires with full detail.
- **`toActionResult` is the only place a server-side throw becomes a result** — one normalizer, so
  no action hand-rolls its own try/catch shape.
- **Every action re-validates input and re-authorizes on the server.** An action is a public HTTP
  endpoint; the UI that calls it is not a security boundary.
- **Never accept a user/tenant/owner id as an action argument.** Read identity from the session.
- **Actions call services, never `fetch`.** No URL, header, or schema parse in an action body.
- **`redirect()` and `notFound()` throw by design — call them last, never inside a `try`.**
- **Branch on machine-readable facts (status, field keys, a stable `code`), never on message text.**
  Messages get localized and copy-edited; string matching breaks silently.
- **One exported, hierarchical, `as const` query-key factory per app.** Ad-hoc key strings collide
  across modules and silently cross-invalidate.
- **The action owns server-cache invalidation; the hook owns client-cache invalidation.** Neither
  reaches into the other's layer.
- **Optimistic mutations do all four steps** — cancel, snapshot, write, roll back + settle-invalidate.
  Skipping any one produces a specific reproducible bug (§7.1).
- **Route Handlers read the session themselves and are excluded from redirecting request
  middleware**, whose redirect response would corrupt their payload.

## 1. The central rule: return, don't throw

The contract lives in **`templates/src/common/services/action-result.ts`** — copy it to
`src/common/services/action-result.ts`. It exports exactly four things:

| Export                     | Runs on | Contract                                                                        |
| -------------------------- | ------- | ------------------------------------------------------------------------------- |
| `ActionResult<T>`          | both    | `{ ok: true; data: T } \| { ok: false; status: number; body?: unknown }`         |
| `ActionError`              | client  | thrown by `unwrap`; carries `status` + `body`, duck-typed like `HttpError`       |
| `unwrap(result)`           | client  | the ONE place a returned failure becomes a throw again, so rollback still fires  |
| `toActionResult(fn)`       | server  | the ONE place a server-side throw becomes a result; `status: 0` = never reached  |

The file has no `'use server'` and no `server-only`: it is imported from both runtimes on purpose.

### Why, precisely

An error thrown inside a Server Action is **serialized and sanitized** before reaching the browser.
In production the client receives a generic `Error` whose message is a variant of "An error occurred
in the Server Components render" plus an opaque `digest`. Everything you needed is gone:

| Lost when you throw     | What breaks                                                                   |
| ----------------------- | ----------------------------------------------------------------------------- |
| HTTP status             | Rollback can't tell "409, refetch" from "422, keep the form open"             |
| Response body           | Field errors can't be bound back to inputs (`setError('email', …)`)           |
| Error class identity    | `instanceof HttpError` is false on the client — the prototype doesn't survive |
| Backend `code`/`detail` | UI can't branch a flow ("already exists → offer sign-in instead")             |

A plain object survives serialization intact. That is the whole reason the contract is a value, not
an exception. It also makes the failure path **type-checked**: `if (!result.ok)` narrows, so a caller
cannot forget the failure branch the way it can forget a `catch`.

Two other things still throw and must keep throwing: `redirect()` / `notFound()`, which signal by
throwing a control-flow exception the framework catches (§5.4), and genuine server bugs — let those
reach `error.tsx` rather than disguising them as `ok: false`. Everything *expected* — validation,
4xx, conflict — returns.

### The read/write asymmetry, stated on purpose

**Write actions must return. Read actions may throw.** This is deliberate, not an oversight — do
not "fix" it by wrapping every read in `toActionResult`.

A write failure carries information the caller must *act on*: which field to re-focus, whether to
roll an optimistic update back, whether a 409 means "refetch and retry" or a 422 means "keep the
form open". None of that survives the RPC boundary as a throw, so it must be a value.

A read failure carries nothing the caller can act on beyond "it failed". Its consumer is a query's
`isError` branch or an `error.tsx` boundary, both of which are *built* on the throw channel —
converting it to a value means every read call site must hand-unwrap a result only to re-throw it,
and a forgotten branch renders `undefined` instead of an error state. So a read stays a plain
`async` pass-through.

The one case that crosses over: **wrap a read in `toActionResult` when its status changes the UI**
(401 → sign-in prompt rather than an error screen, 404 → empty state). Then the status is
information the caller acts on, and the write rule applies for the same reason.

### The two return shapes, and how they relate

There are exactly two, and the second is *derived* from the first — never hand-written per action.

| Consumer                                                       | Return            | Defined in                                    |
| -------------------------------------------------------------- | ----------------- | --------------------------------------------- |
| A mutation hook that rolls back / binds field errors           | `ActionResult<T>` | the template above                            |
| A `useActionState` form that renders the outcome directly (§5.3, `references/07-forms.md` §2) | `ActionState<T>`  | the addendum below, in the same file          |

`ActionState` exists because `useActionState` needs a reducer state with an **idle** case and with
the message already shaped on the server (message-shaping needs backend and locale knowledge the
client does not have).

**The template ships only the wire contract.** `ActionState`, `zodFieldErrors` and `toActionState`
are deliberately not in `templates/src/common/services/action-result.ts`: they depend on
`@/common/errors`, and an app with no tier-1 forms should not pay that import. This block is their
one canonical definition in the whole skill — append it verbatim to
`src/common/services/action-result.ts` the first time you write a tier-1 form, and do **not**
hand-write a variant shape (`{ ok, message, fieldErrors }`) beside it. Everything that consumes a
form outcome — `references/06-error-system.md` §4.1, `references/07-forms.md` §2 — imports these
names from this path.

```ts
// --- append to src/common/services/action-result.ts ---
import { z } from 'zod';
import { mapError } from '@/common/errors';
import type { ErrorOverrides, FieldErrors } from '@/common/errors/types';

/**
 * The value a tier-1 Server Action returns to `useActionState`. Discriminated on
 * `status` so the JSX cannot read `fieldErrors` off a success state, and so the initial
 * render has a real state instead of `null`.
 *
 * `fieldErrors` is the SAME `FieldErrors` shape (one message per field) the error system
 * produces, so tier 1 and tier 2 consume identical data and promoting a form from one
 * tier to the other does not touch the error-binding code.
 */
export type ActionState<T = void> =
  | { status: 'idle' }
  | { status: 'error'; message?: string; fieldErrors?: FieldErrors }
  | { status: 'success'; data?: T };

/** Collapse a ZodError to one message per field. (zod 3: `error.flatten().fieldErrors`.) */
export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  return Object.fromEntries(
    Object.entries(flat).flatMap(([key, messages]) =>
      messages?.[0] ? [[key, messages[0]] as const] : [],
    ),
  );
}

/**
 * Derive the form-facing shape from the wire shape, through the ONE normalizer.
 * Hand-writing `{ ok:false, message: … }` per action is how twelve actions end up with
 * twelve different guesses at the backend's error envelope.
 */
export function toActionState<T>(
  result: ActionResult<T>,
  overrides?: ErrorOverrides,
): ActionState<T> {
  if (result.ok) return { status: 'success', data: result.data };
  const mapped = mapError({ status: result.status, body: result.body }, overrides);
  return { status: 'error', message: mapped.message, fieldErrors: mapped.fieldErrors };
}
```

`mapError` accepts any `{ status, body }` by duck-typing, which is why an `ActionResult` can be fed
to it directly — see `references/06-error-system.md` §2.

## 2. `'use server'` placement

`'use server'` must be the **first line of the file** and applies to every export in it.

- **One file per entity** (`actions/invoice-actions.ts`). Inline `'use server'` inside a component
  body is only for tiny single-use closures; it hides an HTTP endpoint inside JSX where no reviewer
  looks for one.
- **Every export becomes a public POST endpoint** with a stable id baked into the client bundle.
  Exporting a helper "just for reuse" publishes it — keep helpers in a plain module and import them.
- **Only `async` functions may be exported.** Exporting a constant or sync function is a build error.
- **Arguments and returns must be serializable** by the RSC serializer: primitives, plain
  objects/arrays, `Date`, `Map`/`Set`, `FormData`, `File`, typed arrays, promises. **Class instances
  are not** — which is exactly why the failure channel is `{ ok, status, body }`, not an `HttpError`.
- **Typed object args are fine; `FormData` is not required.** Use `FormData` only for uploads or
  progressively-enhanced `<form action={…}>`. Raise the action body-size limit in framework config
  if uploads exceed the ~1 MB default (`experimental: { serverActions: { bodySizeLimit: '20mb' } }`).

## 3. Security: re-authorize, re-validate, never trust an id

**Order matters, and it is authorize-then-validate.** The session check runs before the schema
parse, so an anonymous caller gets a 401 and learns nothing about the shape the endpoint accepts,
and no parsing work is done for a caller who was never allowed in. Never "fix" a 401 that surprises
a unit test by moving the auth check below the parse — that is a security regression; mock the
session instead (`references/09-mocking-and-testing.md` §9.4).

```ts
'use server';

import { z } from 'zod';
import { readSession } from '@/common/services/session';
import { updateInvoice } from '@/common/services/invoice-service';
import { toActionResult, type ActionResult } from '@/common/services/action-result';
import { invoiceUpdateSchema } from '../schemas/invoice';
import type { Invoice } from '../types';

export async function updateInvoiceAction(
  id: number,
  input: unknown,
): Promise<ActionResult<Invoice>> {
  // 1. Re-authenticate FIRST. The session comes from the httpOnly cookie, never an
  //    argument, and an anonymous caller must not learn the accepted input shape.
  const { access } = await readSession();
  if (!access) return { ok: false, status: 401 };

  // 2. Re-validate with the SAME schema the client used. Client validation is UX;
  //    server validation is the contract. A hand-crafted POST skips the form entirely.
  const parsed = invoiceUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  // 3. Authorize the specific object — here by the backend scoping the write to the
  //    bearer token's account. An action that trusts a client-supplied accountId is an
  //    IDOR waiting to be found.
  return toActionResult(() => updateInvoice(id, parsed.data));
}
```

Never write `updateInvoiceAction(accountId, id, data)`. The caller controls every argument; the
session is the only input it cannot forge.

> **Version note.** `cookies()`, `headers()`, `params` and `searchParams` are **async** on 15.x and
> 16.x (`await cookies()`). Synchronous access is deprecated on 15.x and removed in 16; on ≤14 it
> was the only form.

## 4. Where actions live, and what they may call

| Action kind                                                                  | Location                                        | Rule                                                                             |
| ---------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------- |
| Invoked by shared/cross-cutting code (session, global stores, shared shells) | `common/actions/*.ts`                           | `common/` may not import a feature module, so anything it invokes must live here |
| Invoked only by one feature                                                  | `modules/<feature>/actions/<entity>-actions.ts` | One file per entity, beside that module's schemas                                |

Split by _who calls it_, not by _what it touches_. If a shared component needs the read but only one
module performs the writes, the read action moves to `common/actions/` and the writes stay in the
module. See `references/01-layering-and-boundaries.md`.

**Actions call services. Always.** An action containing a URL, header, or schema parse has absorbed
the data layer and can no longer be reused from a Server Component. The chain is:

```
Component/hook → Server Action → service (server-only, validated) → HTTP client → backend
```

```ts
'use server';
import { listInvoices, createInvoice, deleteInvoice } from '@/common/services/invoice-service';
import { toActionResult } from '@/common/services/action-result';

/* reads: thin pass-through, allowed to throw — rejection lands in the query's isError */
export async function listInvoicesAction() {
  return listInvoices();
}

/* writes: always wrapped */
export async function createInvoiceAction(input: InvoiceCreateBody) {
  return toActionResult(() => createInvoice(input));
}
export async function deleteInvoiceAction(id: number) {
  return toActionResult(() => deleteInvoice(id));
}
```

Wrap a **read** in `toActionResult` too when the status changes the UI (401 → sign-in prompt, 404 →
empty state instead of an error screen).

## 5. Canonical action shapes

### 5.1 Write returning field errors for a form

Use `ActionState` (§1) so `useActionState` can render the outcome directly, and derive it with
`toActionState` so the error envelope is parsed in one place. The only hand-written branches are the
ones that carry knowledge no normalizer has.

```ts
'use server';
import { z } from 'zod';
import { mapError } from '@/common/errors';
import { type ActionState, zodFieldErrors } from '@/common/services/action-result';

export async function registerAccountAction(
  _prev: ActionState,
  input: RegisterInput,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', fieldErrors: zodFieldErrors(parsed.error) };
  }
  try {
    await createAccount(parsed.data);
    return { status: 'success' };
  } catch (err) {
    const mapped = mapError(err); // one normalizer → status/code/message/fieldErrors

    // One status, two causes: a 400 here means "email taken" OR "password rejected by
    // the password policy". Blanket-mapping every 400 to "email taken" sends people off
    // to sign in to an account that does not exist. Branch on WHICH FIELD the backend
    // named, not on the status alone.
    if (mapped.status === 400 && !mapped.fieldErrors.email) {
      return {
        status: 'error',
        message: mapped.fieldErrors.password
          ? 'That password was rejected. Choose a stronger one.'
          : 'The submitted data is not valid.',
      };
    }
    return { status: 'error', message: mapped.message, fieldErrors: mapped.fieldErrors };
  }
}
```

Where the UI must change **flow** rather than copy (offer sign-in instead of dead-ending on a
toast), branch on a stable machine-readable `code` — never on `message`. Pass it through as an
override (`mapError(err, { byCode: { already_registered: '…' } })`) or widen `ActionState`'s error
case with a `code?: string` field in your own copy of the file.

Bind `fieldErrors` back onto the inputs — `references/07-forms.md` §2.3 and §4. That binding is the
concrete reason the body must survive the boundary.

### 5.2 Action that writes cookies / session state

Cookie writes are legal **only** in Server Actions, Route Handlers, and the request-interception
layer — never during a Server Component render. Keep credentials fully server-side: the action
calls the backend _and_ writes the httpOnly cookie, so tokens never enter client JavaScript.

```ts
'use server';
import { errorMessage } from '@/common/errors';
import { writeSession } from '@/common/services/session';
import type { ActionState } from '@/common/services/action-result';

export async function signInAction(_prev: ActionState, input: Credentials): Promise<ActionState> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', message: 'Enter your email and password.' };
  try {
    const { tokens } = await signIn(parsed.data);
    await writeSession(tokens.access, tokens.refresh); // httpOnly cookies, server-side
    return { status: 'success' };
  } catch (err) {
    return {
      status: 'error',
      message: errorMessage(err, { byStatus: { 401: 'Email or password is incorrect.' } }),
    };
  }
}
```

Corollary: **when a write invalidates existing credentials server-side (password change, role
change), clear the session cookies in the same action.** Otherwise the UI looks signed in while
every subsequent request 401s.

### 5.3 Action that revalidates, and the form-action tier

```ts
'use server';
import { updateTag } from 'next/cache';

export async function publishProductAction(id: number) {
  const result = await toActionResult(() => publishProduct(id));
  if (result.ok) {
    updateTag('catalog:products');        // read-your-own-writes: fresh in this same request
    updateTag(`catalog:product:${id}`);   // invalidate ONLY on success (§8)
  }
  return result;
}

// Progressively-enhanced tier: FormData in, ActionState out.
export async function saveSettingsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = settingsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: 'error', fieldErrors: zodFieldErrors(parsed.error) };
  const result = await toActionResult(() => saveSettings(parsed.data));
  if (!result.ok) return toActionState(result);
  updateTag('accounts:settings');
  return { status: 'success' };
}
```

Client: `const [state, formAction, pending] = useActionState(saveSettingsAction, { status: 'idle' })`
then `<form action={formAction}>`. Use this tier for small flat forms (≤ ~5 fields, no live
cross-field logic) — pending state comes free and the form posts before hydration. Use the React
Query tier (§7) for dynamic arrays, wizards, drag-reorder, or data rendered in several places.

### 5.4 Action that redirects — the gotcha

```ts
'use server';
import { redirect } from 'next/navigation';

export async function createProductAction(input: NewProduct) {
  const result = await toActionResult(() => createProduct(input));
  if (!result.ok) return result;          // failure path returns, as always
  updateTag('catalog:products');
  redirect(`/catalog/${result.data.id}`); // LAST statement, outside any try/catch
}
```

`redirect()` and `notFound()` signal by **throwing a control-flow exception the framework catches**:

- **Never call them inside a `try` whose `catch` swallows errors** — your catch eats the redirect,
  navigation silently doesn't happen, and you return a bogus error result. If you must redirect from
  inside error handling, re-throw anything carrying a framework digest, or restructure so the
  redirect runs after the `try/catch`.
- **Code after `redirect()` is unreachable.** Do all cache invalidation before it.
- Its return type is `never`; an action that _sometimes_ redirects still needs its result type on
  the other branch.

## 6. Query keys: one factory, hierarchical, typed

Copy `templates/src/common/api/query-keys.ts` and replace its sample domains with yours. It is one
`as const` object of the shape `queryKeys.<domain>.<collection|entity>(…)`; `as const` preserves the
literal tuples, which is what keeps `invalidateQueries` type-checked.

- **Never inline a key literal at a call site.** Two modules that both reach for `['products']`
  cross-invalidate each other — one module's lookup list and another's grid become the same cache
  entry, with mismatched shapes.
- **First segment = domain, second = collection/entity, then parameters.** Prefix matching then
  gives invalidation granularity for free:

| Call                                                            | Invalidates           |
| --------------------------------------------------------------- | --------------------- |
| `invalidateQueries({ queryKey: queryKeys.billing.all })`        | every billing query   |
| `invalidateQueries({ queryKey: queryKeys.billing.invoices() })` | the invoice list only |
| `invalidateQueries({ queryKey: queryKeys.billing.invoice(7) })` | one invoice           |

- **Parameterized keys are functions; static roots are values.** Uniform shape means callers never
  guess whether to call it.
- **Never key on a placeholder without `enabled`.** `lineItems(id ?? 0)` with `enabled: id != null`
  is correct; without `enabled`, every unresolved id shares the `0` entry and one row's data appears
  under another's.
- **Share `queryOptions` factories** so a Server Component prefetch and the client hook use the same
  key _and_ `queryFn` — a mismatch means the hydrated cache misses and the client refetches
  everything it just received.

```ts
export function invoicesOptions() {
  return queryOptions({ queryKey: queryKeys.billing.invoices(), queryFn: () => listInvoicesAction() });
}
```

## 7. The React Query pairing

`mutationFn` calls the action and `unwrap`s it. That line joins the two halves of the contract: the
action returned a value; the hook turns a failed value back into a throw so React Query's error
machinery works normally — except the thrown object is an `ActionError` with `status` and `body`
intact.

### 7.1 The four steps of an optimistic mutation

Every optimistic write performs the same four steps. **All four are mandatory**, and each prevents
a specific bug:

| Step                                        | Skip it and you get                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1. `cancelQueries` on the key               | An in-flight refetch resolves with pre-mutation data — the optimistic change "flickers away" |
| 2. snapshot with `getQueryData`             | Nothing to roll back to; a failed write leaves a phantom row until a hard reload             |
| 3. `setQueryData` with a **pure** transform | (this is the change itself)                                                                  |
| 4a. roll back in `onError`                  | The UI permanently disagrees with the server                                                 |
| 4b. `invalidateQueries` in `onSettled`      | The cache lies after server normalization — generated ids, trimmed strings, re-sorted order  |

Use `onSettled`, not `onSuccess`, for the reconcile: it runs on both outcomes.

Write the four steps **inline in the mutation hook**, as below. Do not start by extracting a
generic `useOptimisticCrud` engine into `common/hooks/` — that violates promote-on-the-second-
consumer (`references/01-layering-and-boundaries.md` §6), and a generic engine written against one
call site invariably gets the `key: null` and rollback-context generics wrong. When a third list
mutation appears and all three are genuinely the same shape, *then* promote the closure to
`common/hooks/useOptimisticCrud.ts` with the same four steps.

### 7.2 A concrete list mutation

```ts
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/common/api/query-keys';
import { ActionError, unwrap } from '@/common/services/action-result';
// plus: the three actions and the entity types.

type LineItemVars =
  | { kind: 'add'; data: NewLineItem }
  | { kind: 'reorder'; data: ReorderEntry[] }
  | { kind: 'delete'; data: { id: number } };

/**
 * PURE optimistic transform, exported so it is unit-testable without a network or a
 * React tree. `add` is a no-op: the server assigns the id, reconciled on settle.
 */
export function optimisticLineItems(old: LineItem[], vars: LineItemVars): LineItem[] {
  if (vars.kind === 'delete') return old.filter(item => item.id !== vars.data.id);
  if (vars.kind === 'reorder') {
    const orderById = new Map(vars.data.map(entry => [entry.id, entry.order]));
    return [...old]                                   // copy: never mutate cached arrays
      .map(item => (orderById.has(item.id) ? { ...item, order: orderById.get(item.id)! } : item))
      .sort((a, b) => a.order - b.order);
  }
  return old;
}

export function useUpdateLineItems(invoiceId: number | null) {
  const queryClient = useQueryClient();
  // `null` while the parent id is unresolved: the mutation still runs, it just does not
  // touch the cache — writing to a key built from `id ?? 0` corrupts a shared entry.
  const key = invoiceId != null ? queryKeys.billing.lineItems(invoiceId) : null;

  return useMutation<
    LineItem[], ActionError, LineItemVars, { previous: LineItem[] | undefined } | undefined
  >({
    mutationFn: async vars => {
      switch (vars.kind) {
        case 'add':     return unwrap(await addLineItemAction(vars.data));
        case 'reorder': return unwrap(await reorderLineItemsAction(vars.data));
        case 'delete':  return unwrap(await deleteLineItemAction(vars.data.id));
      }
    },

    onMutate: async vars => {
      if (!key) return undefined;
      await queryClient.cancelQueries({ queryKey: key });        // 1
      const previous = queryClient.getQueryData<LineItem[]>(key); // 2
      queryClient.setQueryData<LineItem[]>(key, (old = []) => optimisticLineItems(old, vars)); // 3
      return { previous };
    },

    onError: (error, _vars, context) => {                         // 4a
      if (key && context?.previous) queryClient.setQueryData(key, context.previous);
      // status + body survived the boundary, so the UI can answer a specific rejection.
      const body = error.body as { product_id?: string[] } | undefined;
      if (error.status === 400 && body?.product_id) {
        toast.error('That item is already on the invoice.');
      }
    },

    onSettled: () => {                                            // 4b
      if (key) queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
```

- **Extract the optimistic transform as a pure function.** It's the part most likely to be wrong
  (mutating the cached array, losing sort order) and the only part testable in milliseconds.
- **Never mutate `old`.** You're handed the cached reference; mutating it defeats structural sharing
  and re-render detection.
- `mutateAsync` when the caller needs the promise (an RHF `handleSubmit` that must await); otherwise
  `mutate` + callbacks.
- `setQueryData(key, response)` in `onSuccess` is a fine optimization **alongside** the settle
  invalidation, never a replacement for it.

### 7.3 Make failures visible

Wire the caches, the retry policy and the dehydration defaults **once**, in
`common/lib/query-client.ts` — see `templates/src/common/lib/query-client.ts` and
`references/08-state-and-data-flow.md` §4, which is the only prose home for those defaults. Do not
construct a second `QueryClient` here or anywhere else; the two that matter most for this guide are
that failures are logged (an `isError` with no console trace costs hours) and that the retry policy
**does not retry 4xx** — a retried mutation without an idempotency key can create the same record
twice.

## 8. Server-side cache invalidation

Tag at the point of the fetch, then invalidate by tag from the write.

```ts
// service layer — fetch-options form (works on 15.x and 16.x)
return apiFetch('/products/', productsSchema, {
  auth: false,
  next: { revalidate: 600, tags: ['catalog:products'] },
});

// or, with Cache Components (16.x)
export async function getProducts() {
  'use cache';
  cacheLife('hours');
  cacheTag('catalog:products');
  return apiFetch('/products/', productsSchema, { auth: false });
}
```

Tag convention: one collection tag per entity (`catalog:products`) plus one instance tag per record
(`catalog:product:42`), so mutations invalidate precisely instead of nuking a path.

| API                           | Where it may run         | Behavior                                                                   | Use for                                                                       |
| ----------------------------- | ------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `updateTag(tag)`              | Server Actions only      | Expires immediately; same request reads fresh                              | Read-your-own-writes: forms, settings — anything the user must see change now |
| `revalidateTag(tag, profile)` | Actions + Route Handlers | Stale-while-revalidate: stale served, refreshed in background              | Content tolerating delay: catalogs, articles, webhook syncs                   |
| `refresh()`                   | Server Actions only      | Re-renders **uncached** RSC content on the client router; touches no cache | Live counters/badges after an action                                          |
| `revalidatePath(path)`        | Actions + Route Handlers | Invalidates everything under a path                                        | Escape hatch when tags are unknown — prefer tags                              |

> **Version note.** On **Next.js 16** pass the second argument — a cache-life profile name, or
> `{ expire: seconds }`; `'max'` is the sane default. The single-argument `revalidateTag(tag)` is
> **deprecated on 16, not removed**: it still compiles, which is exactly why it survives code
> review, so migrate deliberately rather than trusting the build to tell you. On 15.x the
> single-argument form is the only signature. `updateTag` and `refresh` are 16-only Cache
> Components APIs; on 15.x use `revalidateTag(tag)` and client-side `router.refresh()`.

**Dual-cache coherence.** Every write settles two caches with different owners:

| Layer                  | Settled by                    | Where                              |
| ---------------------- | ----------------------------- | ---------------------------------- |
| Framework server cache | `updateTag` / `revalidateTag` | inside the Server Action           |
| Client query cache     | `invalidateQueries`           | in the mutation hook's `onSettled` |

Neither reaches into the other's layer: an action _cannot_ invalidate React Query (wrong runtime),
and a hook that invalidates the server cache has re-implemented the action.

## 9. Route Handlers: when an action is the wrong tool

| Need                                                                          | Surface                                 |
| ----------------------------------------------------------------------------- | --------------------------------------- |
| Mutate data from your own UI                                                  | **Server Action**                       |
| Render data into UI                                                           | Server Component (+ cache tags)         |
| Interactive per-user client cache                                             | React Query hook over an action         |
| Stream a binary/file response (PDF, CSV, ZIP, image)                          | **Route Handler**                       |
| Third-party webhook / OAuth callback                                          | **Route Handler**                       |
| Consumer that isn't your React app (mobile, cron, another service)            | **Route Handler**                       |
| Anything that must be a linkable URL (`<iframe src>`, new tab, download link) | **Route Handler**                       |
| Proxying your own Server Components to your own backend                       | **Neither** — call the service directly |

- **Handlers read the session themselves.** They sit outside the component tree, so nothing injects
  auth; call the same session/service helpers an action would.
- **Exclude `/api/*` from redirecting request middleware.** A middleware redirect replaces your JSON
  or binary stream with a 307 + HTML-ish body, and the caller — often a third party you cannot debug
  — sees a corrupt payload instead of a 401.
- **Set `Cache-Control: private, no-store` on anything personal.** A shared CDN cache on a per-user
  document is a data leak.
- **Prefer `GET` with URL parameters over POST-a-blob.** A `GET /api/documents/invoice?id=42` is
  linkable, embeddable, and keeps the data server-side; posting an assembled payload back from the
  client makes a purely server-side render depend on client state.
- **Validate every URL parameter before use.** They are attacker-controlled; a handler that
  forwards `searchParams.get('id')` straight into a service has no boundary at all.
- **Guard a webhook with a shared secret compared as a HEADER, and fail closed on a missing env
  var.** With the secret in a JSON body field and the env var unset, `body.secret !== process.env.X`
  compares `undefined !== undefined` — false — and the purge endpoint is open to anyone.
- **Allowlist the tags a webhook may purge.** A caller that can purge arbitrary tags can stampede
  your backend.

The two canonical handlers — binary streaming with `mapError` and the secret-guarded webhook purge —
are written out once, in `references/10-routing-and-app-shell.md` §7. Do not re-derive them here.

## 10. Testing actions and mutations

The mechanics (node environment, mocking `next/headers`, the request-interception layer) are in
`references/09-mocking-and-testing.md` §9.4. Four assertions are specific to *this* contract and are
the ones agents omit:

- **Assert `ok: false`, not `rejects`.** A test expecting a throw is asserting the bug this contract
  exists to prevent.
- **Assert the side effect, not just the return value** — after sign-in the cookie store holds a
  session; after a password change it is empty.
- **Assert which endpoint was hit** when an action branches between two backends. A test that only
  checks `ok: true` stays green after someone deletes the branch.
- **Assert the cache tag.** Mock the cache module and check the action invalidated what it claims —
  a missing `updateTag` is invisible in every other kind of test.

Separately, unit-test the pure optimistic reducer (§7.2): delete removes by id, reorder sorts, add
is a no-op, and the input array is not mutated. It needs no React tree and runs in milliseconds.

## Anti-patterns

| Never                                                             | Because                                                                                                | Do this instead                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `throw new Error('conflict')` inside a write action               | Sanitized across the RPC boundary — the client loses status and body; rollback and field binding break | `return { ok: false, status, body }` via `toActionResult`            |
| `catch (e) { if (e instanceof HttpError) … }` on the client       | Class identity doesn't survive serialization; the check is always false                                | Duck-type `{ status, body }`, or use the `ActionError` from `unwrap` |
| Passing `userId` / `accountId` as an action argument              | The caller controls every argument — straight IDOR                                                     | Read identity from the session inside the action                     |
| Trusting client-side validation                                   | The action is a public endpoint reachable with `curl`                                                  | `safeParse` the same schema server-side, every time                  |
| `redirect()` inside a `try` block                                 | Your `catch` swallows the control-flow throw; navigation silently never happens                        | Call it after the `try/catch`, as the last statement                 |
| Branching UI on `message.includes('already exists')`              | Messages get localized and copy-edited; the branch dies silently                                       | Return a stable `code` and branch on that                            |
| Mapping every 4xx of one status to one message                    | One status usually has several causes; users are told to fix the wrong thing and loop                  | Branch on which field the backend named                              |
| Client `fetch` to your own backend for a write                    | Bypasses validation, authorization and invalidation, and exposes tokens to client JS                   | Server Action → service                                              |
| Route Handler as an internal proxy for your own Server Components | Extra network hop, lost type safety, duplicated auth                                                   | Call the service directly                                            |
| `queryKey: ['products']` inline at a call site                    | Collides with another module's key; silent cross-invalidation and shape mismatches                     | `queryKeys.catalog.products()` from the one factory                  |
| `onSuccess: setQueryData(...)` with no settle invalidation        | Cache lies after server normalization (ids, trimming, ordering)                                        | Keep `onSettled: invalidateQueries` too                              |
| Optimistic update without `cancelQueries`                         | An in-flight refetch overwrites it — the classic "my change flickered away"                            | Do all four steps                                                    |
| Mutating the array inside `setQueryData`                          | Kills structural sharing; components don't re-render                                                   | Return a new array from a pure transform                             |
| Exporting a non-action helper from a `'use server'` file          | Publishes it as a callable endpoint (build error if not async)                                         | Keep helpers in a plain module                                       |
| `updateTag` before knowing the write succeeded                    | Discards valid cache on failure, causing needless refetch load                                         | Invalidate inside `if (result.ok)`                                   |
| Letting redirecting middleware match `/api/*`                     | The redirect response replaces your JSON/binary payload; callers see garbage                           | Exclude `api` in the matcher                                         |
| Comparing a body-supplied `secret` to an env var with `!==` alone | If the env var is unset, `undefined !== undefined` is false → the purge endpoint is wide open          | Fail closed on a header: `if (!secret \|\| header !== secret)`       |
| Accepting any tag a webhook sends                                 | Arbitrary purges let a caller stampede your backend                                                    | Allowlist the tags you support                                       |
