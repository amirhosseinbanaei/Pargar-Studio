# Routing, layouts, and the app shell

**Read this when:** you are adding a route, page, layout or loading/error file; deciding where a
Suspense boundary goes; writing metadata, a sitemap or robots; or changing what the
request-interception layer decides.

Everything under `app/` is plumbing: URLs, chrome, boundaries, and metadata. This file defines what
each route file is allowed to contain, where Suspense boundaries go so the shell paints instantly,
and what the request-interception layer (`proxy.ts`) may and may not decide. It assumes the layer
contract in `references/01-layering-and-boundaries.md` and the boundary tiers in
`references/06-error-system.md`.

> **Versions.** Every example leads with the **Next.js 16** form; the 15.x equivalent is given
> inline wherever they differ. Zod examples are **zod 4** (see `references/05-contracts-and-schemas.md`
> for the zod 3 spellings).

## Invariants

- **`app/` contains routing and composition only.** No feature markup, no business logic, no
  mappers, no `useState`. A `page.tsx` that stops being ~10–40 lines has absorbed something that
  belongs in a module.
- **`params` and `searchParams` are Promises and must be awaited** (Next.js 16; sync objects on
  15.x). Awaiting them is the only place a route may parse a URL.
- **Route groups `(name)/` are the app-shell mechanism.** Different chrome, different error
  boundary, no URL segment. Add a group when the chrome or the failure mode differs — never to
  "organize files".
- **Every route group has an `error.tsx`.** Per-route `error.tsx` only for expensive screens.
- **Every segment that awaits data on the server has a `loading.tsx`,** and its fallback is
  shape-accurate — same box count, same heights — or navigation jumps.
- **`loading.tsx`/`error.tsx` render components exported by a module barrel;** they never define
  the skeleton or the failure screen inline.
- **The proxy is a coarse UX gate, never an authorization decision.** The backend stays
  authoritative; anyone can forge their way past a client-visible gate.
- **To expose data to Server Components from the proxy, set REQUEST headers** via
  `NextResponse.next({ request: { headers } })`. `NextResponse.next({ headers })` sets RESPONSE
  headers and breaks every Server Action (§6.4).
- **The proxy matcher excludes `api`, `_next/static`, `_next/image`, and static assets.** A
  redirect returned to a route handler corrupts its payload.
- **Private route prefixes live in one exported array** consumed by the proxy, by robots, and by
  client code that reacts to sign-out. Two lists drift within a sprint.
- **`next/image` remote hosts are an allowlist driven by validated env,** so one config serves a
  mock backend and a real one.
- **`typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` are permanently banned.** A
  type or lint error must fail the build.
- **Every deliberately-disabled config option is a comment recording the symptom and the
  re-enable condition,** not a silent omission.

## 1. Route groups as the app shell

A parenthesized folder `app/(name)/` is invisible in the URL but real in the React tree. That makes
it the unit of *chrome + boundary*, which is the only reason to create one.

| Group        | URL effect | Chrome                                    | Owns                                         |
| ------------ | ---------- | ----------------------------------------- | -------------------------------------------- |
| `(site)/`    | none       | public navbar + footer                    | landing, pricing, public catalog             |
| `(app)/`     | none       | app navbar, sidebar, signed-in shell      | `dashboard`, `billing`, `accounts`           |
| `(auth)/`    | none       | bare centered card, no nav                | sign-in, sign-up, password reset             |

```text
app/
├── layout.tsx            # <html>/<body>, fonts, providers — the ONLY root layout
├── (site)/layout.tsx     # <header><Navbar/></header><main>{children}</main>
│   ├── error.tsx
│   └── page.tsx
├── (auth)/layout.tsx     # <main>{children}</main> — deliberately no navbar
│   ├── error.tsx
│   └── sign-in/page.tsx
└── (app)/layout.tsx
    ├── error.tsx
    └── billing/{page.tsx,loading.tsx,error.tsx}
```

**Add a group when at least one is true:**

1. The surrounding chrome differs (a sign-in screen must not render the app navbar — the navbar
   reads session state, and rendering it on the screen that creates the session flashes the wrong
   thing).
2. The failure copy differs. `(auth)` failing means "sign-in is unavailable"; `(app)` failing means
   "your data didn't load". One shared boundary cannot say both.
3. The routes share a data/permission posture — e.g. everything in `(app)` is behind the gate.

**Do not** add a group for tidiness; two groups with identical layouts and identical boundaries are
one group with extra indirection.

