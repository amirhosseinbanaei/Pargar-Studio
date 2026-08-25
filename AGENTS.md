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
module means adding its name to the `MODULES` array **first** — `projects`, `design`,
`media`, `studio`, `contact` and `dashboard` are the six entries today, and a module with
no entry there has no boundary rules at all.

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

## The editorial routes and the one write (prompt 5)

The public site is complete. All five columns on the index lead to real routes in both
locales, and the last of them writes to the database.

```
  src/app/[locale]/(site)/
    design/            list (one facet) + [slug]   9 works
    media/             list (one facet) + [slug]  14 entries
    studio/            one editorial page          singleton
    contact/           one page + THE form         singleton + contact_messages
  src/app/sitemap.ts   210 URLs, read from the services
  src/app/robots.ts    allows the site, disallows the dashboard prompt 6 has not built yet
  src/common/components/collection/   what projects, design and media share
```

### Four modules, and what was promoted instead of shared sideways

`design`, `media`, `studio` and `contact` went into `MODULES` in `eslint.config.mjs`
BEFORE their folders existed. No module imports another; where two wanted the same thing
it was **promoted to `common/`**, which is the only sanctioned direction.

`src/common/components/collection/` is the new folder, and the line it draws is: a piece
belongs there when its BEHAVIOUR is shared, not when its markup merely rhymes.

