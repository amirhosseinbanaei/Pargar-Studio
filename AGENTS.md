<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Kavan Studio — agent instructions

Next.js 16.3 (App Router, React 19, TypeScript strict), **Cache Components on**
(`cacheComponents: true`). Tailwind v4, zod 4. Dev server: `npm run dev` on :3000.

## Architecture

This project follows the `nextjs-app-architecture` skill. Before writing or changing any
framework-specific code (routing, caching, data fetching, Server Actions, forms, error
handling, session), read the matching guide in
`.claude/skills/nextjs-app-architecture/references/` — start from its index.

Layering is machine-enforced in `eslint.config.mjs`: `app → modules → common`, one way,
no cross-module imports, modules consumed through their `index.ts` barrel only. Adding a
module means adding its name to the `MODULES` array **first** — `projects` is the only
entry today, and a module with no entry there has no boundary rules at all.

## Verification

After any non-trivial change run, in this order:

```bash
npm run typecheck && npm run lint && npm run build && npm run test
```

All four pass, or the change is not done.

## Project decisions

- **Next 16.3, not 15.x.** Every later prompt uses `'use cache'`, `cacheLife`, `cacheTag`
  and `updateTag` — Cache Components APIs that do not exist on 15.x.
- **Data is Turso / libSQL.** `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`; prompt 2 wires
  the driver.
- **Bilingual content is per-locale COLUMNS on one row** (`title_en`, `title_fa`), not a
  translations table. Every record carries both locales or neither.
- **The shell keeps its CSS.** `legacy/css/shell.css` and `panel.css` are ported as real
  CSS imported by the shell module (prompt 4) and are not rewritten as utilities — 32KB of
  precisely tuned geometry a utility rewrite would not reproduce faithfully. Tailwind
  utilities are for the dashboard.
- **Tokens are declared twice in `src/app/globals.css`**: `@theme` for what dashboard
  utilities must reach, raw `:root` custom properties for the ported shell CSS, which
  references them by name. That file says which token is which and why some are suffixed.
- **Zero webfont bytes.** The geometric system stack in `--f-sans` is kept exactly as-is:
  no `next/font`, no CDN font CSS, so no FOIT and no CLS.
- **Content services use `cacheLife('max')`** — no expiry timer. _(Open decision, resolved
  in prompt 2.)_ This is studio content: it changes when an editor saves and at no other
  moment, and every dashboard write purges its tags explicitly. A shorter profile would
  re-run the query on a schedule to discover that nothing had changed, while still needing
  the purge for the case that matters — a five-minute-stale project page after a save is a
  bug at any profile.
- **The ported stylesheets live in `src/common/styles/`**, not beside `globals.css`.
  _(Open decision, resolved in prompt 3.)_ They are shared assets and `app/` is composition
  only. `src/app/[locale]/layout.tsx` — the one root layout, see prompt 4 — imports them
  ONCE, in this order: `globals.css`, `base`, `shell`, `panel`, `chrome`, `route`, `i18n`.
  The order is load-bearing: `globals.css` must be first because every rule in the others
  reads its custom properties by name, and `i18n.css` must be last so it can override the
  Latin defaults with no `!important`. Their
  rules are byte-identical to `legacy/css/`; each file carries only a prepended provenance
  header. `route.css` is the exception and is NOT a port — prompt 4 added it for the route
  geometry `panel.css` cannot express; see that prompt's section below.
- **The preloader survives, shortened.** _(Open decision, resolved in prompt 3.)_ Its timings
  live in one named `T` block at the top of `common/lib/motion/preload.ts`, with every legacy
  value recorded beside its replacement. The 1600ms ready-race became 600ms and the lift went
  from ~1240ms to ~880ms: worst case ~2.7s becomes ~1.4s. The original numbers bought
  perceived performance over a genuinely empty page, because the static site had no server
  render. A Server Component puts the shell and its artwork in the HTML, so the preloader is
  now a flourish over a finished page, and a long one costs the very thing it used to buy.
  Restoring the original feel is one edit to that block.