**Multiple root layouts.** A group *may* own its own `<html>`/`<body>` instead of a shared root
layout. The cost is real: navigating between two root layouts is a full document load, not a client
navigation — all client state is lost. Take that only when the two areas are genuinely separate
applications (e.g. a print/document surface). Otherwise keep one root layout and vary the group
layout.

**Layouts do not remount on navigation.** That is why they hold chrome and providers. If you need a
remount per navigation (an enter animation, a per-page analytics beacon), that is what `template.tsx`
is for — and nothing else.

## 2. The root layout and the provider seam

```tsx
// app/layout.tsx  — Server Component. Never add 'use client' here.
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import { Toaster } from '@/common/components/feedback/Toaster';
import { env } from '@/common/config/env';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-sans' });

const SITE_NAME = 'Acme';

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL), // required for absolute OG/canonical URLs
  title: { default: `${SITE_NAME} — operations console`, template: `%s | ${SITE_NAME}` },
  description: '…',
  openGraph: { type: 'website', siteName: SITE_NAME, url: '/' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `dir` is locale-dependent; set both explicitly so global-error can mirror them.
    // `data-scroll-behavior="smooth"` is required in v16 if globals.css sets smooth
    // scrolling — v16 stopped force-overriding it during navigations, so without this
    // attribute every route change animates a long scroll instead of jumping to top.
    <html lang="en" dir="ltr" data-scroll-behavior="smooth" className={inter.variable}>
      <body className="font-sans antialiased">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
```

Rules:

- **Fonts through `next/font`** (`next/font/google` or `localFont`), never a `<link>` to a font CDN
  and never an `@import` in CSS. `next/font` self-hosts and reserves metrics, so there is no
  layout shift and no third-party request on the critical path.
- **`providers.tsx` is the one `'use client'` file at the root.** Keeping the client boundary in a
  separate file means the root layout itself stays a Server Component, so `metadata`, `env`, and
  server-only imports remain legal there.
- **App-wide client bootstrap components render `null` and sit above `{children}`** inside
  `Providers`, so every route inherits the same resolved state (see
  `references/08-state-and-data-flow.md`).
- **`global-error.tsx` renders its own `<html>`/`<body>` with inline styles** — the layout that
  normally supplies CSS, fonts and providers is exactly the thing that failed. Full code in
  `references/06-error-system.md` §5.1.

## 3. The thin-page rule

A `page.tsx` does four things and nothing else.

| A page MAY                                                       | A page MUST NOT                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------------- |
| `await params` / `await searchParams` and validate them          | Render feature markup (sections, forms, cards, tables)     |
| Call server services / prefetch queries for the whole screen     | Contain business rules, branching on domain state          |
| Compose components imported from **module barrels**              | Import `@/modules/<name>/components/...` (barrel only)     |
| Export `metadata` / `generateMetadata` / segment config          | Hold client state, event handlers, `'use client'`          |
| `redirect()` / `notFound()` on an unresolvable URL               | Map API shapes into view models (that is module `lib/`)    |

```tsx
// app/(app)/billing/invoices/[invoiceId]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getInvoice } from '@/common/services/invoice-service';
import { InvoiceDetailScreen } from '@/modules/billing';

// v16: `params` and `searchParams` are Promises and MUST be awaited — reading them
// synchronously is a build error. On 15.x they are plain objects: `{ params: { invoiceId } }`.
type PageProps = {
  params: Promise<{ invoiceId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { invoiceId } = await params;
  const invoice = await getInvoice(Number(invoiceId)); // deduped with the page's own call
  return {
    title: `Invoice ${invoice.number}`,          // becomes "Invoice … | Acme" via the template
    openGraph: { title: `Invoice ${invoice.number}`, url: `/billing/invoices/${invoiceId}` },
    alternates: { canonical: `/billing/invoices/${invoiceId}` },
  };
}

export default async function InvoiceDetailPage({ params, searchParams }: PageProps) {
  const [{ invoiceId }, { tab }] = await Promise.all([params, searchParams]);

  // Validate the URL here so no module ever receives a malformed id.
  if (!/^\d+$/.test(invoiceId)) notFound();

  const invoice = await getInvoice(Number(invoiceId));
  return <InvoiceDetailScreen invoice={invoice} activeTab={tab ?? 'summary'} />;
}
```

Why this shape: the URL is the one contract the framework owns, so parsing it in the route keeps
modules URL-agnostic and unit-testable. And because `app/` may import any module while modules may
not import each other, composing at the page is what lets two different routes reuse the same
section without either module knowing the other exists.

