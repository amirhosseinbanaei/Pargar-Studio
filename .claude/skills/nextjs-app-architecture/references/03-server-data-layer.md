# The server data layer: transport, client, services, session

**Read this when:** you are adding a call to a backend, wiring env configuration, debugging a 401
that only happens sometimes, or building anything that touches session cookies.

Every byte the app reads from a backend enters through this layer, and every auth token lives and
dies inside it. It is four concentric rings — transport, authenticated client, resource services,
actions — plus the session module that the whole authentication story hangs off. Build it before
you build any feature: retrofitting it means touching every component that ever called `fetch`.

The rings ship as templates. Copy them; this guide is the reasoning you need to *modify* them
safely, and it is deliberately shorter than the files themselves.

> **Versions.** Every example leads with the **Next.js 16** form; the 15.x equivalent is given
> inline wherever they differ. Zod examples are **zod 4** (see `references/05-contracts-and-schemas.md`
> for the zod 3 spellings).

## Invariants

- **Each ring imports only the ring below it.** `services → api-client → http`. Never skip a ring,
  never import upward.
- **`http.ts` knows nothing about auth or base URLs** and stays runtime-agnostic (no `server-only`,
  no `next/*`), so it is unit-testable and reusable in any runtime that has `fetch`.
- **Every file that reads a token or talks to the backend starts with `import 'server-only'`** —
  except `http.ts`. A client import then fails the _build_, not production.
- **The response is zod-parsed in exactly one place: `api-client`.** Nothing downstream may cast.
- **One service module per backend resource**, exporting plain typed async functions. No React, no
  `'use server'`, no components.
- **Components never call `fetch` and never build a URL.** They call a service (server) or an
  action (client).
- **`session.ts` is the only module that touches auth cookies.** Cookie _writes_ are legal only in
  Server Actions, Route Handlers, and request interception — never during an RSC render.
- **Model a token rotation as a three-state verdict (`rotated | rejected | unavailable`).** Only
  `rejected` may clear cookies.
- **Rotation is single-flighted per refresh token.** With rotating/single-use refresh tokens, a
  concurrent fan-out otherwise burns the token and signs the user out.
- **Cookie `secure` is derived from the actual request, never from `NODE_ENV`;** cookie `maxAge` is
  derived from the token's own `exp`.
- **Environment config is zod-parsed at import time**, and public vars are referenced by _static_
  property access so the bundler can inline them.
- **Not-yet-shipped endpoints fall back in one greppable module**, never with fixtures sprinkled
  through services.

## 1. The four rings

```text
  ring 4  actions/          'use server'  — validate input, call a service, return a typed result
             │                              (references/04-actions-and-mutations.md owns ring 4)
  ring 3  services/*        server-only   — one module per resource; endpoint paths + schemas
             │
  ring 2  api-client        server-only   — base URL + Authorization header + zod parse + 401 retry
             │
  ring 1  http              anywhere      — fetch + timeout + retry + HttpError. No auth, no host.
             │
           native fetch
```

| Ring | File                                              | Owns                                                              | Must never contain                                  |
| ---- | ------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| 1    | `common/services/http.ts`, `http-types.ts`        | timeouts, retries, abort merging, body parsing, `HttpError`       | auth, base URL, schemas, `next/*` imports           |
| 2    | `common/services/api-client.ts`                   | base URL, bearer header, response validation, in-render refresh   | endpoint paths, domain types                        |
| 3    | `common/services/<resource>-service.ts`           | one function per endpoint, its path, its schema, its cache policy | React, `'use server'`, cookie writes, UI messages   |
| 4    | `common/actions/*.ts`, `modules/<m>/actions/*.ts` | input re-validation, `ActionResult`, revalidation, redirects      | raw `fetch`, base URLs, schema parsing of responses |

Why the separation is worth four files: ring 1 is the only part with tricky control flow and it is
testable without a server; ring 2 is the single trust boundary, so "where do we validate backend
data?" has one answer; ring 3 makes "what endpoints does this app use?" a `ls` away; ring 4 is the
only ring the client can reach.

## 2. Ring 1 — the transport primitive