- **The art layer is PURE — confirmed, not assumed.** _(The assumption with the most leverage
  in the migration.)_ `rng`, `palette` and `draw` touch no `document`, `window`, `Date` or
  `Math.random`; the only matches for "window" in the legacy source are the word in prose
  comments. The TypeScript port was verified byte-for-byte identical to
  `legacy/js/art/draw.js` across six seeds, all eight generators and both ratios, and again
  end-to-end: the three SVGs a Server Component served for `qeytarieh-08-residence` hash
  identically to the three the legacy module produces, kind selection included. So the
  generators run on the server, no generator JavaScript reaches the browser, and the drawings
  are part of the cached HTML with no hydration cost and no layout shift. **Never add
  `'use client'` under `src/common/lib/art/`** — that one directive puts ~47KB of generator
  back in the bundle, silently.
- **The project filter taxonomy is DERIVED from the rows that exist**, in
  `getProjectFilters()`, not stored as a constant. _(Open decision, resolved in prompt 2.)_
  It extends what `legacy/data/projects.js:424` already did for `type` to all four axes.
  A hardcoded list goes stale in both directions: it offers a filter matching nothing the
  first time a category empties, and hides a project the first time the dashboard adds a
  type nobody listed. Order comes from the canonical arrays in `common/schemas/enums.ts`
  (the legacy order is deliberate, not alphabetical), with unknown values appended rather
  than dropped.

## The data layer (prompt 2)

Three rings, each importing only the one below. Skipping a ring is how an unparsed row
reaches a page.

```
  services/     <resource>-service.ts       'use cache' + cacheLife + cacheTag; locale mapping
      │
  repositories/ <resource>-repository.ts    queries + THE zod parse. server-only.
      │
  db            services/db.ts + schema.ts  one libSQL client, per process. server-only.
```

Non-negotiables, all machine-checkable:

- `src/common/services/db.ts` is the **only** file that opens a database connection, and it
  reads its URL through `common/config/server-env`, never `process.env`.
- Every file in the layer starts with `import 'server-only'`, so a client import fails the
  build rather than leaking the connection string into a browser bundle.
- A row is `.parse()`d in **exactly one place**, its repository. Nothing downstream casts.
- Components never call the database and never build a query — they call a service.
- Types are derived with `z.infer`. Read schemas tolerant at the leaves, strict at the
  shape; write schemas exact (`z.strictObject`).

### The six tables

Defined in `src/common/services/schema.ts`; migrations are **generated and committed** to
`drizzle/`. `drizzle-kit push` is not the deploy path and must not become one.

| Table              | Rows | Holds                                                        |
| ------------------ | ---- | ------------------------------------------------------------ |
| `projects`         | 76   | the archive, 2013–2025                                       |
| `design_works`     | 9    | objects, marks and details                                   |
| `media`            | 14   | publications, awards, lectures, exhibitions                  |
| `studio`           | 1    | the editorial block — singleton, `id` pinned to 1 by a CHECK |
| `contact`          | 1    | the editable CONTENT of the contact page — same pinning      |
| `contact_messages` | —    | the INBOX: submissions from the public form                  |

`contact` and `contact_messages` are two different things that share a word, and both
exist deliberately: one is page content an editor changes, the other is mail a stranger
sends.

### Per-locale columns

A translated field is a **pair of columns on one row** — `title_en`, `title_fa` — never a
translations table. What each resource translates is mirrored from the legacy Persian layer
exactly, not guessed:

| Table          | Per-locale fields                                                        |
| -------------- | ------------------------------------------------------------------------ |
| `projects`     | title, blurb, description, location, client                              |
| `design_works` | title, blurb, client, scope, materials, description, team, facts         |
| `media`        | title, outlet, blurb, author, excerpt, context, facts                    |
| `studio`       | manifesto, founders, stats, team, alumni, awards, chapters (all of them) |
| `contact`      | address, district, city, country, hours, careers, socials                |