**Static metadata needs no function.** For a fixed screen, `export const metadata = { title: 'Invoices' };`
is the whole thing — the root `template` supplies the suffix.

**Server prefetch variant.** When the screen's data is consumed by client hooks, the page prefetches
into a request-scoped query client and dehydrates it instead of passing props, so the first paint
has data and the hooks hydrate without a spinner. Both variants — awaited and streaming — are
written out in `references/08-state-and-data-flow.md` §5; the page-level rules are:

- **`getQueryClient()` is the accessor every caller uses, server prefetch included.** It returns a
  fresh client per request on the server (so one user's data can never be dehydrated into another's
  payload) and the browser singleton on the client. Never `new QueryClient()` in a page.
- **One `Promise.all` at the page**, not sequential `await`s spread across nested Server Components
  — that is a request waterfall whose latency is the sum, not the max.
- **`prefetchQuery` never throws.** A failed or 401 prefetch simply leaves the query for the client
  to refetch, so awaiting these unconditionally cannot break the render.
- **Prefetch only queries whose key is fully known on the server.** A query keyed by client state
  (a selected filter, an active tab held in a store) has no server key and must stay client-fetched;
  prefetching under a guessed key produces a cache entry nothing ever reads.
- **The page and the hook import the same `queryOptions` factory** from the module barrel. A key
  re-declared inline on either side means the hydrated entry sits unread and you pay for the server
  call *and* show a spinner.

## 4. The route file set

| File              | Purpose                                                                 | Runs as                     |
| ----------------- | ------------------------------------------------------------------------ | --------------------------- |
| `layout.tsx`      | Chrome shared by a subtree; **preserves state across navigations**       | Server (Client only if forced) |
| `template.tsx`    | Like a layout but **remounts on every navigation**                        | Server or Client            |
| `page.tsx`        | Makes the segment publicly reachable; the composition point              | Server (`async` by default) |
| `loading.tsx`     | Implicit `<Suspense>` around the segment; the instant shell              | Server                      |
| `error.tsx`       | Error boundary for the subtree — **must be `'use client'`**              | Client                      |
| `global-error.tsx`| Catches root-layout failures; renders its own `<html>`/`<body>`           | Client                      |
| `not-found.tsx`   | UI for `notFound()`; at the root also for unmatched URLs                 | Server                      |
| `default.tsx`     | Fallback for a parallel-route slot with no match — **required per `@slot` in v16** | Server           |
| `route.ts`        | HTTP handler (`GET`/`POST`/…). A segment cannot have both `route.ts` and `page.tsx` | Server        |
| `sitemap.ts` / `robots.ts` / `opengraph-image.tsx` / `icon.*` | File-based metadata routes           | Server                      |

**Which segments deserve their own `loading.tsx` / `error.tsx`:**

| Situation                                                    | `loading.tsx` | `error.tsx`                       |
| ------------------------------------------------------------ | ------------- | --------------------------------- |
| Route group root                                             | optional      | **yes** — one per group           |
| Segment that awaits server data before first paint           | **yes**       | inherit the group's               |
| Expensive screen (long form, report, document generation)    | **yes**, shape-accurate | **yes** — name what failed |
| Purely static/composed screen, no awaits                     | no            | inherit the group's               |
| A segment whose *layout* can throw                           | —             | **one level up** (see below)      |

`error.tsx` does not catch errors thrown by its own segment's `layout.tsx`. To cover a layout, the
boundary must sit in the parent segment. This is the single most common "why is my boundary not
firing" bug.

## 5. Streaming and Suspense placement

The goal is: **the shell — chrome, headings, the parts that need no data — paints on the first byte,
and each slow region streams into its own hole.**

`loading.tsx` is sugar for a `<Suspense>` wrapping the whole segment. It is the right tool when the
*entire* screen needs data. When only part of the screen is slow, an inline `<Suspense>` around that
part is strictly better, because the rest paints immediately:

```tsx
// app/(app)/dashboard/page.tsx
import { Suspense } from 'react';
import {
  DashboardHeader, RevenueChart, RevenueChartSkeleton,
  RecentAccounts, RecentAccountsSkeleton,
} from '@/modules/dashboard';

export const metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  // NOT async: the page itself awaits nothing, so the header streams instantly and the
  // two data regions arrive independently. Awaiting here would delay the whole document.
  return (
    <>
      <DashboardHeader />
      <Suspense fallback={<RevenueChartSkeleton />}>
        <RevenueChart />        {/* async Server Component; owns its own fetch */}
      </Suspense>
      <Suspense fallback={<RecentAccountsSkeleton />}>
        <RecentAccounts />
      </Suspense>
    </>
  );
}
```

