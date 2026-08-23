# Runtime templates — index and copy order

Every file here is a **complete, compiling module**, not a sketch. Copy it to the target path
shown below, keep the header comment (it records the production failure the file exists to
prevent), and resolve every `// TODO(project):` marker before you ship.

**These files are the source of truth.** Where a guide in `references/` shows code that differs
from a template, the template wins — it is the version that has been type-checked as a program.

Paths below are relative to a project root; `src/` assumes the `@/* -> ./src/*` alias from
`templates/config/tsconfig.json`.

## Copy order

Copy in **tier order**. Every file depends only on files in a lower tier, so at no point does the
tree fail to resolve. Within a tier the order does not matter.

| Tier | Files | Why here |
| --- | --- | --- |
| 0 | `errors/types.ts`, `errors/messages.ts`, `errors/parse-body.ts`, `services/http-types.ts`, `config/private-routes.ts`, `api/query-keys.ts` | Zero imports. Types, tables and plain data. |
| 1 | `errors/map-error.ts` → `errors/index.ts`, `services/http.ts`, `services/jwt.ts` | Depend only on tier 0. Copy `map-error` before the barrel. |
| 2 | `config/env.ts`, `observability/dev-log.ts` | `env` needs zod only; `dev-log` needs the error barrel. |
| 3 | `constants/api.ts`, `lib/query-client.ts`, `lib/utils.ts`, `lib/mock-ready.ts`, `schemas/envelopes.ts`, `schemas/helpers.ts`, `services/action-result.ts` | Need tier 2 or an external package only. |
| 4 | `services/session.ts`, `services/pending-backend.ts` | Need `constants/api` + the transport. |
| 5 | `services/api-client.ts` | Needs the transport **and** the session. The top of the server data stack. |
| 6 | `stores/session-store.ts`, `app/providers.tsx`, `proxy.ts`, `instrumentation.ts` | Entry points. Wire everything below them. |

## The files