Two files, carrying no product knowledge: `templates/src/common/services/http-types.ts` and
`templates/src/common/services/http.ts`. Copy both as-is.

`http-types.ts` exports `RequestOptions` (a `RequestInit` plus four options) and the `HttpError`
class thrown for any non-2xx:

| Option           | Default  | Meaning                                                            |
| ---------------- | -------- | ------------------------------------------------------------------ |
| `timeoutMs`      | `30_000` | Abort the request after this many ms.                              |
| `retries`        | `0`      | Retries on transient failures (408/429/502/503/504 or network).    |
| `retryBackoffMs` | `300`    | Base backoff; doubles each attempt.                                |
| `json`           | —        | JSON-serialize this as the body and set `Content-Type`.            |

`HttpError` carries `{ status, statusText, body, url }` — `body` is the *parsed* error payload,
which is what makes field-error binding possible three layers up.

`http.ts` exports a callable `http(url, options?)` plus `http.json(url, body, options?)` (defaults
to POST). Four details inside the retry loop are non-obvious and must survive any edit:

1. **A fresh `AbortController` per attempt.** An aborted signal stays aborted, so reusing one makes
   every retry fail instantly.
2. **The external signal is subscribed inside the loop and removed in `finally` — including on the
   `continue` path.** Otherwise a retrying request leaks one timer and one listener per attempt.
3. **204 / `content-length: 0` short-circuits body parsing.** `res.json()` on an empty body throws
   a `SyntaxError` that masquerades as a backend bug. DELETE endpoints hit this daily.
4. **Parsing the error body can never replace the error.** `parseError` is wrapped in its own
   `try/catch` returning `undefined`, because an HTML error page from a reverse proxy or a
   truncated stream must not turn a 502 into a `SyntaxError`.

Design rules encoded in the file, each preventing a specific failure:

| Rule                                                                      | Failure it prevents                                                                                                          |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Default timeout, always                                                   | A hung upstream pins a render until the platform kills it; the user sees a blank page with no error.                         |
| Retries default to **0**, opt in per call                                 | Blind retries turn a slow backend into a self-inflicted DDoS, and retry a non-idempotent POST.                               |
| Retry only 408/429/502/503/504 + network errors, with exponential backoff | Other 4xx are deterministic — retrying only delays the error. A _fixed_ delay synchronizes every client into one retry wave. |
| Merge the caller's `signal` with the timeout                              | Without it, a cancelled request (navigation away, an upstream `AbortSignal`) keeps running.                                  |
| `HttpError` carries `status` + parsed `body` + `url`                      | Callers need the _field errors_ the backend sent; a message-only error forces string matching.                               |
| 204 / `content-length: 0` short-circuit                                   | `res.json()` on an empty body throws a `SyntaxError` that masquerades as a schema bug.                                       |

## 3. Ring 2 — the authenticated, validated client

Copy `templates/src/common/services/api-client.ts`. It exports exactly one function:

```ts
apiFetch<S extends z.ZodTypeAny>(
  path: string,                 // starts with '/', never a full URL
  schema: S,
  options?: Omit<RequestOptions, 'headers'> & { auth?: boolean; accessOverride?: string },
): Promise<z.infer<S>>
```

`Promise<z.infer<S>>` is the whole trick: a service's return type is computed from the schema it
passes, so it needs no annotation and can never annotate a lie.

Five rules govern every edit you make to that file:

- **`schema.parse` (throwing), not `safeParse` + a fallback shape.** A backend that changed shape is
  a bug; it must fail loudly here rather than produce `undefined` three components deep at render
  time. Do not add `as z.infer<S>` on the parse either — with `.transform()`-based schemas, input
  and output types genuinely differ and an assertion would absorb the mismatch.
- **`Omit<RequestOptions, 'headers'>`** is deliberate: if callers could pass `headers`, one would
  eventually overwrite `Authorization` and produce an unexplainable 401. Per-call headers, if you
  need them, go in a narrow `extraHeaders` option merged *below* `Authorization`.
- **`auth: false` on public endpoints.** Sending a stale bearer token to a sign-in endpoint is at
  best pointless, at worst it triggers the 401-refresh path on a response that was never about the
  session.