Placement rules:

- **Push the `await` down, not up.** The moment a parent `await`s, everything below it is blocked.
  Let each async Server Component fetch its own data behind its own boundary; parallel fetches
  then overlap instead of waterfalling.
- **A boundary in a shared layout is invisible to a client navigation between its children.** Only
  the tree *below* the shared layout re-renders, so the layout's fallback never shows. Boundaries
  for navigation-time loading must live at or below the page.
- **One boundary per independently-slow region**, not one boundary wrapping three of them — a
  single boundary makes the fastest region wait for the slowest.
- **Match every boundary with a shape-accurate skeleton**: the same number of blocks, the same
  heights and gaps as the real content. A spinner (or a mismatched skeleton) causes a layout jump
  when content arrives, which reads as a bug and destroys the CLS score the streaming was for.
- **Skeletons are exported by the module barrel** next to the component they stand in for, so they
  move and change together. A skeleton living in `app/` drifts from its component within weeks.

```tsx
// app/(app)/billing/loading.tsx — the whole screen needs data
import { InvoiceBoardSkeleton } from '@/modules/billing';
export default function Loading() {
  return <InvoiceBoardSkeleton />;
}
```

For a screen with no meaningful shape to mimic, fall back to the shared, **announced**
`common/components/feedback/LoadingState` rather than a bare spinner — its `role="status"` +
`aria-live="polite"` is what turns silence into "loading" for a non-visual user. The component
itself is defined once, in `references/02-design-system.md` §6.

**Version note (16.2+).** `export const unstable_instant = { prefetch: 'static' }` makes Next.js
validate at dev/build time that a route's boundaries are placed such that navigation to it is
instant. Turn it on for the routes you care most about; it converts "we think this is instant" into
a build failure when it stops being true.

## 6. The edge proxy

### 6.1 The file, and its rename

**Next.js 16: `src/proxy.ts`, default-exported function.** On 15.x the same file is
`src/middleware.ts` exporting `middleware()`; the body and the `config.matcher` are identical. The
v16 config flag `skipMiddlewareUrlNormalize` is now `skipProxyUrlNormalize`.

### 6.2 What belongs there, and what does not

| Belongs in the proxy                                        | Why it can only live here                                                    |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Coarse auth gate (redirect anonymous users off private URLs) | It is the only hook that runs before any render, for every request           |
| Session/token rotation that must **persist**                 | It is the only place that both reads incoming cookies and writes cookies the browser keeps — a Server Component cannot set cookies mid-render |
| Injecting request context for Server Components (`x-current-path`) | RSCs have no request object; a request header is the supported channel   |
| Cheap rewrites, locale/host routing                          | Must happen before route resolution                                          |

| Does **not** belong                                     | Because                                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Authorization decisions (roles, ownership, entitlements) | The backend is authoritative. A gate you can see is a gate you can forge; duplicating the rule here creates two truths that drift |
| Database or heavy API calls                              | It runs on **every** request — navigation, RSC payload, every `<Link>` prefetch — so cost multiplies invisibly |
| Anything per-render (data fetching for a page)           | Belongs in the Server Component that needs it, where it can be cached/deduped |
| Response body transformation                             | See §6.4 — touching the response breaks streaming RSC/action payloads         |

### 6.3 The canonical proxy

Copy `templates/src/proxy.ts`. It is the complete file: leg-1 pre-emptive rotation, the coarse
gate, request-header injection, cookie persistence, and the `config.matcher`. Do not re-derive it —
the rotation semantics it encodes are documented in `references/03-server-data-layer.md` §6.

Four things about the copy you must not "simplify":

- **Route predicates are imported, not re-declared**:
  `import { isPrivateRoute, isAuthRoute, SIGN_IN_PATH } from './common/config/private-routes'`
  (§6.6). A second copy of "which routes are private" drifts, and the two failure modes are
  symmetrical: a route in the edge list but not the client's stays visible after sign-out until a
  hard reload; in the client's list but not the edge, and it is reachable by typing the URL.
- **A rotated pair is written twice** — onto `request.cookies` (so the forwarded `cookie` header
  carries it into *this* render) and onto `response.cookies` (so the browser keeps it). Do only the
  second and the current render still uses the dead token, 401ing every server-side call.
- **`secure` is derived from the request**, via `isSecureRequest(request.headers, request.url)` —
  never from `NODE_ENV`. A `Secure` cookie that arrives over plain http is silently discarded by
  the browser, and the user is signed out minutes after signing in with no error anywhere.