Everything else is a single shared column. In particular:

- **Taxonomy values are NOT per-locale.** `status`, `scale`, `types`, `category` and media
  `type` are canonical English. Their Persian is a UI dictionary
  (`legacy/data/i18n.js:193`), so it lives with the interface; storing it per record would
  give 76 places for one word to drift. `works.fa.js` translates `status` redundantly and
  that value is deliberately dropped.
- **`media.outlet` needs both columns anyway** — some records translate it, some keep the
  Latin name ("ArchDaily"). Which is which is editorial, not a rule.
- **`media.author` is the one nullable text pair.** Five records are awards and have no
  byline; `''` would erase the difference between "nobody wrote it" and "not entered yet".
- **`BRAND` and `NAV` are not in the database.** They are shell chrome — a wordmark and
  five nav labels — and prompt 4 ports them as constants beside the shell.
- Every JSON column stores a JSON **string** and is parsed by `jsonArray()` in the zod
  schema. Never `mode: 'json'`, never a cast.

### Cache tags — the complete list

Declared in `src/common/services/cache-tags.ts` and imported from there, never written as
a literal. **Prompts 6 and 7 purge these exact strings.** A tag set under one name and
purged under another is a no-op: the save succeeds, the toast is green, and the public page
stays stale until the next deploy.

| Tag                  | Set by                                              |
| -------------------- | --------------------------------------------------- |
| `projects`           | `listProjects`, `getProject`, `getProjectFilters`   |
| `project:<slug>`     | `getProject`, `listMediaForProject`                 |
| `design-works`       | `listDesignWorks`, `getDesignWork`                  |
| `design-work:<slug>` | `getDesignWork`                                     |
| `media`              | `listMedia`, `getMediaEntry`, `listMediaForProject` |
| `media:<slug>`       | `getMediaEntry`                                     |
| `studio`             | `getStudio`                                         |
| `contact`            | `getContact`                                        |
| `contact-messages`   | **nothing** — reserved, see below                   |

Singletons have no instance tag: there is one record, so the collection tag already
identifies it, and a second name is a second thing to forget to purge.

**`contact_messages` reads are never cached.** The dashboard inbox must be dynamic — a
cached list shows "no new messages" while a message sits in the database, and the person
who notices is the client who never got a reply. The tag name is reserved so a future
cached read (an unread count in the shell) has one to use.

### The seed

`scripts/seed.ts`, run by `npm run db:seed`. It lives outside `src/` **because that is the
only place allowed to import `legacy/`** — which is its entire job.

- **Missing Persian falls back to English, at write time.** Where an overlay omits a key,
  the English value is written into the `_fa` column — never `null`, never `''`. That
  reproduces `legacy/js/core/i18n.js:154`, whose spread degraded to English rather than
  throwing. A blank Persian page is a worse failure than untranslated text, and by writing
  the fallback in, the read path needs no fallback branch at all.
- **Strings are copied verbatim.** Not translated, re-wrapped or "spacing-fixed": the
  Persian uses meaningful zero-width non-joiners, and numbers deliberately stay in Latin
  digits because the interface converts them at render time
  (`legacy/data/projects.fa.part1.js:3`).
- **Idempotent**: delete-then-insert inside one transaction. `contact_messages` is NOT
  deleted — re-seeding site content must never empty a real inbox.
- Project `id`s are the legacy numeric ids, so a slug rename never orphans a record.
  `sort_order` is the legacy array position (reverse-chronological); the dashboard edits it.

Scripts: `db:generate` (write a migration from the schema), `db:migrate` (apply committed
migrations), `db:seed`. The last two run under `tsx --conditions=react-server`, which is
what resolves the `server-only` package to its empty build outside a React Server
Components bundle.