| Promoted                   | From                            | Why it could not stay                                                                                                                                          |
| -------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CardReveal`               | `modules/projects`              | `.card__frame` rests at `clip-path: inset(0 0 100% 0)`. A grid without it renders every drawing INVISIBLY — so it is required behaviour, not a projects detail |
| `DetailPlates`             | `modules/projects`              | Carries the seed contract (first plate at the bare seed = the card's picture). Three copies is three chances to "tidy" one into `seed:0`                       |
| `SpecRow`                  | `modules/projects`              | The empty-value rule. Three copies is three chances for one to print `Client —`                                                                                |
| `BackLink`                 | `modules/projects`              | One arrow, one `route.css` rule for the anchor form of it                                                                                                      |
| `FacetRail`                | new                             | Design and Media each filter on ONE axis; the projects rail's cross-axis counting is meaningless with one axis, so this is a sibling, not a generalization     |
| `GridSkeleton`             | new                             | Shape-accurate fallback for both small lists                                                                                                                   |
| `Lat`                      | new, `common/components/layout` | `legacy/js/ui/panel.js:47`'s helper. Names the intent; the `.lat` rule is already in the ported `i18n.css`                                                     |
| `parseFacet` / `facetHref` | new, `common/utils/facets.ts`   | Pure URL work, no resource knowledge                                                                                                                           |

`ProjectDetail` was rewired onto the promoted four. That is the only change to the projects
module in this prompt, and it is a promotion rather than an edit: same markup, same seeds,
same test.

### The editorial routes

- **Design and Media keep their single filter rail** (`legacy/js/ui/panel.js:215` and
  `:279`), as `<details>` plus links — same model as the projects rail, one axis instead of
  four, and the option list is DERIVED from the rows that exist rather than hardcoded.
- **A media card's drawing is seeded from the PROJECT, not the entry**
  (`legacy/js/ui/panel.js:263`), so a press cutting carries the same picture the building
  does. The list route therefore reads the archive as well — one cached call, not fourteen.
- **Every related-project link is resolved before it is rendered.** The route looks the
  slug up and hands the component the project or `null`; a record pointing at a project
  that has been un-published renders with NO link rather than an href that 404s. The join
  is deliberately not a foreign key, so tolerating a miss is the read side of that
  decision. All 11 links in the seeded data resolve; 3 entries have no project at all.
- **`outlet` is bidi-isolated everywhere it appears.** It is Latin in some records and
  Persian in others (`legacy/data/works.fa.js:283` keeps "ArchDaily"), so the rule cannot
  be applied by language — it is applied always, and is a no-op in English.
- **The facts table renders from the record, in its own order.** Both halves of a
  `{ k, v }` pair are translated (`legacy/data/works.fa.js:28`), so a hardcoded label list
  would print English keys on the Persian page and drop any pair an editor adds.
- **Studio is one page with an anchor rail.** The alumni DO render — `legacy/js/ui/panel.js:438`
  prints all forty under "Previously", and the assumption that they might be hidden is
  settled by the source. What is NOT reproduced is the scroll-spy: the rail is plain
  anchors, so no entry claims `aria-current`. Asserting the reader is in the first section
  when they may be anywhere is worse than asserting nothing.
- **Portraits are seeded from the ENGLISH name.** `seedOf` keeps only `[a-z0-9]`, so a
  Persian name collapses to `'-'` and all twenty-two people would share one portrait on
  `/fa/studio` — invisible to anyone testing in English. The studio route therefore reads
  the record twice, in the requested locale and in English, and zips them by index exactly
  as `legacy/js/ui/panel.js:396` did. Pinned by `modules/studio/lib/__tests__/seeds.test.ts`.
- **`brand.meaning` moved from `constants/site.ts` into the dictionary.** It is translated
  (`legacy/data/studio.fa.js:10`) and a constant cannot be bilingual.

### The contact form — the only Server Action in the public site

`modules/contact/actions/contact-message-actions.ts`. It returns an `ActionResult` and
never throws for an expected failure, re-validates its input, takes no identity, and calls
a service (`createContactMessage`) rather than a repository.

- **The client branches on `status`, never on message text.** 429 gets its own copy, 422
  binds field errors, everything else is one sentence. Matching on a message would work in
  exactly one of the two languages.
- **Server field errors are re-localized BY FIELD NAME.** The action answers 422 with the
  wire schema's messages, which are English by design; the form looks the FIELD up in a
  table and prints its own sentence. Same rule as `references/04-actions-and-mutations.md`
  §5.1 — branch on which field the backend named, not on the status alone.
- **`ContactForm` takes a `locale`, not a `Dictionary`.** A dictionary is an object of
  FUNCTIONS and cannot cross the server/client boundary; `@/common/i18n` is client-safe, so
  the leaf builds its own, exactly as `(site)/error.tsx` does.
- **Tier 2, not tier 1**, though four flat fields would normally be tier 1: `FormButton`
  gates on `isValid`, which needs per-keystroke validation, and the zod messages have to
  come from the dictionary — which means a schema built per render, not a module constant.
- **Two schemas, one set of bounds.** `schemas/contact-form.ts` carries localized copy for
  typing; `schemas/contact-submission.ts` is exact and carries none. Both read
  `schemas/limits.ts`, and `schemas/__tests__/agreement.test.ts` asserts they judge every
  edge case the same way. They drifted once during this prompt — `min(10)` in the form,
  `min(1)` inherited by the action — and a nine-character body was accepted by the server
  the form had just refused.
- **NO EMAIL IS SENT.** The dashboard inbox in prompt 7 is where messages are read. Adding
  SMTP is a deploy-time concern with its own credentials and failure modes, and a send that
  fails must not lose a message that was successfully stored. **If email delivery turns out
  to be required for launch, it changes prompt 7's scope.**
- **No cache tag is purged, and that was checked rather than assumed.** `contact_messages`
  is never cached and no public page reads the inbox; the contact PAGE reads the `contact`
  singleton, a different table this write never touches. An `updateTag` here would purge
  nothing.

### The two open decisions, resolved

- **The rate limit is IN-MEMORY, per IP.** `modules/contact/lib/rate-limit.ts`: five
  submissions per ten minutes, a true sliding window, bounded key count, and a refused
  attempt is not recorded (or a reader who hit the limit once could never wait their way
  back in). A table would hold across a fleet and survive a restart, and it would cost a
  database write on every submission — so the flood writes to the database whether or not
  it is allowed through. This is a studio's contact form, not a credential endpoint. The
  honest failure mode is stated in that file: on a multi-instance deploy the effective
  limit is `5 × instances` and a cold start forgets everything. On a single instance it is
  simply exact. Re-evaluate if the site is ever fronted by more than one instance AND the
  inbox actually gets flooded; the fix is a table behind the same function.
- **The site plan is seeded from a FIXED STRING**, `kavan-dezashib-site` — not the
  coordinates and not the address, so editing the address in the dashboard cannot silently
  redraw the plan. The legacy source settles the other half of that question too: the
  generator is **`court`**, not `contour` (`legacy/js/ui/panel.js:508`), and there was
  never an embedded map — a drawn courtyard with a pin over it, captioned with the
  coordinates, and therefore no third-party script, no consent question and no tile bill.
- **Abuse resistance is a honeypot plus that limiter, and NO captcha.** A third-party
  captcha is a third-party script on every contact page, a consent question, and an
  accessibility tax paid by every honest reader. The honeypot answers SUCCESS and writes
  nothing: a 422 would tell a script which field to stop filling.

### Two deliberate divergences from the legacy markup

- **The socials are text, not links.** `legacy/js/ui/panel.js:499` rendered them as
  `<a href="#">`. A placeholder href is a dead link, and the record carries a platform name
  and a handle but no URL — inventing `https://instagram.com/<handle>` would trade a link
  that goes nowhere for one that may go somewhere wrong. They become anchors when the
  dashboard grows a URL column.