| Template | Target path | What it does | Depends on (siblings) |
| --- | --- | --- | --- |
| `common/errors/types.ts` | `src/common/errors/types.ts` | `NormalizedError`, `FieldErrors`, `ErrorOverrides` — the one error shape every layer converges on. Types only, no runtime import. | — |
| `common/errors/messages.ts` | `src/common/errors/messages.ts` | Default user-facing copy by status and by code, plus `GENERIC_MESSAGE`. The app's only localization seam for error text. | — |
| `common/errors/parse-body.ts` | `src/common/errors/parse-body.ts` | Tolerant parsing of an untrusted backend error body into code / detail / non-field / field errors. Never throws. | — |
| `common/errors/map-error.ts` | `src/common/errors/map-error.ts` | Turns any thrown value into a `NormalizedError` via the 8-rung message precedence chain. Duck-types `{ status }`; never `instanceof`. | `types`, `messages`, `parse-body` |
| `common/errors/index.ts` | `src/common/errors/index.ts` | The public barrel. Everything outside the folder imports `@/common/errors` and nothing deeper. | `types`, `map-error`, `parse-body`, `messages` |
| `common/services/http-types.ts` | `src/common/services/http-types.ts` | `RequestOptions` and the `HttpError` class. Framework-free, runs anywhere. | — |
| `common/services/http.ts` | `src/common/services/http.ts` | The transport primitive: `fetch` + timeout, opt-in retry with backoff, signal merging, empty-body handling, typed error. No other module may call `fetch`. | `http-types` |
| `common/services/jwt.ts` | `src/common/services/jwt.ts` | UNVERIFIED payload decode to read `exp`, for rotation timing and cookie `maxAge`. Uses `atob` + `TextDecoder`, never `Buffer`, so it runs on an edge runtime. | — |
| `common/config/private-routes.ts` | `src/common/config/private-routes.ts` | `PRIVATE_ROUTES` / `AUTH_ROUTES` and the `isPrivateRoute` / `isAuthRoute` matchers shared by the interception layer and client code. | — |
| `common/api/query-keys.ts` | `src/common/api/query-keys.ts` | The central hierarchical query-key factory. No call site may inline a key literal. | — |
| `common/config/env.ts` | `src/common/config/env.ts` | Typed, fail-fast public config validated at import time. No localhost defaults for production-critical URLs; every key spelled out literally. Also exports `isMockEnabled` / `isMockPersistEnabled`. | — (zod) |
| `common/observability/dev-log.ts` | `src/common/observability/dev-log.ts` | Development-only structured logging plus the two query/mutation cache error hooks. No-op in production. | `errors` (barrel) |
| `common/constants/api.ts` | `src/common/constants/api.ts` | The only place an origin is spelled out: `API_URL`, `SITE_URL`, `MEDIA_URL`, `mediaUrl()`. Derived from `env`, never hardcoded. | `config/env` |
| `common/lib/query-client.ts` | `src/common/lib/query-client.ts` | `makeQueryClient()` + `getQueryClient()`. Fresh client per server request (no cross-user cache leak), one module-scoped singleton in the browser (survives a provider suspend). Owns the retry and dehydration policy. | `observability/dev-log` |
| `common/lib/utils.ts` | `src/common/lib/utils.ts` | `cn()` — the one class-merging helper, with custom token groups registered so overrides do not depend on CSS source order. | — (`clsx`, `tailwind-merge`) |
| `common/lib/mock-ready.ts` | `src/common/lib/mock-ready.ts` | *Optional (mock layer only).* `MockReadyContext` / `useMockReady()` — lets a client query wait for the mock worker **without** gating the render. Delete with the mock block in `providers.tsx`. | — (react) |
| `common/schemas/envelopes.ts` | `src/common/schemas/envelopes.ts` | The backend's shared response wrappers as generic factories: `successEnvelope`, `paginated`, error/message envelopes. | — (zod) |
| `common/schemas/helpers.ts` | `src/common/schemas/helpers.ts` | Leaf-level tolerance helpers for READ schemas (`looseString`, `looseDecimal`, `isoDate`, `tolerantEnum`, …). Never used on write payloads. | — (zod) |
| `common/services/action-result.ts` | `src/common/services/action-result.ts` | `ActionResult` / `ActionError` / `unwrap` / `toActionResult` — the return-don't-throw contract between write Server Actions and their callers. | `http-types` |
| `common/services/session.ts` | `src/common/services/session.ts` | The only module that touches the session cookies: names, attributes, lifetimes, per-request `secure` derivation, and the single-flighted rotation with its three-state outcome. `server-only`. | `http`, `http-types`, `jwt`, `constants/api` |
| `common/services/pending-backend.ts` | `src/common/services/pending-backend.ts` | *Optional.* One greppable wrapper that serves fixture data for endpoints the backend has not built yet. Rethrows 401/403. Delete each wrapper as its endpoint ships. | `errors`, `config/env`, `observability/dev-log` |
| `common/services/api-client.ts` | `src/common/services/api-client.ts` | `apiFetch(path, schema, options)`: base URL + bearer token + zod parse + the single in-render 401 refresh-and-retry with its loop guard. `server-only`. | `http`, `http-types`, `session`, `constants/api`, `observability/dev-log` |
| `common/stores/session-store.ts` | `src/common/stores/session-store.ts` | Client identity store (never tokens, never server data). Deferred rehydration to avoid a hydration mismatch, downgrade-only `reconcile`, narrow selectors, and `useSessionBootstrap`. | — (zustand, react) |
| `app/providers.tsx` | `src/app/providers.tsx` | The single app-wide client provider tree: one `QueryClientProvider`, the bootstrap `*Sync` slot, the optional devtools block, and the optional mock-ready block. | `lib/query-client`, `stores/session-store`, `config/env`\*, `lib/mock-ready`\* |
| `proxy.ts` | `src/proxy.ts` (Next 16) / `src/middleware.ts` (15.x) | The request-interception layer: coarse auth gate, leg-1 pre-emptive rotation, and request-header injection via `NextResponse.next({ request: { headers } })`. | `services/session`, `services/jwt`, `config/private-routes`, `observability/dev-log` |
| `instrumentation.ts` | `src/instrumentation.ts` | The server bootstrap hook. Starts the server-side request mock behind two guards (flag + `nodejs` runtime) using a dynamic import, and documents the `onRequestError` reporting hook. | — |

\* optional imports, inside the mock block.

## Blocks you must decide about

Three blocks are marked with fences and are the only places a copied file will not compile as-is:

| Block | Where | If you keep it | If you drop it |
| --- | --- | --- | --- |
| Query devtools | `app/providers.tsx` | The package must be present at **build** time, even though the chunk only loads in development. | Delete the `QueryDevtools` const and its render line. |
| Mock front-db | `app/providers.tsx`, `common/lib/mock-ready.ts`, `common/config/env.ts`, `instrumentation.ts`, `proxy.ts` matcher | Build `src/mocks/` per the mocking guide; `@/mocks/init` must export `startMocking()`. | Delete the fenced block, the two marked imports, `mock-ready.ts`, the two mock env keys, and the `mockServiceWorker.js` matcher entry. |
| Fixture fallback | `common/services/pending-backend.ts` | Wrap only the call sites whose endpoint does not exist yet. | Delete the file; nothing else imports it. |

Everything else compiles under `strict` with zero diagnostics the moment the declared packages are
installed.