**Prompt 7 note:** deleting `legacy/` deletes `scripts/seed.ts` and the two tests in
`src/common/services/__tests__/` that spawn it. Seed the production database before that
commit, not after.

## The art, motion and component layers (prompt 3)

```
  common/lib/art/       rng · palette · draw          PURE. Server-rendered. No 'use client', ever.
  common/lib/motion/    anim · cursor · smooth ·      Needs the DOM; carries NO directive.
                        preload · shell · glyphs      One React leaf in components/layout/ mounts it.
  common/styles/        base · shell · panel ·        Real CSS, imported once by app/layout.tsx.
                        chrome · i18n
  common/components/    ui/ → ds/ → form/             Product code imports ds/ and form/, never ui/.
                        variants/ · feedback/ · loader/
```

### The four motion invariants

`common/lib/motion/anim.ts` carries all four, each because of a real failure, each with the
comment that says why, and each with a test in `__tests__/anim.test.ts` — a comment does not
fail a build when someone "simplifies" it.

1. **CSS owns every resting state.** `animate()` defaults to `fill: 'backwards'`, never
   `'forwards'`. A forwards-filled animation keeps overriding the cascade after it ends,
   which is how a closed panel's leftovers reappear on the next open.
2. **Await `anim.done`, never `anim.finished`.** A hidden document stops advancing its
   animation timeline, so an animation started just before a tab switch never resolves.
   `done` races the real promise against the animation's own worst case, so a transition
   state machine can never be stranded mid-flight with its busy flag set.
3. **One `requestAnimationFrame`.** Cursor, both inertia scrollers and any parallax subscribe
   to the single ticker in `onTick()`. N competing rAF loops is the most common source of
   jitter in sites like this.
4. **Damping is frame-rate independent.** `damp(a, b, smoothing, dt)`, where `smoothing` is
   the fraction remaining after one second — identical feel at 60Hz and 120Hz.

### What changed in the shell port, and why

`shell.ts` is the most delicate file in the repo, and its transition is unchanged — every
duration, stagger step, class flip, the queue and the per-glyph FLIP. One structural change:
the four things the static site imported directly (`mountPanel`/`unmountPanel`, the i18n
dictionary, `NAV`, and `draw`) are **injected through `createShell`'s options**. Panels and
i18n belong to prompts 4 and 5, and — more importantly — `shell.ts` ends up inside a
`'use client'` boundary, so importing `draw` there would pull the generators back into the
browser for drawings the server has already rendered. `ensureArt` therefore uses the
server-rendered SVG already in `.col__art`; the lazy path survives only for a caller that
passes `drawArt` and has no server render.

**The FLIP target is always `.ch`.** In English that is one box per letter; in Persian it is
one box holding the whole word, because Arabic-script letters join and wrapping each in its
own inline-block renders the word as disconnected presentation forms. `canSplitGlyphs()` in
`motion/glyphs.ts` is the check, ported intact from `legacy/js/core/i18n.js:190`. Same code
path, same animation, one box instead of eight.

Only `transform`, `opacity` and `clip-path` are ever animated — never `top`, `left`, `width`,
`height` or `letter-spacing`. The tracking collapse is a per-glyph transform, not a
letter-spacing transition.

### Component tiers

- `ui/` is **regenerable**: lowercase files, `Base*` exports, structure and a `data-slot`
  marker, zero product decisions. Anything written there dies at the next regeneration.
- `ds/` is the **public API**: PascalCase, stable props, `displayName`, one file per control.
  Shipped: Button (with `asChild`), Input, Textarea, Select, Checkbox, Table, Dialog, Field,
  Label.
- `form/` binds `ds/` to react-hook-form and knows nothing about HTTP, actions or schemas.
- **Style lives in `variants/*.ts`** (CVA) and every class list terminates in `cn()`, caller
  `className` merged LAST.