- **The studio rail is anchors with no scroll-spy** — see above.

### A bug this prompt found and fixed

`studio.awards` rendered as an EMPTY LIST, in both locales, with no error anywhere.
`legacy/data/studio.js:89` writes an award's year as a NUMBER (`year: 2024`) while
`:104` writes a chapter's as a STRING, and the seed copies both verbatim; `awardSchema.year`
was `looseString`, so every award failed its parse — and `jsonArray` degrades a failed
payload to `[]` on purpose (a leaf must not blank a page), so six awards vanished silently.
The leaf is now `looseYear`, which accepts either spelling and normalizes to a string, and
`common/schemas/__tests__/studio.test.ts` pins it. **The tolerance that keeps one bad row
from blanking a page is also what hides a schema that never matched** — worth remembering
when adding a `jsonArray` column.

### Authored Persian, still owed a native reader

Prompt 4 flagged `ui.sections`, `ui.retry`, `error.title` and `error.notFound`. Prompt 5
adds the fifteen `form.*` keys: the legacy site had no form of any kind, so none of them
are ports. `brand.meaning` is NOT in that list — it is verbatim from
`legacy/data/studio.fa.js:10`.

## Auth and the dashboard (prompt 6)

The write side. `/dashboard` is behind a login, the shell has navigation to all six content
areas, and projects are fully manageable — list, create, edit, delete, reorder — in both
languages, through Server Actions that purge the exact tags prompt 2 declared.

```
  src/common/services/session.ts        THE only module that touches the auth cookie
  src/common/config/session-cookie.ts   its name + attributes, dependency-free so proxy.ts can read them
  src/common/config/private-routes.ts   PRIVATE_ROUTES — read by proxy.ts AND robots.ts
  src/proxy.ts                          leg 1: the coarse dashboard gate. leg 2: locale routing
  src/app/(dashboard)/                  a SECOND root layout, outside [locale]
  src/modules/dashboard/                the shell, the reusable CRUD pieces, projects
```

### The auth model

**One administrator, one password, one signed cookie.** No user table, no roles, no
registration, no password reset. Losing the password means changing `ADMIN_PASSWORD`.

- **`session.ts` is the only module that reads or writes the cookie.** Its name and shared
  attributes live in `common/config/session-cookie.ts` — dependency-free — because
  `proxy.ts` cannot import `server-only` or `next/headers` and needs the name for a
  presence check. Same split the architecture's own template makes for its token reader.
- **The cookie is `base64url(payload).base64url(HMAC-SHA256(payload, SESSION_SECRET))`.**
  The payload is not encrypted and holds nothing secret; the HMAC is what stops a client
  MINTING one. Both the signature check and the password check use a constant-time
  comparison over SHA-256 digests — hashing first is not decoration, it makes the buffers
  equal length so `timingSafeEqual` cannot throw and cannot leak the secret's length.