- **Only an outright `rejected` verdict clears cookies.** `unavailable` (timeout, 5xx, DNS) must
  leave them alone, or one backend blip logs out everyone browsing at that moment.

A production build fires many of these at once for a single navigation — the document, the RSC
payload, every visible `<Link>`'s prefetch, plus any bootstrap action. `rotateSession` being
**single-flighted per refresh token** is what keeps that fan-out from burning a single-use token;
that is also why the bug only ever reproduces in production, where prefetching exists.

### 6.4 The bug worth memorizing: request headers vs response headers

To hand data to Server Components you must rewrite the **request**. Passing headers at the top level
of `NextResponse.next()` rewrites the **response** — and that clobbers the content type Next.js uses
to frame RSC and Server Action payloads.

```ts
// ❌ WRONG — sets RESPONSE headers.
const requestHeaders = new Headers(request.headers);
requestHeaders.set('x-current-path', pathname);
return NextResponse.next({ headers: requestHeaders });
```

Symptom: **every Server Action in the app fails** with "An unexpected response was received from the
server." The action's response should be `text/x-component`; the copied POST request headers
overwrite it with `text/plain`, so the client runtime cannot parse the stream. Pages still render,
so this looks like a forms bug, not a proxy bug — hours are lost in the wrong file.

```ts
// ✅ RIGHT — sets REQUEST headers; the response is untouched.
const requestHeaders = new Headers(request.headers);
requestHeaders.set('x-current-path', pathname);
return NextResponse.next({ request: { headers: requestHeaders } });
```

Read it in a Server Component with `await headers()` (async in v16; sync on 15.x):

```ts
import { headers } from 'next/headers';
const pathname = (await headers()).get('x-current-path') ?? '/';
```

Set response headers only when you actually mean to (security headers, caching), and never by
copying the incoming request's headers wholesale.

### 6.5 Why `api` must be excluded from the matcher

A redirect is a valid answer to a document request and a corrupt answer to a data request. If the
proxy 307s a `fetch('/api/reports')`, the caller either follows the redirect and parses an HTML
sign-in page as JSON, or sees an opaque CORS/parse failure. Route handlers must therefore read the
session themselves and answer with a status code:

```ts
const { access } = await readSession();
if (!access) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
```

Also exclude `_next/static`, `_next/image`, `favicon.ico`, and any service-worker or mock-worker
script — running the gate on assets adds latency to every byte the page loads and can break the
worker's registration scope.

### 6.6 Private routes: one declarative list

Copy `templates/src/common/config/private-routes.ts`. It exports five things, and every consumer
uses these exact names:

```ts
PRIVATE_ROUTES   // readonly string[] — prefixes requiring a session
SIGN_IN_PATH     // where an unauthenticated visitor to a private route is sent
AUTH_ROUTES      // sign-in surfaces an ALREADY-authenticated visitor must be sent away from
isPrivateRoute(pathname): boolean
isAuthRoute(pathname): boolean
```

It lives in `common/config` so both the routing edge and shared client components can read it
without importing a feature module, which would violate the one-way `app → modules → common`
direction. Its three readers are `proxy.ts`, `robots.ts` (§8), and the client sign-out flow below.

Prefix matching inside `isPrivateRoute` (`=== route || startsWith(route + '/')`) is deliberate: a
bare `startsWith('/billing')` would also gate the unrelated sibling `/billing-public` and produce
redirect loops on pages that were never meant to be private.

**The return path.** The gate appends `?next=<path>`; the sign-in flow reads it and navigates there
after success. Validate it before use — accept only a value starting with a single `/`. The
template does not ship this helper; add it to the same file, because it belongs with the routes it
guards:

```ts
// append to src/common/config/private-routes.ts
/** Reject absolute URLs and protocol-relative paths, or the sign-in form becomes an open
 *  redirect: `?next=https://evil.example` or `?next=//evil.example` would otherwise send
 *  a freshly-authenticated user straight off-site. */