- **New tokens added here**, because the legacy site had no form controls and no failure
  state: `--height-control`, `--min-width-control`, `--radius-control` (deliberately `0` —
  nothing in this design is rounded), `--opacity-disabled`, and `--color-danger` /
  `--danger`, a clay red inside the existing warm family at 6.3:1 on `--s-0`.
- **Every custom utility that shadows a Tailwind group is registered** in `cn()`'s
  `extendTailwindMerge` block. The group id for height is `h`, not `height` — getting it
  wrong lets `h-control` and `h-12` both survive a merge, so CSS source order decides and the
  override works in dev but not in the production bundle.
- **Popover/dialog motion is hand-written** in `globals.css` as `motion-fade-in` /
  `motion-pop-in` / `motion-slide-in`. `tailwindcss-animate` is not installed, so
  `animate-in` / `fade-in-0` / `zoom-in-95` are inert classes in Tailwind v4 core. The
  durations are `--d-*` tokens on purpose: the reduced-motion block collapses those to 1ms,
  so the animations still run and still fire completion events without moving.
- **`@source inline(...)` in `globals.css` enumerates every runtime-composed class** — what
  `prefix()` emits and what the radix primitives set. v4's scanner reads source TEXT, so a
  composed class is never generated and the style is missing in the production build only.
  Adding a token to `placeholderTokens` or `focusTokens` means adding its prefixed forms
  there in the same commit.

### React Query's job here

`app/providers.tsx` mounts one QueryClient. **Server data never enters it.** Public pages and
dashboard lists read through Server Components behind `'use cache'`; writes go through Server
Actions that purge a tag. React Query exists for the client-side mutation flows prompts 6 and
7 add — pending state, optimistic updates, retry — and never as a second source of truth for
something the server already rendered. Two copies of one record drift the moment either
refetches.

`@tanstack/react-query-devtools` sits in **`dependencies`, not `devDependencies`**, even
though it renders nothing in production: `providers.tsx` reaches it through `next/dynamic`,
and the bundler must resolve that import while compiling a module in the production render
tree. Under `npm ci --omit=dev` a devDependency there fails the build with "Cannot find
module", far from anything that looks related.

## Routes, locale and the projects module (prompt 4)

The hash-plus-modal model is gone. `legacy/js/main.js:20` read a fragment and
`legacy/js/ui/shell.js` opened the matching section as a panel over the same document, so
every project was a state of one page. Sections, and every project in them, are real
locale-prefixed routes now, server-rendered, one URL per record.

```
  src/app/[locale]/            THE root layout — <html lang dir class="is-fa">
    (site)/                    masthead · footbar · motion boundary · error + loading
      page.tsx                 the five-column index
      projects/                the filtered list  (searchParams)
      projects/[slug]/         one project        (generateStaticParams, 152 pages)
  src/common/i18n/             messages · translator · digits · routing · tehran-time
  src/common/components/layout/  the site chrome, and every 'use client' leaf in it
  src/modules/projects/        the first feature module
```

### The locale is a URL segment

`/en/...` and `/fa/...`, decided in `src/proxy.ts` and validated in the layout. Three things
follow, and they are the reason most of the legacy language machinery has no successor:

- **Each language is independently cacheable and crawlable.** The legacy site served one
  document at one URL for both, so Persian was invisible to a search engine.
- **`lang`, `dir` and `is-fa` are settled before the first byte**, from the segment. That is
  exactly what the blocking inline script at `legacy/index.html:29` existed to do —
  `legacy/README.md` records that a Persian visitor must never watch the layout flip after
  the fact — and a Server Component gets it for free. `is-fa` is not decoration:
  `i18n.css` keys the Persian tracking collapse on it.
- **Switching language is a NAVIGATION**, so there is nothing to re-render in place.