- **Session expiry is SEVEN DAYS** (`SESSION_MAX_AGE_SECONDS`). This is a studio's content
  editor: the cost of a short expiry is a person signed out on every visit, which trains
  them to keep the password somewhere convenient. **There is no per-session revocation** —
  no session table — so rotating `SESSION_SECRET` is the log-everyone-out mechanism, and it
  is one environment variable.
- **`secure` is derived from the REQUEST**, never from `NODE_ENV`: `x-forwarded-proto` →
  `origin`/`referer` → omit. A `Secure` cookie delivered over plain http is silently
  discarded by the browser, so sign-in "succeeds" and the next request is anonymous — and it
  passes review because localhost is exempt.
- **`readSession()` returns a discriminated result**, never a throw:
  `valid | anonymous | expired | invalid{malformed|bad-signature}`. The server keeps the
  distinction; **every caller collapses it to 401**, because telling someone their signature
  parsed but their expiry did not is telling them their forgery is close.
- **Cookie writes happen only in Server Actions** (`modules/dashboard/actions/session-actions.ts`).
  Never during a Server Component render — the response headers are already committed, so the
  write throws and the failure surfaces far from its cause.
- **Failed logins are rate-limited** in memory, ten per fifteen minutes, per first-hop
  `x-forwarded-for`. Only FAILURES count and a success clears the window, which is the whole
  difference from the contact form's limiter and why the two are not one function.

### There are THREE gates, and only one of them is authorization

| Gate                   | Where                                      | Answers                       | Is it the boundary?                                                                                                    |
| ---------------------- | ------------------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| The proxy              | `src/proxy.ts`                             | "is a session cookie PRESENT" | **No** — a coarse UX gate. Presence is trivially forged, and an action can be POSTed without ever passing through it   |
| The shell layout       | `(dashboard)/dashboard/(shell)/layout.tsx` | "does the cookie VERIFY"      | No — it stops the chrome rendering. Catches what the proxy structurally cannot: a cookie present but expired or forged |
| **Every write action** | `readSession()` as its first statement     | "does the cookie verify"      | **Yes.** A Server Action is a public HTTP endpoint with a stable id in the client bundle, reachable with `curl`        |

**The proxy does NOT bounce an already-authenticated visitor off the login page.** That
mirror gate lives on the login page itself, which calls `readSession()`. Written in the
proxy it would send a visitor holding an EXPIRED cookie to `/dashboard`, whose shell finds
it dead and sends them back — an infinite redirect loop that first appears seven days after
somebody signs in.

**The proxy injects REQUEST headers** — `NextResponse.next({ request: { headers } })`.
`NextResponse.next({ headers })` sets RESPONSE headers, which overwrites a Server Action
response's `text/x-component` content type and breaks EVERY action in the app with an
opaque client-side error that points nowhere near this file.

### A page-level gate, because a layout is not enough

**Every dashboard page's first statement is `await requireDashboardSession()`**, before its
service call. This is not belt-and-braces on the layout check — it fixes a real leak found
by `curl` during this prompt's own verification:

> A request to `/dashboard/projects` with a FORGED cookie came back **200 with all 76 project
> rows in the RSC payload**, alongside `NEXT_REDIRECT;replace;/dashboard/login`. A layout and
> its page render CONCURRENTLY: the layout's redirect fired, but the page had already awaited
> its read and produced its payload. The client router honours the redirect, so nobody ever
> SEES it — the bytes still go over the wire.

Gating inside the page makes the check and the read sequential, so the query never runs.
`__tests__/require-session.test.ts` asserts both the helper's behaviour and — structurally,
by scanning `src/app/(dashboard)/**/page.tsx` — that every page actually calls it.

**Prompt 7 must keep this rule.** For projects the exposure was nil, because those rows are
already public at `/en/projects`. That is luck. `contact_messages` is an inbox of messages
strangers sent the studio, and the identical pattern there leaks something never public.

### The dashboard route group

`src/app/(dashboard)/` — a **second root layout**, deliberately outside `[locale]`. The
public site is bilingual and the locale is a URL segment; the dashboard is an admin tool with
one interface language, and putting it under `[locale]` would make `/en/dashboard` and
`/fa/dashboard` — two URLs and two caches for one tool with one user. The proxy gates
`/dashboard` before its locale leg runs, so nothing there is ever locale-prefixed.