export function safeReturnPath(next: string | undefined, fallback = '/'): string {
  return next?.startsWith('/') && !next.startsWith('//') ? next : fallback;
}
```

Read it in the sign-in flow, never trust it raw:

```tsx
const next = useSearchParams().get('next') ?? undefined;
// after a successful sign-in:
router.replace(safeReturnPath(next));
```

The mirror image runs on sign-out — the client already knows the same list, so it can leave a
now-forbidden route instead of waiting for a failed fetch. The canonical `useSignOut` hook lives in
`references/08-state-and-data-flow.md` §8 (it also purges the query cache, which matters more than
the navigation); this is the routing clause it adds:

```ts
// inside useSignOut, after the store's signOut() and queryClient.clear()
// Leave a route the user may no longer view; otherwise refresh in place so
// server-rendered auth chrome re-evaluates under the now-absent cookie. A store
// update alone only flips client-side chrome.
if (isPrivateRoute(window.location.pathname)) router.replace('/');
else router.refresh();
```

Do not write a second sign-out hook here. Two hooks means one of them forgets `queryClient.clear()`
and the next user on the browser sees the previous user's rows.

## 7. Route handlers (`app/api/**/route.ts`)

Server Components and Server Actions cover almost everything. Add a route handler only when the
consumer is not a React render:

| Need                                                        | Use            |
| ----------------------------------------------------------- | -------------- |
| Data for a Server Component                                 | a service call |
| A mutation from a form or a client component                 | a Server Action (`references/04-actions-and-mutations.md`) |
| A binary/streamed response (PDF, CSV, ZIP) or a linkable URL | `route.ts` GET |
| A webhook from a third party or your backend                 | `route.ts` POST, secret-guarded |
| An endpoint a non-React client consumes                      | `route.ts`     |

```ts
// app/api/invoices/[invoiceId]/pdf/route.ts
import { NextResponse } from 'next/server';
import { getInvoiceDocument } from '@/common/services/invoice-service';
import { mapError } from '@/common/errors';
import { devError } from '@/common/observability/dev-log';

// A GET keeps generation server-side, so the document is just a URL: an <iframe>, a new
// tab, and a "download" link all work with no client state. The alternative — POSTing an
// assembled payload from the browser and turning the response into a blob URL — makes a
// purely server-side render depend on client state and produces nothing linkable.
export async function GET(request: Request, ctx: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await ctx.params;          // v16: Promise. v15: plain object.
  // Params and search params are attacker-controlled. A handler that forwards one straight
  // into a service has no boundary at all.
  if (!/^\d+$/.test(invoiceId)) {
    return NextResponse.json({ message: 'Invalid invoice id.' }, { status: 400 });
  }
  try {
    const stream = await getInvoiceDocument(Number(invoiceId)); // auth from the session cookie
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${invoiceId}.pdf"`,
        // Personal data: never store it in a shared or on-disk cache.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    devError('api:invoice-pdf', error, { invoiceId });
    const { status, message } = mapError(error);
    // `mapError` reports status 0 for non-HTTP failures (e.g. the renderer itself).
    return NextResponse.json({ message }, { status: status >= 400 ? status : 500 });
  }
}
```

Rules: **never redirect** from a handler that a `fetch` calls; return a status. **Always set an
explicit `Cache-Control`** on anything user-scoped. **Guard webhooks with a shared secret** and an
allowlist of accepted values:

```ts
// app/api/revalidate/route.ts
const ALLOWED_TAGS = new Set(['catalog:products', 'dashboard:summary']);

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  // Fail CLOSED on a missing env var, and compare a HEADER rather than a JSON body field:
  // with a body field and an unset env var, `body.secret !== process.env.X` compares
  // `undefined !== undefined` — false — and the endpoint is open to anyone.
  if (!secret || request.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  let tag: unknown;
  try {
    ({ tag } = (await request.json()) as { tag?: unknown });
  } catch {
    // A malformed body must be a 400, not an unhandled rejection that reads as a 500.
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }
  // Allowlist the tags: a caller that can purge arbitrary tags can stampede your backend.
  if (typeof tag !== 'string' || !ALLOWED_TAGS.has(tag)) {
    return NextResponse.json({ message: 'Unknown or missing tag' }, { status: 400 });
  }

  revalidateTag(tag, 'max');   // v16 requires a cache-life profile; v15: revalidateTag(tag)
  return NextResponse.json({ revalidated: true, tag });
}
```

Without this purge path, tagged server caches only expire on their timer — a content change is
invisible for hours and looks like a caching bug in the UI.

## 8. Metadata, sitemap, robots

- **Static where possible, `generateMetadata` only when the title depends on data or on the URL.**
  A `generateMetadata` that returns a constant forces the route to run a function per request for
  nothing.
- **`metadataBase` on the root layout, from validated env.** Without it, relative `openGraph.url`
  and `alternates.canonical` values silently resolve wrong in production.
- **One title template at the root** (`template: '%s | Acme'`) and a bare `title` per route. Routes
  that hardcode the suffix drift the moment the product is renamed.
- **v16: async params in metadata routes.** In `generateMetadata`, `params`/`searchParams` are
  Promises. In `opengraph-image.tsx` / `icon.tsx` the `params` prop — and the `id` prop when
  `generateImageMetadata` is used — are Promises too; in `sitemap.ts` with `generateSitemaps`, the
  `id` is a Promise. On 15.x all of these are plain values.
- **File-based metadata beats hand-written `<link>` tags**: `icon.svg` + `icon.png` (16.2 emits
  both, SVG first with PNG fallback), `apple-icon.png`, `opengraph-image.tsx`, `manifest.ts`.

```ts
// app/robots.ts — derived from the same list the gate uses, so they cannot disagree.
import type { MetadataRoute } from 'next';
import { PRIVATE_ROUTES } from '@/common/config/private-routes';
import { env } from '@/common/config/env';