**`prefetchFa`, `loadFa` and `onLang` (`legacy/js/core/i18n.js:29–107`) therefore have no
successor, and that is deliberate.** They existed because the Persian CONTENT layer was a
~60KB lazily-imported module for a single-document site that had to swap languages without
navigating. Content is per-locale COLUMNS collapsed by the service (`toLocaleProject`) here,
so `/fa/projects/x` is a separate cached document that was always Persian — there is nothing
to load on demand, no subscription to fire, and no overlay to merge
(`legacy/js/core/i18n.js:154`). The stored `kavan.lang` preference has no successor either:
the language is in the URL, which is a better memory than `localStorage` because it travels
with a shared link.

`getDictionary(locale)` replaces the module-level `let lang` singleton. That is not a style
choice — two requests for two locales can render in one process at the same moment, and a
module-scoped language would leak one visitor's language into another's HTML.

- **Route slugs are English in both locales** (`/fa/projects`, not `/fa/پروژه‌ها`). Persian
  slugs need a second slug column and a second static-params set; the URL is an identifier,
  not copy.
- **`/` redirects with a 307**, not a 308: the target depends on `Accept-Language`, and a
  permanent redirect would pin a reader to whichever language they first resolved to.
  English is the fallback, matching `legacy/js/core/i18n.js:97` — which also honoured
  `navigator.language`, so `resolveLocale()` reads `Accept-Language`, the server-side form
  of the same signal.
- **Three interface keys were ADDED** to the ported dictionary, the only ones not in
  `legacy/data/i18n.js`: `ui.sections`, `error.title` and `ui.retry` (plus
  `error.notFound`). The legacy markup hardcoded an English `aria-label="Sections"`, and a
  route that can fail needs failure copy the panel model never had. **Their Persian is
  AUTHORED, not ported** — everything else in `messages.ts` is verbatim — and is flagged
  here for a native reader to confirm.
- The dictionary applies the corrections at `legacy/data/i18n.js:326`, not the values they
  superseded: `ui.est` is `Est.` and `ui.projectsCount` is `Projects`, because the originals
  baked the figure into the string and double-printed once the interface supplied it.

### The two open decisions, resolved

- **The per-glyph FLIP runs on route navigation. Kept.** `ShellTransition` injects
  `createShell`'s `onChange` as the navigation: the transition plays on the outgoing view
  with every duration, stagger and class flip unchanged, and the route commits at the moment
  the old code would have mounted a panel. `mountPanel`/`unmountPanel` are no-ops (a section
  is a route), and `router.prefetch` fires on `pointerdown` so the fetch overlaps the
  animation instead of following it.

  **Closing is a clean cut, and that is the honest half of this decision.** `Closer`
  navigates; it does not play the transition in reverse, because the outgoing view on a
  section route has no columns to fly back — there is nothing on screen to animate. A
  half-played reverse is worse than no reverse.

- **Detail pages are FULLY STATIC.** `generateStaticParams` over all 76 slugs in both
  locales; the build emits 163 pages in about three seconds. `dynamicParams` stays at its
  default `true` so a project the prompt-6 dashboard creates is reachable before the next
  deploy — see the soft-404 note below, which is the price of that.

### What prompt 4 changed inside `common/lib/motion/`

Two changes, both forced by integration, neither touching the transition:

- **`markTargets` moved out of `createShell`'s closure into `motion/marks.ts`.** The stepper
  has two drivers now: the shell animates it during the transition off the index, and the
  site layout places it on every section route, where no shell exists at all — a reader who
  deep-links to `/en/projects` never plays a transition and must still see the right dot
  grown. Two copies of that geometry is how the RTL mirroring ends up right in one place and
  wrong in the other. Pure function, unit-tested, numbers unchanged.
- **`ShellApi` gained `destroy()`.** On the static site the shell was created once and lived
  as long as the document, so there was nothing to release. It is a React component now:
  leaving the index and coming back through the Back button constructs a second one, and
  without `destroy()` each round trip leaves another `keydown` handler on `window` and
  another `ResizeObserver` on `.marks` — which lives in the layout and outlives the shell.
  After three visits, one Escape runs three transitions on three detached trees.