- **The interface language is ENGLISH.** _(Open decision, resolved in prompt 6.)_ Every field
  label maps directly onto a database column name and onto the vocabulary in this file, which
  is what keeps the tool debuggable when somebody has to describe a problem. Persian was
  defensible but would need the full RTL treatment from `legacy/css/i18n.css` applied to the
  chrome — and the CONTENT is bilingual regardless, since the Persian field sits beside the
  English one on every form. `dir="ltr"`, no `is-fa`, **no language switch**.
- **`(shell)` is a nested route group** so `/dashboard/login` renders on a bare document with
  no navigation and no "signed in as" header, while every other route gets both. It adds no
  path segment.
- **Nothing under `(dashboard)` is cached.** No `'use cache'`, no `cacheLife`, no `cacheTag`
  anywhere. The dashboard reads go through the UNCACHED half of `project-service.ts`
  (`listProjectRows`, `getProjectRow`, `getProjectRowById`), which return the bilingual
  `ProjectRow` rather than a locale-collapsed `Project` — an editor shown the value they just
  replaced cannot tell a stale cache from a failed save, and will save again.
- **`loading.tsx` is load-bearing, not decoration.** Cache Components needs a Suspense
  boundary above dynamic work, and every screen here is dynamic by design.
- It imports `globals.css` — the shared token layer — and **none of the five ported
  stylesheets**: those describe a five-column editorial index and a Persian document.

### The cache tags these actions purge

The exact strings, all from `common/services/cache-tags.ts`, never as literals:

| Action                | Purges                                                                               |
| --------------------- | ------------------------------------------------------------------------------------ |
| `createProjectAction` | `projects`, `project:<new-slug>`                                                     |
| `updateProjectAction` | `projects`, `project:<new-slug>`, **and `project:<old-slug>` when the slug changed** |
| `deleteProjectAction` | `projects`, `project:<slug>` — the slug read BEFORE the delete                       |
| `moveProjectAction`   | `projects`, `project:<moved>`, `project:<displaced>`                                 |

- **`updateTag`, never `revalidateTag`.** `updateTag` expires immediately and the same
  request reads fresh; `revalidateTag` serves stale while it refreshes, which to an editor is
  indistinguishable from a save that did not work. If `revalidateTag` is ever genuinely
  needed it MUST pass a cache-life profile as its second argument — the single-argument form
  is deprecated on 16 and still compiles, which is exactly why it survives review.
- **A slug change moves the instance tag.** The old slug exists nowhere after the write, so
  `updateProjectAction` READS THE ROW BEFORE UPDATING IT purely to capture it. Purging only
  the new slug leaves the old detail page cached forever, behind `cacheLife('max')`, at a URL
  that no longer resolves.
- **Purging happens only inside `if (result.ok)`.** Discarding a valid cache on a failed
  write makes every reader pay for a refetch that changes nothing.
- Verified end to end against the seeded database: creating a project took `/en/projects` and
  `/fa/projects` from 76 cards to 77 with no rebuild and no restart, editing a Persian title
  changed `/fa/projects/<slug>` and left `/en` untouched, renaming left nothing at the old
  URL, reordering changed the public order, and deleting took both lists back to 76.

### Every write action, without exception

1. **Re-authorize** — `readSession()` FIRST, before the parse, so an anonymous caller learns
   nothing about the accepted shape and no parsing is done for someone never allowed in.
   Never move it below the parse to make a test pass; mock the session instead.
2. **Re-validate** against `projectSubmissionSchema` (`strictObject`), returning
   `{ ok: false, status: 422, body: z.flattenError(...).fieldErrors }`.
3. **Call a SERVICE** through `toActionResult` — never a repository, never a hand-rolled catch.
4. **Purge the tags**, on success only.
5. **Return a discriminated `ActionResult`.** Never throw for an expected failure: a throw is
   sanitized crossing the RPC boundary and the status and body that field-binding needs are gone.