export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  return {
    rules: { userAgent: '*', allow: '/', disallow: [...PRIVATE_ROUTES, '/api/'] },
    sitemap: `${base}/sitemap.xml`,
  };
}
```

```ts
// app/sitemap.ts — public, indexable pages only. Anything gated is excluded here AND
// disallowed in robots.ts; listing a route a crawler cannot reach wastes crawl budget
// and reports as a coverage error in search consoles.
import type { MetadataRoute } from 'next';
import { env } from '@/common/config/env';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const now = new Date();
  return [
    { path: '/', priority: 1 },
    { path: '/pricing', priority: 0.8 },
    { path: '/sign-in', priority: 0.6 },
  ].map(({ path, priority }) => ({
    url: `${base}${path === '/' ? '' : path}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority,
  }));
}
```

For a large dynamic sitemap, export `generateSitemaps()` and shard by id rather than emitting one
enormous file.

## 9. `next.config.ts` essentials

Copy `templates/config/next.config.ts`. It carries `output: 'standalone'`, the env-derived
`mediaRemotePatterns()` helper, the image defaults, the permanently-banned keys, and the shape a
disabled-option note must take. Four rules govern edits to it:

- **Remote image hosts are an allowlist derived from validated env, never a hardcoded hostname.**
  `next/image` optimizes only allowlisted hosts (v16 tightened this default and removed
  `images.domains` — `remotePatterns` is the only form). Deriving the host from env is what lets
  **one** config serve a mock backend, a staging host and production; a literal hostname works on
  the author's machine and 400s from the optimizer everywhere else. A malformed URL must degrade to
  an empty allowlist, not take the build down.
- **`typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` are permanently banned** — they
  convert a compile-time failure into a production incident. (The `eslint` key was also removed in
  v16, so its presence is a reliable sign the file has not been reviewed since an upgrade.)
- **How to disable an option: never silently omit it.** The note answers three questions or the next
  agent flips it back — *what* is off, the *symptom* that forced it off, and the *condition* to
  re-enable. The template shows the exact shape for the two options this architecture most often
  turns off: `reactCompiler` (it memoizes reads of react-hook-form's `formState` Proxy, so
  `isValid`/`isDirty` freeze and submit buttons never enable — `references/07-forms.md` §9) and
  `typedRoutes` (it fails the build on pre-existing dead hrefs and on data-driven string hrefs that
  need `Route` typing). A bare `// disabled, breaks things` is worse than nothing: it reads as
  superstition, so it gets deleted along with the setting.
- **Reading `process.env` in this file is correct**, unlike in app code: it runs on the build/server
  side only and never reaches the browser bundle.

Other v16 image defaults worth knowing before you fight them: `qualities: [75]` only (a `quality`
prop is coerced to the nearest allowed entry), `maximumRedirects: 3`, `dangerouslyAllowLocalIP: false`,
and `localPatterns` is now **required** for local `src` values carrying a query string. On 15.x,
`remotePatterns` was already required for remote hosts and `typedRoutes` lives under `experimental`.

## 10. Navigation

- **`<Link href>` for every internal navigation.** A raw `<a>` triggers a full document load,
  discarding the client cache, all client state, and the streamed shell.
- **`useRouter` from `next/navigation`**, never `next/router` (that is the Pages Router and will
  throw). Use it imperatively only for navigation that follows an event: after a successful
  mutation, on sign-out, on a wizard step commit. Anything a user *clicks to go to* is a `<Link>`,
  because a link is prefetchable, middle-clickable, and focusable.
- **`router.replace()` when the current entry must not be revisitable** (post-auth screens,
  completed wizards); `router.push()` otherwise; **`router.refresh()`** to re-run the server render
  in place when server-rendered UI depends on state that just changed.
- **Prefetching (v16) is per-segment and deduplicated**: shared layouts download once, requests
  cancel when a link scrolls out of view and re-prioritize on hover. Set `prefetch={false}` only
  for very long lists of rarely-clicked links. Note that prefetch fan-out is **production-only** —
  session/race bugs it triggers cannot be reproduced in dev.
- **`scroll={false}`** on links and `router.push(url, { scroll: false })` when the navigation only
  swaps content inside the current view (tabs, filters), so the page does not jump to top.
- **Preserve back/forward state by placement, not by global stores.** State that must survive a
  back navigation belongs in the URL (`searchParams`) or in a layout that does not remount. If a
  component resets unexpectedly on back, the fix is where it lives, not another store.
- **URL state is server-readable state.** Reading a variant from `await searchParams` in the page
  keeps the branch out of the client bundle *and* saves every consumer from needing a Suspense
  boundary — `useSearchParams()` in a Client Component forces one, and forgetting it fails the
  build.

## Anti-patterns

| Never do this                                                            | Because                                                                                                     | Do this instead                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `NextResponse.next({ headers })` to pass data to Server Components        | Sets RESPONSE headers; overwrites a Server Action's `text/x-component` type → **every action breaks** with "unexpected response" | `NextResponse.next({ request: { headers } })`                                |
| Include `/api` in the proxy matcher while the proxy redirects            | A `fetch` follows the 307 and parses an HTML sign-in page as JSON                                            | Exclude `api` in `config.matcher`; handlers return `401` themselves          |
| Authorize in the proxy ("only admins may see `/accounts`")               | The gate is client-visible and forgeable, and the rule now exists in two places that drift                    | Coarse authenticated/anonymous gate only; the backend enforces the real rule |
| Feature markup or business logic in `page.tsx`                           | The screen becomes unreusable and untestable, and `app/` starts importing module internals                    | Move it into the module; the page composes barrel exports                     |
| Read `params.slug` synchronously (v16)                                   | Build error — `params`/`searchParams` are Promises                                                            | `const { slug } = await params;`                                             |
| `await` the page's data at the top when only one region is slow          | Blocks the entire document on the slowest fetch; nothing streams                                              | Non-async page + `<Suspense>` around each async child                        |
| A spinner (or a wrong-shaped skeleton) as a route fallback               | Content arriving shifts the layout; reads as a bug, destroys CLS                                              | Shape-accurate skeleton exported beside the component                        |
| One `<Suspense>` wrapping three independent regions                      | The fastest region waits for the slowest                                                                      | One boundary per independently-slow region                                   |
| Put the loading/error boundary in the shared layout for sibling routes   | Only the tree below a shared layout re-renders on client navigation — the fallback never shows                | Boundary at or below the page                                                |
| `error.tsx` expected to catch its own segment's `layout.tsx`             | It cannot; the boundary is inside the failing subtree                                                         | Put the boundary one level up                                                |
| A route group per folder "for tidiness"                                  | Identical chrome + identical boundary = pure indirection                                                      | Group only when chrome, boundary, or posture differs                          |
| Two copies of the private-route list (proxy + client)                    | They drift; the gate and the UI disagree and the user bounces                                                  | One exported array in `common/config`, imported by both                       |
| `?next=` used unvalidated after sign-in                                  | Open redirect: `?next=https://evil.example` sends the freshly-authenticated user away                          | Accept only values matching `/` and not `//`                                 |
| Hardcode an image host or an origin in `next.config`                     | Works on one machine; every other environment 400s on image optimization                                       | Derive `remotePatterns` from validated env                                    |
| `typescript.ignoreBuildErrors` / `eslint.ignoreDuringBuilds`             | Converts a compile-time failure into a production incident                                                     | Fix the error; the gate stays on                                             |
| Silently omit a config flag you turned off                               | The next agent re-enables it and reintroduces the bug                                                          | Comment: what is off, the symptom, the re-enable condition                    |
| Redirect from a route handler that `fetch` calls                         | The caller parses HTML as JSON or fails opaquely                                                              | Return `401`/`403` with a JSON body                                          |
| A gated route listed in `sitemap.ts`                                     | Crawlers get a redirect; the URL reports as a coverage error                                                   | Public routes only in the sitemap; gated prefixes in `robots.disallow`        |
| `<a href="/billing">` for an internal link                               | Full document load: client cache, state, and streamed shell all discarded                                      | `<Link href="/billing">`                                                     |
| `useRouter` imported from `next/router`                                  | Pages Router API; throws in the App Router                                                                    | `import { useRouter } from 'next/navigation'`                                |