`ShellTransition` passes **`nav: () => []`**, and that is not laziness. `setTitles()` rewrites
`.col__hit`'s `innerHTML` from it; those `.ch` boxes are server-rendered by `GlyphText` now
and sit inside React-managed DOM, so an `innerHTML` write there replaces nodes React still
holds. An empty list makes `setTitles` find no entry for any column and leave every one
alone.

### `src/common/styles/route.css` — the one new stylesheet

The other five files in `common/styles/` are `legacy/css/` verbatim and describe a
single-document site: `panel.css` positions a section's content as `.panel`, absolutely,
inside the column it expanded from. A route has no column to sit inside, so `.route` supplies
that geometry and everything below it — `.fgroup`, `.fopt`, `.grid`, `.card`, `.detail`,
`.spec`, `.prose` — is reused from `panel.css` unchanged. It also restates the two rules that
keyed off `aria-pressed`/`aria-expanded` for the `aria-current` links and `<details>` the
route model uses, rather than editing the port.

**The import order is now six files**: `globals` → `base` → `shell` → `panel` → `chrome` →
`route` → `i18n`. `route` after `panel` so it can restate without touching it; `i18n` still
last so the Persian overrides need no `!important`.

`@media (scripting: none)` in that file unclips `.card__frame`. Cards rest at
`clip-path: inset(0 0 100% 0)` and are wiped open by an IntersectionObserver; with scripting
off that reveal never runs, so every server-rendered drawing on the page would be present in
the HTML and invisible.

### The projects module

`'projects'` went into `MODULES` in `eslint.config.mjs` before the folder existed. The module
owns its screens and its filter logic; `app/` imports the barrel and nothing deeper.

- **Filters are `searchParams`, and every filter control is a `<Link>`.** No client state, no
  client JavaScript, and a filtered view is linkable and back-button-correct — none of which
  the legacy rail could do, because its state was a field on an object in a `WeakMap` keyed
  by the panel element (`legacy/js/ui/panel.js:65`).
- **`type` matches with `includes`, not equality.** A project carries more than one type;
  written as equality it silently drops every multi-type project from every type filter.
  Pinned by a test.
- **Filtering happens on the server.** The legacy grid rendered all 76 cards and hid the
  non-matching ones with `.is-out`; there is no reason to ship what you are about to hide.
  `content-visibility: auto` with `contain-intrinsic-size` stays exactly as `panel.css` has
  it — it is what makes 76 cards cost about what the dozen on screen cost.
- **The option counts exclude their own axis** (`legacy/js/ui/panel.js:715`): the number
  beside an option answers "how many would I get if I picked this".
- **The card and the detail page draw the same picture**, because the generators are pure
  and the seed is the slug — `drawingSet(slug, types)[0]` IS `kindFor(slug, types)`. That
  identity is the one visible promise the art layer makes and it is easy to break by
  accident, so `components/__tests__/drawing-identity.test.ts` asserts it.

### Client leaves, and why each one is one

Server Components are the default and the layout is one. Everything that carries
`'use client'` is a leaf with a single reason: `Stage`, `SkipLink`, `SectionHint`, `Closer`
and `LanguageSwitch` read the pathname; `MarkStepper` measures a box; `LiveClock` ticks;
`SiteMotion` owns the cursor and the preloader; `ShellTransition` drives the FLIP;
`CardReveal` adds one class. The clock's first value is computed on the SERVER behind
`await connection()` and a `<Suspense>`, so it is correct in the HTML with no hydration
rewrite — the legacy markup shipped a literal `—` and filled it in on boot.

**The `is-intro` mask has no successor.** It was an inline `<style>` plus a blocking script
in `legacy/index.html:18–44`, hiding the shell until the reveal could animate it in. The
preloader now covers a page that is already finished, `revealShell()` fills backwards from
hidden anyway, and removing a class that was never added is a no-op — so the render-blocking
script is gone.