`id` is a legal argument — it names the RECORD, not the caller. A user, tenant or owner id
never is.

### The two open decisions, resolved

- **Persian fields are OPTIONAL on save.** Only `titleEn` is required. `withPersianFallback`
  in `modules/dashboard/schemas/project-form.ts` writes the English value into an empty `_fa`
  column before the write — exactly what `scripts/seed.ts` already does for a missing
  translation, and what `legacy/js/core/i18n.js:154` did before it. Requiring both would
  block the studio from publishing until somebody had translated it. Because the fallback is
  applied at AUTHOR time, the read path still needs no fallback branch: `pickLocale` stays two
  lines and `/fa/projects/<slug>` never renders a hole. Whitespace-only counts as empty; the
  stored value is never trimmed, because several Persian values carry meaningful ZWNJs.
- **Deleting a project deletes the row outright.** No `deleted_at`, no undo window — that
  would be a schema change. The confirmation dialog is the only safety net, which is why it
  NAMES the record.

### What prompt 7 reuses

Prompt 7 repeats this CRUD pattern for design, media, studio, contact and messages. These are
built to be reused rather than copied, and are exported from `@/modules/dashboard`:

| Piece                                         | What it owns                                                                                                                                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RecordForm`                                  | The form scaffold: submit lifecycle, 401/422/404 branching, binding an `ActionResult`'s `fieldErrors` onto inputs, the focus move, the result region. A new editor is a schema, a resolver, some fields and one `onSave` |
| `RecordTable` + `sortRows` + `parseSortState` | The list table with URL-driven sorting. `key: null` preserves the collection's natural order                                                                                                                             |
| `DeleteRecordDialog`                          | The confirmation. Names the record, stays OPEN on failure, `useTransition` so it does not close onto a stale list                                                                                                        |
| `ResultRegion`                                | The inline outcome region, rendering the one normalized `{ status, code, message, fieldErrors }` shape                                                                                                                   |
| `LocaleFieldPair`                             | English and Persian side by side, `dir="rtl"` + `lang="fa"` on the Persian INPUT only. Every remaining area has translated columns                                                                                       |
| `RowReorder`                                  | Two arrows, disabled at the boundaries AND whenever the table is sorted by a column                                                                                                                                      |
| `requireDashboardSession`                     | The page-level gate above                                                                                                                                                                                                |
| `DASHBOARD_AREAS`                             | The six areas. **Flip `available: true` and add the route folder** — that is the whole navigation change                                                                                                                 |

`FormCheckboxGroup` is deliberately NOT exported: one consumer, and promotion happens on the
second. `design_works.category` and `media.type` are both single-valued, so prompt 7 may
never need it; if it does, move the file to `common/components/form/`.

**Reordering sends an INTENT, not an order.** `moveProjectAction` takes `{ id, direction }`
and the SERVICE computes the new positions from the current rows, renumbering by index rather
than swapping two values — a swap is a silent no-op the moment two rows share a `sort_order`.
A client posting 76 ids in a new order would silently revert anything changed since the page
loaded. A new project is placed FIRST, at `min(sortOrder) - 1`, which costs one read instead
of 76 writes.

### A bug this prompt found and fixed

`NEXT_PUBLIC_MEDIA_URL` had no empty-string preprocess in `common/config/env.ts`, while its
sibling `TURSO_AUTH_TOKEN` in `server-env.ts` did — and `.env.example` ships
`NEXT_PUBLIC_MEDIA_URL=` under a comment saying to leave it empty. So a checkout that copied
the documented contract verbatim failed `npm run build` with "Invalid URL", naming the
variable but not the reason. Fixed with the same preprocess the sibling uses. **The tolerance
that makes a key optional is not the same as accepting how "unset" is spelled in a dotenv
file** — worth remembering when adding an optional variable.

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
- **A single signed HttpOnly cookie replaces A9's three-legged JWT rotation.** Landed in
  prompt 6 — see **Auth and the dashboard** below. There is one admin and no user table, so
  there is no refresh token to rotate and no session ring to single-flight. Re-enable the
  full ring only if multi-user auth arrives.
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
