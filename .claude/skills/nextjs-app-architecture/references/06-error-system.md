# One normalized error, everywhere

**Read this when:** an error renders wrong, blank, or as raw JSON; you are deciding where an error
boundary goes or why one is not firing; a retry button does nothing; or you need to branch the UI
on a failure.

Every failure in the app — a backend 4xx, a dropped connection, a schema rejection, a thrown
render — becomes the same four-field object before any UI touches it. This file defines that
object, the single mapper that produces it, the message tables that localize it, the boundary
tiers that catch what escapes, and the development-only logging layer that makes failures loud in
dev and silent in production.

> **Versions.** Every example leads with the **Next.js 16** form; the 15.x equivalent is given
> inline wherever they differ. Zod examples are **zod 4** (see `references/05-contracts-and-schemas.md`
> for the zod 3 spellings).

## Invariants

- **Exactly one error shape reaches the UI: `{ status, code, message, fieldErrors }`.** Call sites
  that sniff ad-hoc fields (`err.response?.data?.detail ?? err.body?.errors?.[0]`) each encode a
  different guess about the backend and each rot independently.
- **`mapError` is the only place a thrown value is interpreted.** One file to change when the
  backend adds an error shape; one file to test.
- **Extract `status`/`body` by duck-typing, never `instanceof`.** An error that crossed the Server
  Action RPC boundary, a structured-clone, or a module boundary is no longer an instance of your
  class — `instanceof` silently downgrades a real 403 to a generic network error.
- **`message` is never empty.** The last candidate in the chain is an unconditional constant, so no
  UI ever renders "Error: " or an empty toast.
- **Trust body-derived strings only when `status > 0`.** At `status === 0` the "body" is an
  internal JS message (`fetch failed`, `Cannot read properties of undefined`); showing it leaks
  implementation detail and confuses users.
- **Branch on `status`, `code`, or which field key the backend named — never on message text.**
  Messages get localized and copy-edited; string matching breaks silently at the next copy change.
- **Never render a raw `error.message` in a production error boundary.** Server errors are scrubbed
  to a `digest`; the untrusted remainder is either useless or an information leak.
- **`global-error.tsx` must render its own `<html>` and `<body>` and use inline styles.** It
  replaces the root layout, so no app CSS, font, or provider is guaranteed to exist.
- **Development logging is guarded by one `NODE_ENV` constant so it is dead code in production.**
  Backend bodies must never reach a production console.
- **A failure may only be swallowed with a written reason and a narrow guard.** `catch {}` around
  anything else converts a bug into a wrong-looking screen with no trace.
- **Never wrap `redirect()` or `notFound()` in a `try`.** They work by throwing; a catch turns
  navigation into a swallowed error.
- **Optimistic rollback restores state _and_ surfaces the cause.** Rolling back silently makes the
  user's edit vanish with no explanation.

## 1. The shape everything converges on

The whole module is five files under `templates/src/common/errors/` — `types.ts`, `parse-body.ts`,
`map-error.ts`, `messages.ts`, `index.ts`. Copy all five; import only through the barrel
(`@/common/errors`), never deeper.

```ts
interface NormalizedError {
  status: number;             // HTTP status when known; 0 = never got a response
  code: string | null;        // machine-readable, from body.code — the only safe branch key
  message: string;            // user-facing, localized, GUARANTEED non-empty
  fieldErrors: FieldErrors;   // Record<string, string> — one message per field
}
```

`code` is `string | null`, not `string | undefined`: every consumer branches on it, and a field
that is sometimes-absent and sometimes-null produces two different falsy checks across the app.

Producers that must all normalize to it:

| Producer                                                  | Shape it throws                                                      | Notes                                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| Transport layer (`HttpError`)                             | `{ status, statusText, body, url }`                                  | body = parsed backend payload                              |
| Client re-throw after RPC (`ActionError`)                 | `{ status, body }`                                                   | see `references/04-actions-and-mutations.md`               |
| Backend single message                                    | `{ detail: string }` or `{ error: string }` or `{ message: string }` | one human string                                           |
| Backend field errors                                      | `{ email: ["already taken"] }`                                       | field-keyed; DRF, Laravel, pydantic-style APIs all do this |
| Backend form-level errors                                 | `{ non_field_errors: ["..."] }`                                      | validation not attributable to one field                   |
| Backend machine code                                      | `{ code: "already_registered", ... }`                                | the only safe thing to branch flow on                      |
| Schema rejection, `fetch` failure, abort, arbitrary throw | plain `Error` / unknown                                              | becomes `status: 0`                                        |

**Why one shape.** Each of those producers is a different library's convention. Without a
normalizer, every toast, every form, every boundary re-implements the union — and the day the
backend adds `non_field_errors` to one endpoint, only the call sites someone remembered to update
show it. One shape means the UI's type is `NormalizedError`, and adding a backend convention is a
change to `parseBody` plus one test.

## 2. `mapError` in full

### 2.1 Duck-typed extraction

`extractStatusBody` in `map-error.ts` pulls `{ status, body }` off any thrown value by **structural
read**, not `instanceof`. Every producer in the table above satisfies `{ status: number }`; anything
that does not becomes `{ status: 0, body: undefined }`.

This is also why an `ActionResult` failure can be fed straight to `mapError`
(`references/04-actions-and-mutations.md` §1) — it is
already `{ status, body }`.

`instanceof HttpError` fails in at least four routine situations: after RPC serialization, across
duplicated module instances (server bundle vs client bundle), for errors thrown by a dependency
that mimics the shape, and in tests that construct a literal. Each failure downgrades a precise
403 into "network error, check your connection" — the single most misleading message in the table.

### 2.2 Parsing the body

`parse-body.ts` turns an arbitrary backend body into
`{ code, detail, nonFieldErrors, fieldErrors }`. The single decision you must make when adopting it
is **`RESERVED_KEYS`** — the keys that carry meta rather than per-field validation, and therefore
never become field errors. The template reserves
`detail`, `code`, `message`, `error`, `non_field_errors`.

Why that matters concretely: a body like `{ error: "Invalid credentials" }` is a common
single-message envelope. Left unreserved it parses as a field literally named `error`, which both
pollutes form `setError` loops with a phantom field **and** — because a field error outranks the
status default in the chain below — surfaces the raw, untranslated backend string to the user.
Folding it into `detail` keeps it reachable but ranked below any explicit override.

Adapt `RESERVED_KEYS` and the form-level-errors key name to your backend's envelope; keep the rule:
**any key that is not a real form field must be reserved.**

### 2.3 The mapper and its precedence chain

`mapError(error, overrides?)` resolves `message` by walking eight candidates in order and taking
the first non-empty one. This chain is the part of the module you must not modify without
understanding it — everything else is mechanical.

```
1. overrides.byCode[code]                    ← this call site, by machine code
2. overrides.byStatus[status]                ← this call site, by status
3. DEFAULT_BY_CODE[code]                     ← app-wide meaning of a known code
4. body.detail                    ┐
5. body.non_field_errors[0]       ├ only when status > 0  (the `fromBackend` guard)
6. first value of fieldErrors     ┘
7. DEFAULT_BY_STATUS[status]                 ← app-wide message for the status
8. GENERIC_MESSAGE                           ← unconditional, so message is never empty
```

Two convenience wrappers ship alongside it: `errorMessage(error, overrides?)` (just the message)
and `fieldErrors(error)` (just the field map, ready for a `setError` loop).

Why this order, rung by rung:

| #   | Candidate                                            | Why it sits here                                                                                                           |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | `overrides.byCode[code]`                             | The call site knows the flow ("this 400 on sign-up means the address is taken"). A code is stable; it outranks everything. |
| 2   | `overrides.byStatus[status]`                         | Same reasoning, weaker key. Above backend strings because the backend's copy is usually untranslated.                      |
| 3   | `DEFAULT_BY_CODE[code]`                              | App-wide meaning of a known code, so N call sites don't repeat one override.                                               |
| 4–6 | `detail` → `non_field_errors[0]` → first field error | Backend specificity, most-specific-first. Better than a generic status line _when it is a real response_.                  |
| 7   | `DEFAULT_BY_STATUS[status]`                          | Localized, safe, always understandable.                                                                                    |
| 8   | `GENERIC_MESSAGE`                                    | Guarantees non-empty for exotic statuses (`418`, `0` from a runtime you didn't map).                                       |

The `fromBackend` guard on rungs 4–6 is not a stylistic detail. A common failure normalizer wraps
non-HTTP throws as `{ status: 0, body: err.message }`; without the guard, a transport failure
renders `fetch failed` as the user-facing toast.

### 2.4 Tests that must exist

Cheap, high-value, and they pin the precedence chain that everything else assumes:

```ts
it('does not leak an internal string body for status 0', () => {
  expect(errorMessage({ status: 0, body: 'fetch failed' })).toBe(DEFAULT_BY_STATUS[0]);
});

it('honours override precedence (byCode beats byStatus beats defaults)', () => {
  expect(errorMessage({ status: 400 }, { byStatus: { 400: 'custom 400' } })).toBe('custom 400');
  expect(
    errorMessage(
      { status: 400, body: { code: 'already_registered' } },
      { byCode: { already_registered: 'coded custom' }, byStatus: { 400: 'custom 400' } },
    ),
  ).toBe('coded custom');
});

it('never returns an empty message', () => {
  expect(errorMessage(undefined)).not.toBe('');
  expect(errorMessage({ status: 418, body: {} })).not.toBe('');
});
```

Plus: status-only → status default; field-keyed body → `fieldErrors` populated and first used as
the message; `{ code }` → coded default; plain `Error` → status `0`; meta keys excluded from
`fieldErrors`.

## 3. The message tables — your localization seam

`templates/src/common/errors/messages.ts` ships the three exports: `DEFAULT_BY_STATUS` (keyed by
HTTP status, with `0` = "no response at all"), `DEFAULT_BY_CODE` (keyed by a backend `code`), and
`GENERIC_MESSAGE`. Translate the copy into your app's language on arrival — it is English in the
template only because a template has to pick one — and keep `DEFAULT_BY_CODE` short: a code belongs
there when several call sites need the same sentence for it, not merely because it exists.

- These two tables plus `GENERIC_MESSAGE` are the **only** place default user-facing error copy
  lives. A component that hardcodes "Something went wrong" is invisible to translation and to copy
  review.
- **Locale-sensitivity:** the tables are the seam. For a single-locale app they are literals; for a
  multi-locale app they hold message _keys_ resolved by your i18n runtime, and `mapError` gains a
  locale argument. Do not localize inside call sites.
- **Backend strings are already-localized-or-not, and you cannot tell.** That is exactly why rungs
  4–6 sit below the override rungs: a call site that knows the endpoint answers in the wrong
  language pins a `byStatus` override and wins.
- Keep an `index.ts` barrel exporting `mapError`, `errorMessage`, `fieldErrors`, the tables and
  `NormalizedError`, so the rest of the app imports `@/common/errors` and nothing deeper.

## 4. Consuming the normalized error

### 4.1 Bind field errors into the form

This helper has no template — create it now, at exactly this path, because
`references/07-forms.md` imports it from here in three places.

```tsx
// src/common/hooks/applyFieldErrors.ts
import type { UseFormSetError, FieldValues, Path } from 'react-hook-form';

/**
 * Bind backend field errors onto the matching inputs. Anything the form does not
 * know about falls back to a form-level message — otherwise a backend field the UI
 * doesn't render (a server-computed column) produces an error nobody can see or clear.
 */
export function applyFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  errors: Record<string, string>,
  knownFields: ReadonlyArray<Path<T>>,
  fallback: (message: string) => void,
): void {
  for (const [name, message] of Object.entries(errors)) {
    if (knownFields.includes(name as Path<T>)) setError(name as Path<T>, { message });
    else fallback(message);
  }
}
```

Call it from the action's returned `ActionState`, not from a thrown error — the action already
shaped `fieldErrors` alongside `message` on the server (`references/04-actions-and-mutations.md`
§5.1):

```tsx
const result = await registerAccountAction({ status: 'idle' }, values);
if (result.status === 'error') {
  if (result.fieldErrors) {
    applyFieldErrors(form.setError, result.fieldErrors, ['email', 'password'], toast.error);
  } else if (result.message) {
    toast.error(result.message);
  }
  return;
}
```

In the tier-2 (react-hook-form) path the action returns `ActionResult` instead and the mutation
re-throws through `unwrap`, so the source is `fieldErrors(err)` from this module —
`references/07-forms.md` §3 shows that call site.

Field errors on the field beat a toast: the user sees _which_ input to fix, and the message clears
when they edit it.

### 4.2 Toasts

```tsx
const loadingToast = toast.loading('Signing in…');
let ok = false;
try {
  ok = await signIn(values);
} finally {
  // Dismiss by id, in a `finally`: the action returns typed failures rather than
  // throwing, but the RPC call itself can still reject (offline, serialization) —
  // and a bare loading toast would then spin on screen forever.
  toast.dismiss(loadingToast);
}
if (!ok) return;
router.push(next ?? '/dashboard');
```

For a thrown error (a React Query `onError`, a client-side call), the toast body is always
`errorMessage(error, { byStatus: { … } })` — never `String(error)` and never `error.message`.

### 4.3 Branch on facts, not on text

Three branch keys are legitimate, in this order of preference:

| Branch on                       | Use it for                                                          | Why it is safe                                            |
| ------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- |
| `mapped.code`                   | Changing the **flow** (offer sign-in instead of dead-ending a toast) | A code is the one part of an error body meant to be stable |
| which key is in `fieldErrors`   | One status with several causes                                       | The backend named the field; that naming is machine data   |
| `mapped.status`                 | Coarse handling (401 → sign-in prompt, 404 → empty state)            | Statuses do not get copy-edited                            |

The middle row is the one agents skip. One status routinely has two causes — a 400 on registration
means "address already taken" *or* "password rejected by policy" — and blanket-mapping the status
to one message sends people off to sign in to an account that does not exist. The worked example is
`references/04-actions-and-mutations.md` §5.1.

If a backend distinguishes two cases only in prose and gives you no code and no field key, matching
the text is a last resort: isolate it to one line, comment the backend defect, and add a test —
`if (mapped.status === 401 && /no user found/i.test(mapped.message))`. Treat it as debt, not a
pattern.

### 4.4 Route handlers

```ts
} catch (error) {
  devError('api:export', error, { id });
  const { status, message } = mapError(error);
  // `mapError` reports 0 for non-HTTP failures (the renderer itself, a transport
  // error) — those must not become an HTTP 0 or a leaked 200.
  return NextResponse.json({ message }, { status: status >= 400 ? status : 500 });
}
```

## 5. The error-boundary tiers

| Tier        | File                                                     | Catches                                                                      | Must show                                                          | Must NOT show                                                |
| ----------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| Root        | `app/global-error.tsx`                                   | Errors thrown by the **root layout** (and anything no other boundary caught) | Own `<html>`/`<body>`, inline-styled apology, a retry button       | Any app CSS/font/provider dependency; raw `error.message`    |
| Route group | `app/(app)/error.tsx`, `app/(auth)/error.tsx`            | Render/data errors anywhere in that group's subtree                          | Shared `ErrorState` + retry, keeping the group's chrome intact     | A blank screen; a full-page takeover for a sub-page failure  |
| Route       | `app/(app)/billing/invoices/error.tsx`                   | That segment only                                                            | Copy naming _what_ failed ("Invoices could not be loaded") + retry | Generic copy that wastes a screen the user paid attention to |
| Not found   | `app/not-found.tsx`, `app/(app)/catalog/not-found.tsx`   | `notFound()` and (root only) unmatched URLs                                  | A way out: a link home / to the parent list                        | An "error" framing — this is an expected state               |
| Component   | `unstable_catchError()` (16.2) or a hand-rolled boundary | One widget's subtree                                                         | An inline fallback in the widget's own box                         | Anything that unmounts the rest of the page                  |

Rules that hold for every tier:

- **Boundaries are Client Components** (`'use client'`) — they need state and an `onClick`.
- **`error.tsx` does not catch errors thrown by its own segment's `layout.tsx`.** To cover a
  layout, put the boundary one level up. This is the single most common "why is my boundary not
  firing" bug.
- **Add a per-route `error.tsx` only for expensive screens** — a long builder form, a heavy report,
  a document generator — where losing the whole group's chrome is a worse experience than a
  scoped, specifically-worded failure. Everywhere else, the group boundary is enough.
- **Production server errors are scrubbed** to `error.digest`. Render the digest (small, for
  support) if anything; render the message only in development.

### 5.1 Global boundary

```tsx
'use client';
import { useEffect } from 'react';
import { devError } from '@/common/observability/dev-log';

// Catches errors in the root layout itself, so it renders its own <html>/<body> with
// inline styles — no app CSS, font, or provider is guaranteed at this level.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => devError('global', error), [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column',
                     alignItems: 'center', justifyContent: 'center', gap: '1rem',
                     fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Something went wrong</h1>
        <p style={{ maxWidth: 420, fontSize: '0.9rem' }}>
          The application failed to load. Please try again.
        </p>
        <button type="button" onClick={reset} style={{ borderRadius: 9999, border: 'none',
                 padding: '0.5rem 1.5rem', cursor: 'pointer' }}>
          Try again
        </button>
      </body>
    </html>
  );
}
```

Set `lang` (and `dir` for RTL locales) explicitly here — the root layout that normally supplies
them is the thing that just failed.

### 5.2 Group and route boundaries share one fallback component

Every boundary below the root renders the same `ErrorState` with overridable copy — the component
itself lives in `common/components/feedback/` and is defined in `references/02-design-system.md` §6,
which also explains why its `role="alert"` is not decoration. Each `error.tsx` is then four lines:

```tsx
// app/(app)/billing/invoices/error.tsx
'use client';
import { useEffect } from 'react';
import { ErrorState } from '@/common/components/feedback/ErrorState';
import { devError } from '@/common/observability/dev-log';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => devError('route:invoices', error), [error]);
  return <ErrorState title="Invoices could not be loaded" description="Please try again." onRetry={reset} />;
}
```

One `ErrorState` with overridable copy is what keeps five boundaries from drifting into five
different-looking failure screens.

### 5.3 `reset()` vs retry semantics — version-sensitive

`reset()` only re-renders the client subtree. If the error came from server data fetching or the
RSC render, re-rendering hits the same failed payload and the user clicks "Try again" forever.

- **Next 16.2+:** type the props with `ErrorInfo` from `next/error` (`{ error, reset,
unstable_retry }`) and call `unstable_retry()` — it runs `router.refresh()` + `reset()` inside a
  transition, so server data is re-fetched. Prefer it for any data-backed segment.
- **Next 15.x / earlier 16.x:** same effect by hand —
  `startTransition(() => { router.refresh(); reset(); })`.
- **Component-level boundaries, 16.2+:** `unstable_catchError()` from `next/error` gives a
  Next-aware boundary with built-in retry that lets `redirect()`/`notFound()` throw _through_
  instead of swallowing them, and auto-clears on navigation. On older versions, hand-rolled
  boundaries must re-throw anything that looks like a framework navigation signal.

## 6. Development error-visibility

**Principle: in development, failures must be loud and specific; in production, safe and generic.**
The same failure that prints path + method + status + body in dev must print nothing in prod.

### 6.1 The dev logger

Copy `templates/src/common/observability/dev-log.ts`. It exports `devLog(scope, ...args)`,
`devError(scope, error, extra?)`, and the two cache adapters `logQueryError` / `logMutationError`.
Three properties are load-bearing:

- `process.env.NODE_ENV` is statically replaced at build time, so the bodies of these functions are
  dead code the minifier drops from the production bundle. **Do not** read the flag from a runtime
  config object — that defeats elimination and ships the logging.
- The `scope` string is a namespace convention, not decoration: `api`, `query`, `mutation`,
  `global`, `route:<segment>`. It is what makes the console greppable when three subsystems fail at
  once.
- `devError` reuses `mapError`, so the dev line and the user's toast agree on status/code/message.
  A discrepancy between them is itself a bug signal.

### 6.2 Log at the network edge

In the authenticated fetch wrapper, log the failing request _before_ any recovery branch decides
what to do, so a failure is visible with its URL and body even when it is later retried:

```ts
} catch (err) {
  // …refresh-and-retry branch returns above on success…
  // Dev-only: surface the failing request (path + method + status + body).
  if (err instanceof HttpError) devError('api', err, { path, method: options.method ?? 'GET' });
  throw err;
}
```

`instanceof` is acceptable _here_ and only here: this is the module that constructed the error, one
stack frame away, before any serialization boundary.

### 6.3 Make client-cache failures visible

A failed `useQuery` is silent by default — an `isError` flag with no console trace — and a failed
mutation surfaces only as whatever toast the component happens to render. The fix is one wiring, in
`common/lib/query-client.ts`: a `QueryCache`/`MutationCache` whose `onError` calls `logQueryError` /
`logMutationError`. That is already done in `templates/src/common/lib/query-client.ts`; the rest of
that file's defaults are explained in `references/08-state-and-data-flow.md` §4.

The adapters are deliberately plain `(error, key)` functions so the call sites pass the cache's own
inferred callback params instead of hand-writing the library's generics. Verify the arities against
the installed package types rather than memory: the query cache is `(error, query)`, the mutation
cache `(error, variables, context, mutation)`, and both have changed across majors.

### 6.4 Production reporting

Development logging is not error tracking. Report from three places, none of which print to the
user: the `useEffect` in each boundary (send `error` + `digest`), the server-side request hook
(`export function onRequestError()` in `instrumentation.ts`, Next 15+), and the cache `onError`
hooks. Keep `digest` in the payload — it is the only handle correlating a scrubbed client error
with the server log line.

### 6.5 Acceptance checks

- Force a query to 500 in dev → exactly one `[query] 500 … { queryKey }` line.
- A failed mutation logs `[mutation] …`; a failed request logs `[api] … { path, method }`.
- Throw in the root layout → `global-error.tsx` renders, not a white screen.
- Production build: no dev log output path is reachable (grep the bundle for a scope string).

## 7. Where errors must NOT be swallowed

A swallowed error is not a handled error. It is a bug that has been converted into a screen that
looks slightly wrong, with no trace anywhere.

**Never:**

- `catch {}` with an empty body, or `catch { /* ignore */ }`. If there is genuinely nothing to do,
  there is still something to log: `catch (err) { devError('scope', err); }`.
- `catch {}` around a call that may `redirect()` or `notFound()` — those work by throwing a
  framework signal. Catching one turns a navigation into a silently-dropped request, and (worse)
  usually into a "success" path. Call them **after** the `try`, never inside it.
- `catch { toast.error('That item already exists'); }` — a single guessed cause for every possible
  failure. A network drop, a 401, and a genuine 409 all print the same wrong sentence. Use
  `errorMessage(err, { byStatus: { 409: 'That item already exists.' } })`, which keeps the guess
  for the status that means it and tells the truth for the rest.
- Optimistic rollback that only restores state:
  ```ts
  onError: (error, vars, context) => {
    if (context?.previous) queryClient.setQueryData(context.key, context.previous);
    onError?.(error, vars);   // REQUIRED: the caller surfaces the cause (toast/field error)
  },
  ```
  Rollback without surfacing is the worst UX in the app — the user's change silently disappears and
  they retype it into the same failure.
- A blanket fallback that hides a real outage. Fallback data (fixtures for an unbuilt endpoint,
  cached last-known values) is legitimate **only** when narrowly guarded: specific statuses only,
  never `401`/`403` (those are session problems, not missing data), only at the wrapped call sites,
  behind an env flag, and with a `devLog` line every time it triggers. See
  `references/03-server-data-layer.md`.

**Acceptable silent catches** — all four conditions, always with a comment stating why:

1. The failure has a correct, complete recovery (malformed JSON in a request body → return a 400).
2. Nothing about the cause changes what you do next.
3. The catch is one or two lines wide, not wrapped around a block that could fail in ten ways.
4. The failure is not user-visible, or the recovery is what the user wanted anyway.

Example that qualifies: `try { return JSON.parse(raw); } catch { return null; }` in a token decoder
whose caller already treats `null` as "no session".

## Anti-patterns

| Never do this                                               | Because                                                                                                                  | Do this instead                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `err instanceof HttpError` outside the module that threw it | Fails after RPC serialization / across duplicate module instances; a 403 silently becomes "network error"                | Duck-type `{ status: number }` in `extractStatusBody`                                 |
| `err.response?.data?.detail ?? err.message` at a call site  | Every call site encodes a different guess; adding a backend shape fixes only the ones you remember                       | `mapError(err)` / `errorMessage(err)`                                                 |
| Showing `error.message` or `String(err)` to users           | At `status 0` it is an internal JS string; in production it is scrubbed and useless                                      | `mapError(...).message`, always non-empty and localized                               |
| Hardcoding "Something went wrong" in a component            | Invisible to translation and copy review; drifts across screens                                                          | `DEFAULT_BY_STATUS` / `GENERIC_MESSAGE`                                               |
| `if (/expired/i.test(err.message))` for control flow        | Copy edits and locale changes break it silently                                                                          | Branch on `status`, `code`, or which key is in `fieldErrors`                          |
| Treating every key of an error body as a field error        | Envelope keys like `error`/`detail` become phantom fields and jump the message queue, leaking untranslated backend prose | Reserve meta keys in `RESERVED_KEYS`; fold them into `detail`                         |
| Mapping one status to one cause (`400 → "email taken"`)     | Backends reuse a status for several validation failures; users get sent to fix the wrong thing                           | Branch on which field the backend named, then fall back                               |
| `console.error` left in shipped code                        | Leaks backend bodies to the production console and buries real dev signal in noise                                       | `devError(scope, err, ctx)` — no-op in production                                     |
| Reading the dev flag from runtime config                    | Defeats static replacement, so the logging ships                                                                         | `process.env.NODE_ENV !== 'production'` at module scope                               |
| `error.tsx` in the same segment as the failing `layout.tsx` | It cannot catch its own layout; the boundary never fires                                                                 | Put the boundary one segment up (or in `global-error.tsx`)                            |
| `global-error.tsx` relying on app CSS, fonts, or providers  | It replaces the root layout — none of them exist; you get an unstyled or blank page                                      | Own `<html>`/`<body>` with inline styles and no imports beyond the logger             |
| Per-route `error.tsx` for every segment                     | Duplicated fallbacks that drift; a whole-screen takeover for a minor failure                                             | Group boundary by default; per-route only for expensive screens                       |
| `reset()` alone on a data-backed segment                    | Re-renders the same failed server payload; the retry button never works                                                  | `unstable_retry()` (16.2+) or `startTransition(() => { router.refresh(); reset(); })` |
| `try { … redirect('/x') } catch {}`                         | `redirect()` throws by design; the catch cancels the navigation                                                          | Call `redirect()`/`notFound()` after the `try` block                                  |
| Rollback-only mutation `onError`                            | The user's edit vanishes with no explanation and they retype it into the same failure                                    | Roll back **and** surface `errorMessage(error)`                                       |
| Broad fixture/fallback around all fetches                   | A real outage looks like an empty UI forever                                                                             | Narrow, flagged, status-guarded fallback that logs each hit                           |