### Known limitation: unknown slugs are a SOFT 404

`/en/projects/<unknown>` renders the not-found UI correctly but answers **200**, not 404.
This is Partial Prerendering, not a bug in the boundary: the route's static shell is flushed
before `getProject()` has answered, so the status is already committed by the time
`notFound()` runs. Verified against a production build; removing `(site)/loading.tsx` does
not change it.

The fix that WOULD give a hard 404 is `export const dynamicParams = false` on the detail
route, and it is deliberately not taken: every slug would have to exist at build time, so a
project created in the prompt-6 dashboard would 404 until the next deploy. Purging a cache
tag creates content, not routes. **Re-evaluate when the dashboard's publish flow can trigger
a rebuild**, or when Next.js can defer the status for a prerendered shell.

## Deviations from the architecture playbook

Each is deliberate. Re-enable conditions are stated so the next agent does not "fix" them.

- **No MSW / no `src/mocks/` front-db** (skips A14). This app's SQLite database _is_ its
  own local data source, so a seeded dev database gives the same standalone-run property
  MSW would. Re-enable if an external HTTP backend is ever introduced.
- **No Storybook** (skips the workshop half of A12 and the `build-storybook` CI step).
  Deferred under a two-day delivery deadline, not rejected. `eslint-plugin-storybook` is
  therefore absent, and its import and spread are deleted from `eslint.config.mjs` — a
  config referencing an uninstalled plugin cannot load at all. Re-enable when the `ds/`
  tier is stable and there is time for a11y stories.

  **OUTSTANDING (owed, not waived):** `references/02-design-system.md` §7 requires a story per
  `ds/` control, one per meaningful state. Prompt 3 shipped nine `ds/` controls with **no**
  stories. What is NOT owed is the accessibility gate — a Storybook a11y panel was never the
  gate anyway, and every `ds/` control has a real `jest-axe` test in `npm run test` today,
  plus a `direction.test.tsx` covering `dir="rtl"`. When Storybook lands, the stories to
  write are: Button, Input, Textarea, Select, Checkbox, Table, Dialog, Field, Label.

- **`db → repository → service` replaces the HTTP transport ring** (A8's
  `http → api-client → services`). Landed in prompt 2 — see **The data layer** above.
  There is no backend to talk to and no wire response to zod-parse; the ring's invariants
  still hold, one layer lower. This is why `common/constants/api.ts` exports no `API_URL`
  and `common/config/env.ts` declares no API origin.
- **A single signed HttpOnly cookie replaces A9's three-legged JWT rotation** in prompt 6.
  There is one admin and no user table, so there is no refresh token to rotate and no
  session ring to single-flight. Re-enable the full ring only if multi-user auth arrives.
- **No production error tracker.** `common/observability/dev-log.ts` stays dev-only; its
  three reporting call sites report nowhere. Reason and re-enable condition are in that
  file.

## Bans

- **Nothing under `src/` imports anything under `legacy/`.** `legacy/` is the original
  static site, kept byte-for-byte as a read-only reference and **deleted in prompt 7**.
  Read it with your eyes; port values deliberately. Lint enforces this.
- **Do not edit, reformat or "clean up" anything under `legacy/`.** It is the record of
  how the original site worked, and later prompts read it expecting it unchanged.
- No `any`. Use `unknown` plus a type guard, or parse with a schema — `any` disables
  checking transitively for everything downstream.
- No colour, radius, duration or z-index literal in a component. If a token is genuinely
  missing, add it to `src/app/globals.css`; never inline the hex.
- No suppression: `typescript.ignoreBuildErrors`, `eslint.ignoreDuringBuilds`,
  `git commit/push --no-verify`, file-level or blanket `eslint-disable`, `.skip` on a test
  you just broke. A narrow, single-rule, one-line disable naming the false positive is the
  only sanctioned escape hatch.
- No new dependency for something `common/` or the design system already does; check
  first, and say what you checked.