- **`accessOverride` is the loop guard for leg 2 of the refresh (§6).** A 401 triggers exactly one
  refresh-and-retry, because the retried call carries an override and therefore cannot refresh
  again. Remove the guard and a genuinely revoked session spins.
- **Framework cache options pass straight through** (`cache`, `next: { revalidate, tags }`). Ring 2
  has no caching policy; ring 3 does. The base URL comes from validated env (§5), never a literal.

## 4. Ring 3 — one service module per resource

```ts
// common/services/invoice-service.ts
import 'server-only';
import { z } from 'zod';
import { apiFetch } from './api-client';
import { invoiceSchema, paginatedInvoicesSchema } from '@/common/schemas/invoice';
import type { InvoiceCreateBody, InvoiceUpdateBody } from '@/common/schemas/invoice';

/** The list endpoint is paginated; the envelope is modelled once in `schemas/envelopes.ts`
 *  and instantiated per resource (`references/05-contracts-and-schemas.md` §4). */
export function listInvoices(page = 1) {
  return apiFetch(`/billing/invoices/?page=${page}`, paginatedInvoicesSchema);
}

export function getInvoice(id: number) {
  return apiFetch(`/billing/invoices/${id}/`, invoiceSchema);
}

export function createInvoice(body: InvoiceCreateBody) {
  return apiFetch('/billing/invoices/', invoiceSchema, { method: 'POST', json: body });
}

export function updateInvoice(id: number, body: InvoiceUpdateBody) {
  return apiFetch(`/billing/invoices/${id}/`, invoiceSchema, { method: 'PATCH', json: body });
}

/** File uploads go as FormData: pass `body`, never `json`, and never hand-set
 *  `Content-Type` — the runtime has to generate the multipart boundary, and a hand-set
 *  header omits it, so the backend parses zero fields. */
export function uploadInvoiceAttachment(id: number, file: FormData) {
  return apiFetch(`/billing/invoices/${id}/`, invoiceSchema, { method: 'PATCH', body: file });
}

/** A 204 endpoint validates against `z.void()`, matching the transport's empty-body path. */
export function deleteInvoice(id: number) {
  return apiFetch(`/billing/invoices/${id}/`, z.void(), { method: 'DELETE' });
}
```

Shape rules:

- **Thin.** Path + schema + method. Logic beyond a trivial normalization (`reverse()`, "pick the
  default record") belongs in a mapper or the action.
- **Return the parsed value, not a wrapper.** Errors propagate as `HttpError`; ring 4 converts them
  into a result the client can read.
- **Public/reference data declares its own cache policy**, because the policy is a property of the
  resource:

  ```ts
  // Reference data is public and effectively static: opt these GETs into the framework's
  // persistent data cache so one upstream hit is reused across requests and users, and the
  // tag lets a deploy or webhook purge them. Next 16's fetch default is no-store, so without
  // this every call re-hits the backend.
  const CATALOG_CACHE = { cache: 'force-cache' as RequestCache,
                          next: { revalidate: 60 * 60 * 24, tags: ['catalog'] } };

  export const listProducts = () =>
    apiFetch('/catalog/products/', z.array(productSchema), { auth: false, ...CATALOG_CACHE });
  ```

  Version note: purge with `revalidateTag('catalog', 'max')` on Next 16 — the single-argument form
  is **deprecated** on 16, so pass a cache-life profile (`updateTag('catalog')` in a Server Action
  also reads back fresh in the same request); on 15.x it is `revalidateTag('catalog')`. A **POST is
  never data-cached** — cache such a lookup client-side with a long `staleTime` instead, and say so
  in a comment.

- **Record backend quirks as comments at the call site** — a trailing slash the server redirects on,
  a query parameter it 400s on when empty, a field that must be omitted rather than sent null. These
  are discovered once, at 2am, and forgotten by morning.
- **Where it lives:** `common/services/` if two modules or a shared component use it,
  `modules/<m>/services/` if exactly one feature does (see `references/01-layering-and-boundaries.md`).

## 5. Typed, fail-fast environment config

Two files, both templates: **`templates/src/common/config/env.ts`** (the zod-parsed schema, throwing
at import time) and **`templates/src/common/constants/api.ts`** (the derived constants — `API_URL`,
`SITE_URL`, `MEDIA_URL`, and a `mediaUrl()` normalizer). Copy both. Three rules govern every edit
you will make to them:

1. **Every `NEXT_PUBLIC_*` value is referenced by STATIC property access.** The bundler performs a
   textual replacement of `process.env.NEXT_PUBLIC_X`; it cannot see through `process.env[key]` or
   a loop over the schema's keys. Such code compiles, passes review, and yields `undefined` for
   every public variable in the browser. Adding a variable means adding it in **both** places in
   the file.
2. **A production-critical URL gets NO default.** `z.url()`, not
   `z.url().default('http://localhost:…')`. A localhost default converts a loud boot failure into a
   silent misconfiguration: the app starts, and every request goes to a machine that does not exist
   in production. Throwing at import time means the app refuses to start — in CI, with the
   offending keys named. The only value in the template that carries a default is
   `NEXT_PUBLIC_PENDING_API_MOCKS`, and it defaults to `'disabled'`, because a fallback that is on
   by default makes a real outage look like an empty screen forever.
3. **Server-only secrets belong in a second schema**, in its own module behind
   `import 'server-only'`. Never put a secret in the client schema and never prefix it
   `NEXT_PUBLIC_` — that prefix ships the value to every browser.

`API_URL` in `constants/api.ts` strips trailing slashes (`env.NEXT_PUBLIC_API_URL.replace(/\/+$/,
'')`). That one line is why service paths can always start with `/` without producing `//` URLs
that some backends 404 and others silently redirect.

> **Version note.** The template is zod 4: `z.url()`, `z.flattenError(err)`. On zod 3 those are
> `z.string().url()` and `err.flatten()`. See `references/05-contracts-and-schemas.md` §1.

## 6. Authentication: the three-legged token refresh

**The constraint that creates the design:** a Server Component render cannot persist
`cookies().set()` — the response headers are already committed by the time most of the tree runs.
So the refresh must happen where cookie writes are legal, and any refresh that happens mid-render
can only serve _that render_.

| Leg | Where                                                      | What it does                                                                                                                                                                  | Why it must exist                                                                                                        |
| --- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | request interception (`proxy.ts`; `middleware.ts` on 15.x) | Access token missing/expiring while a refresh token is present → rotate, set the new pair on the **response**, and forward it into the **current render** via request headers | The only place that both reads incoming cookies and writes ones that reach the browser. Makes leg 2 rare.                |
| 2   | `api-client`                                               | A 401 mid-render → refresh once, retry with an in-memory `accessOverride`                                                                                                     | Covers a token that died _during_ a render, and any call that bypasses leg 1 (route handlers excluded from the matcher). |
| 3   | sign-in / sign-out / password-change actions               | `writeSession` / `clearSession`                                                                                                                                               | The persistent writes. Server Action context is one of the few places cookie writes are legal.                           |

### 6.1 The session module

Copy `templates/src/common/services/session.ts` and `templates/src/common/services/jwt.ts`. The
session module is the **only** module that touches the auth cookies; `jwt.ts` is a deliberately
unverified `exp` reader (the backend stays authoritative — this only answers "is it worth
sending?") and carries no `server-only`, so the edge can import it.

Four decisions in `session.ts` are the ones an agent gets wrong when hand-writing it:

- **`isSecureRequest(headers, url?)` decides `secure` from the REQUEST, never from `NODE_ENV`.**
  Resolution order: explicit `SESSION_COOKIE_SECURE` override → `x-forwarded-proto` (first hop of a
  possibly comma-separated chain) → `origin`/`referer` (sent by the browser itself, so it covers
  terminators that forward no `x-forwarded-*`) → the request URL → omit `Secure`, preferring a
  working session over a stricter one. A client cannot downgrade a real HTTPS session this way:
  browsers cannot set `x-forwarded-proto`, and a browser on HTTPS always sends an `https://` origin.
- **`maxAge` comes from the token's own `exp`, capped by policy** (`accessCookieMaxAge` /
  `refreshCookieMaxAge`). An already-expired token keeps the fallback, so the cookie still exists
  for the rotation path to find.
- **`SESSION_COOKIE_BASE` is shared by every writer.** A mismatched attribute set writes a SECOND
  cookie instead of replacing the first, and `clearSession` deletes by `{ name, path }` for the
  same reason.
- **`writeSession` / `clearSession` are legal only where cookie writes are** — Server Actions,
  Route Handlers, the interception layer. Never during an RSC render. `readSession` is legal
  anywhere on the server.

### 6.2 Rotation: single-flighted, three-state

The same file exports the rotation half:

```ts
type RotationOutcome =
  | { status: 'rotated'; pair: TokenPair }   // a fresh pair; persist it where writes are legal
  | { status: 'rejected' }                   // the BACKEND said this token is dead — may clear
  | { status: 'unavailable' };               // unreachable/5xx/timeout — MUST NOT clear anything

rotateSession(refresh): Promise<RotationOutcome>   // single-flighted + replayed, see below
refreshAccess(refresh): Promise<TokenPair | null>  // "did I get a usable pair" — does NOT persist
```

`refreshAccess` not persisting is what makes it legal mid-render (leg 2): the caller uses the
returned access for that one request, and leg 1 owns the persistent write.

**Why single-flight is mandatory.** With rotating + blacklist-on-rotation refresh tokens — the
default in many auth stacks — a refresh token is SINGLE-USE: the moment one request exchanges it,
every other request still holding it gets a 401. A production page load fires many requests at
once: the navigation, its RSC payload, link prefetches (which only exist in a production build),
and any bootstrap Server Action — each running the interception layer. Without the guard they all
see the same stale access cookie, all call the refresh endpoint with the same token, one wins, and
the losers clear the session: a signed-in user thrown back to the sign-in page. **This is why the
bug appears only in production.**

The template implements it with two maps keyed by the OLD refresh token, both expiring after
`ROTATION_TTL_MS` (30s): `inFlightRotations` (concurrent callers share one exchange) and
`completedRotations` (a caller arriving just after a rotation is REPLAYED the resulting pair
instead of spending an already-dead token). The replay map is the half people omit, and omitting it
leaves the race open for every request that starts microseconds late.

Classification is equally load-bearing: **400/401 → `rejected`** ("this token is dead"); anything
else — timeout, DNS failure, 5xx — → **`unavailable`**, which says nothing about the session.

#### 6.2.1 Horizontally scaled deployments

Both maps are **per-process**: one server instance is one process. Behind two or more instances the
guard still works within an instance but not across them, so a fan-out that load-balances across
instances can still spend the token twice. Three answers, in increasing cost:

1. **Sticky sessions.** Pin a client to one instance at the load balancer (cookie or IP affinity).
   Zero code, and it restores the exact guarantee above. Prefer this unless your platform cannot
   do it or instances are too short-lived.
2. **Widen the skew window** so rotation happens well before expiry and the losing requests still
   hold a *valid* access token. This shrinks the race; it does not close it.
3. **Move the single-flight into a shared store** — any store with an atomic
   set-if-absent-with-TTL primitive works (an in-memory key/value service, a database row with a
   unique constraint, your platform's KV). Redis is one such store, not a requirement.

The shared-store shape, stated generically:

```ts
// Pseudocode — the SHAPE, not a library API.
// LOCK  key: `rotation:lock:<hash(refresh)>`  value: this instance's id  TTL: ~10s
// RESULT key: `rotation:done:<hash(refresh)>`  value: the new pair       TTL: ~30s
async function rotateShared(refresh: string): Promise<RotationOutcome> {
  const id = hash(refresh); // NEVER key on the raw token — it would be readable in the store

  const replayed = await store.get(`rotation:done:${id}`);
  if (replayed) return { status: 'rotated', pair: replayed };

  // Atomic set-if-absent. This single operation IS the lock; a get-then-set is not
  // atomic and reintroduces the race it was meant to remove.
  const acquired = await store.setIfAbsent(`rotation:lock:${id}`, INSTANCE_ID, { ttlMs: 10_000 });

  if (!acquired) {
    // Someone else is rotating. Poll the RESULT key for up to the lock TTL, then give up
    // with `unavailable` — never with `rejected`. Losing a lock race is not evidence that
    // the token is dead, and treating it as such signs the user out.
    const pair = await store.waitFor(`rotation:done:${id}`, { timeoutMs: 10_000 });
    return pair ? { status: 'rotated', pair } : { status: 'unavailable' };
  }

  const outcome = await exchangeRefresh(refresh);
  if (outcome.status === 'rotated') {
    await store.set(`rotation:done:${id}`, outcome.pair, { ttlMs: 30_000 });
  }
  await store.delete(`rotation:lock:${id}`); // release even on failure, or waiters stall for the TTL
  return outcome;
}
```

The failure this prevents that the per-process version cannot: **two instances rotating the same
single-use token in the same second**, where the second exchange is rejected by the backend and —
without the `unavailable`-on-lock-timeout rule above — is misread as "session dead" and clears
cookies for a user who is perfectly signed in.

Two non-negotiables in that sketch: the lock key is a **hash** of the refresh token, never the
token itself (a store is a place tokens can leak from), and a **lock-acquisition failure resolves
to `unavailable`, never `rejected`.**

### 6.3 Leg 1 — pre-emptive rotation at the edge

Copy `templates/src/proxy.ts` (Next 16). On 15.x the same body lives in `src/middleware.ts`
exporting `middleware(request)`; it needs the Node.js runtime — the default for `proxy.ts` on 16,
but requested with `export const runtime = 'nodejs'` on 15.x where supported, or the file must be
rewritten to Web-API-only code with `atob` instead of `Buffer`.

The route predicates come from `common/config/private-routes.ts`, not from consts inside the proxy:

```ts
import { isPrivateRoute, isAuthRoute, SIGN_IN_PATH } from './common/config/private-routes';
```

One list, two readers (the edge gate and the client code that reacts to auth transitions) — see
`references/10-routing-and-app-shell.md` §6.

> ### The one-key bug this file exists to document
>
> Forwarding data to the render MUST go through **`NextResponse.next({ request: { headers } })`**.
> `NextResponse.next({ headers })` sets **response** headers. Doing that on a Server Action POST
> overwrites the action response's `text/x-component` content-type with the request's
> `text/plain`, and EVERY Server Action in the app then fails client-side with "An unexpected
> response was received from the server" — with no server error, no stack, and no clue pointing
> back here. The two spellings differ by one nested key.

The other thing the proxy must get right is that a rotated pair is written **twice**: onto
`request.cookies` (so the serialized `cookie` header forwarded into *this* render carries it) and
onto `response.cookies` (so the browser keeps it). Doing only the second means the current render
still sees the expired token and every server-side call 401s.

### 6.4 Leg 3 — the explicit writes

Three actions live in `src/common/actions/session.ts` — not in a feature module, so `common/` can
reach them without inverting the dependency graph. `signInAction` calls the ring-3 sign-in service
and then `writeSession`; its full shape (input re-validation, `ActionState` return, `errorMessage`
with a `byStatus` override on 401) is `references/04-actions-and-mutations.md` §5.2. The other two
are three lines each and exist for one reason apiece:

```ts
// src/common/actions/session.ts
'use server';
import { clearSession, readSession } from '@/common/services/session';

/** The single source of truth for "sign out" — every surface calls this one action. */
export async function signOutAction(): Promise<void> {
  await clearSession();
}

/** Boolean only. Never return a token to the client, even through an action: an action
 *  is a public endpoint, and a token-returning one re-creates every XSS risk httpOnly
 *  cookies were chosen to remove. */
export async function isAuthenticatedAction(): Promise<boolean> {
  const { access, refresh } = await readSession();
  return Boolean(access || refresh);
}
```

Those two are exactly the functions the client session store injects through
`configureSessionBridge` — see `references/08-state-and-data-flow.md` §6.2.

Also clear the session after a **password change**: most backends invalidate every token issued
before that instant, so keeping the cookies leaves the UI looking signed in while every request
401s.

### 6.5 Production failure modes, as rules

| Rule                                                                            | The failure it prevents                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single-flight rotation per refresh token, and replay the result for a short TTL | Single-use refresh tokens + a production fan-out (navigation + RSC payload + prefetches + bootstrap action) burn the token; the losers of the race sign the user out. Dev never reproduces it — prefetching is production-only. |
| Three-state verdict; only `rejected` clears cookies                             | A 5xx/timeout treated as "signed out" turns one backend blip into a mass logout of every active user.                                                                                                                           |
| `secure` derived from the request                                               | A `Secure` cookie over plain http is silently dropped; sign-in "succeeds" and the next request 401s. Only `localhost` is exempt, which is why it passes review.                                                                 |
| `maxAge` from the token's own `exp`, capped by policy                           | A cookie shorter than its token forces needless rotations, and every rotation can lose the session.                                                                                                                             |
| Identical attributes on every write; delete by `{ name, path }`                 | A differing `path`/`domain` writes a _second_ cookie; the browser keeps sending the stale one and logout appears not to work.                                                                                                   |
| Rotate with a skew window (~30s) before expiry                                  | Without skew, a request that starts 200ms before expiry arrives after it and 401s.                                                                                                                                              |
| Forward rotated cookies through **request** headers                             | Response headers overwrite the Server Action content type and break every action with an opaque client-side error.                                                                                                              |
| Never expose tokens to client JS (httpOnly, no token-returning endpoint/action) | Any XSS becomes full account takeover, and a client-side refresh mirror re-creates every race above.                                                                                                                            |
| Interception is a coarse UX gate; the backend stays authoritative               | Cookie presence is not a permission check; treating it as one ships an authorization bypass.                                                                                                                                    |

## 7. Endpoints the backend has not shipped yet

Quarantine every fixture behind one greppable wrapper. The alternative — `if (!data) return
FAKE_ROWS` inside services — is undeletable, because nobody can find all of it later.

Copy `templates/src/common/services/pending-backend.ts`. It exports
`withPendingBackendFallback(endpoint, fetcher, fixture)` and the flag
`isPendingApiMockEnabled` — imported from **that module**, not from `config/env`, so deleting the
mechanism deletes its only flag reader. Five constraints make it safe, and every one of them is the
difference between a development aid and a production outage you cannot see:

| Constraint                                                                | The failure it prevents                                                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Only the **wrapped call sites** fall back — never the api-client at large | A real endpoint that breaks would otherwise serve fixtures instead of surfacing an error   |
| Only "the endpoint isn't there" statuses qualify (404/405/5xx, status 0)  | A 400 masked as "not built yet" hides a genuine contract bug indefinitely                  |
| **401/403 is rethrown**                                                   | A session problem is not a missing endpoint; masking it renders fixtures to a signed-out user, which looks like a data leak in a screenshot |
| One env flag disables the whole mechanism, defaulting to **disabled**     | An on-by-default fallback makes a real outage look like an empty screen forever            |
| Every trigger logs a `devLog` line naming the endpoint                    | Silent fallbacks are how a fixture reaches production unnoticed                            |

```ts
// modules/catalog/services/featured-products.ts
export async function getFeaturedProducts(): Promise<Product[]> {
  return withPendingBackendFallback(
    'GET /catalog/featured/',                      // greppable removal key
    () => apiFetch('/catalog/featured/', productListSchema, {
      auth: false,
      next: { revalidate: 600, tags: ['catalog:featured'] },
    }),
    () => FALLBACK_PRODUCTS,                       // from modules/catalog/data/fixtures.ts
  );
}
```

Removal checklist per endpoint: delete the wrapper → delete its fixture constant → delete the
fixtures file when empty → `grep -r withPendingBackendFallback src/` returns nothing → delete the
module and the env flag.

## 8. Testing this layer

- **Alias `server-only` to an empty module in the test runner.** The real package throws outside an
  RSC bundle, so without this you cannot unit-test a single service. The alias is already wired in
  `templates/config/vitest.config.ts` against `templates/config/test-empty-module.ts`.
- **Mock `next/headers`** with an in-memory cookie map plus a mutable `Headers`, and assert the
  cookie _attributes_ (`secure`, `httpOnly`, `sameSite`, `path`, `maxAge`), not just the value — the
  attributes are what the production bugs were about.
- **Intercept at the network layer**, never by stubbing `apiFetch` — stubbing the client skips the
  schema parse, the thing most worth testing.
- **Tests this layer must have:** concurrent `rotateSession` calls perform exactly one exchange and
  all receive the same pair; 400/401 → `rejected`; 502 → `unavailable`; `writeSession` omits `Secure`
  on an http origin and sets it on https; `maxAge` tracks `exp` and caps at policy; the fallback
  wrapper triggers on 404/5xx and rethrows 401/403. Mock-server mechanics:
  `references/09-mocking-and-testing.md` §§2-5 and §9.4.

## 9. Anti-patterns

| Never do this                                                               | Because                                                                                                                                 | Do this instead                                                                         |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `fetch('/api/...')` inside a component                                      | No timeout, no error typing, no validation, no auth; duplicated in every caller and untestable                                          | Server Component → service; Client Component → action or a query hook wrapping one      |
| ``fetch(`${process.env.NEXT_PUBLIC_API_URL}/x`)`` at a call site            | One env rename breaks N files; base-URL typos become 404s at runtime                                                                    | `apiFetch('/x', schema)` — the base URL exists in exactly one constant                  |
| `const data = (await res.json()) as Invoice`                                | A cast is a lie the compiler believes; a renamed backend field becomes `undefined` three components deep, at render time, in production | `apiFetch(path, invoiceSchema)` — parse once at the network edge                        |
| `safeParse` + `?? fallbackShape` in the client ring                         | Hides contract drift forever; you ship against a backend you no longer match                                                            | Let `parse` throw; handle it at the action/error-boundary level                         |
| Tokens in `localStorage`/`sessionStorage`, or an endpoint that returns them | Readable by any XSS → full account takeover; also forces client-side refresh, which recreates the rotation race                         | httpOnly cookies + `readSession()` server-side; expose a boolean, never a token         |
| `secure: process.env.NODE_ENV === 'production'`                             | Browsers silently drop a `Secure` cookie over http — the whole app 401s everywhere except localhost                                     | `isSecureRequest(headers)` per request                                                  |
| `cookies().set()` during an RSC render                                      | Silently does nothing (or throws), so the "refresh" appears to work and the next request is still stale                                 | Rotate at the interception layer (leg 1); mid-render, use an in-memory override (leg 2) |
| A boolean `refresh(): Promise<boolean>`                                     | Cannot distinguish "token dead" from "backend down"; the only safe behavior becomes the destructive one                                 | `RotationOutcome = rotated \| rejected \| unavailable`                                  |
| Refreshing without single-flight                                            | Concurrent requests spend a single-use token; the losers log the user out — production-only, prefetch-triggered                         | `rotateSession` with in-flight + completed maps                                         |
| Retrying every failed request                                               | Retried POSTs double-charge; retried 4xx just delay the error; a slow backend gets hammered                                             | Retries default to 0; opt in per call, transient statuses only                          |
| Business logic or user-facing copy inside a service                         | The service becomes untestable and unreusable, and copy escapes translation/review                                                      | Service returns data; the action maps errors to messages                                |
| A service that reads `cookies()` itself                                     | Two sources of truth for the token; the 401-retry override stops working                                                                | Only `api-client` attaches auth; only `session` reads cookies                           |
| `'use server'` at the top of a service file                                 | Turns every exported function into a public HTTP endpoint with no input validation                                                      | Keep `'use server'` in ring 4, which validates its input                                |
| Fixture data inlined in a service                                           | Undeletable: nobody finds it, and it eventually ships to production                                                                     | One `withPendingBackendFallback` wrapper with a greppable endpoint key                  |
| `process.env[someKey]` for a public var                                     | The bundler only inlines _static_ references; the value is `undefined` in the browser                                                   | Spell every `process.env.NEXT_PUBLIC_X` out literally                                   |
| A `NEXT_PUBLIC_` secret, or a default for a production secret               | The value ships to every browser; the default turns a boot failure into a silent misconfiguration                                       | Server-side schema, no default, fail at import                                          |
