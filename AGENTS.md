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
- **~~Zero webfont bytes.~~ REVERSED IN PROMPT 8 — one webfont, Persian only.** English is
  unchanged and still requests nothing: the geometric system stack in `--f-sans` is kept
  exactly as-is, so an English document downloads no font file, has no FOIT and no CLS.
  Persian now loads **Vazirmatn** through `next/font/google`, because `i18n.css` had named
  it first in the Persian stack since the port with nothing ever loading it — so Persian
  rendered in Vazirmatn only for a reader who happened to have it installed and fell
  through to Tahoma for everyone else. See "The Persian webfont" under prompt 8.
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
- **~~The project filter taxonomy is DERIVED from the rows that exist.~~ HALF-REVERSED IN
  PROMPT 9 — the CANON is a table now; presence still gates.** The option list comes from
  `taxonomy_terms`, which an editor owns; what survives unchanged is the rule that an option
  nothing uses is not offered and a value no term declares is appended rather than dropped.
  See "Editable taxonomies (prompt 9)" below. The original decision, and the reasoning that
  is still load-bearing:

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

### The seven tables

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
| `taxonomy_terms`   | 29   | every closed axis, for every subject — prompt 9              |

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

| Tag                  | Set by                                                 |
| -------------------- | ------------------------------------------------------ |
| `projects`           | `listProjects`, `getProject`, `getProjectFilters`      |
| `project:<slug>`     | `getProject`, `listMediaForProject`                    |
| `design-works`       | `listDesignWorks`, `getDesignWork`                     |
| `design-work:<slug>` | `getDesignWork`                                        |
| `media`              | `listMedia`, `getMediaEntry`, `listMediaForProject`    |
| `media:<slug>`       | `getMediaEntry`                                        |
| `studio`             | `getStudio`                                            |
| `contact`            | `getContact`                                           |
| `contact-messages`   | **nothing** — reserved, see below                      |
| `taxonomy-terms`     | `getPublicTerms`, and every rail read that composes it |

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
migrations), `db:seed` — which, since prompt 7 deleted the content seed and prompt 9 restored
the NAME for a different script, seeds `taxonomy_terms` and nothing else. See "Editable
taxonomies (prompt 9)". The last two run under `tsx --conditions=react-server`, which is
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

`getDictionary(locale)` replaces the module-level `let lang` singleton. **Prompt 8 renamed
it `getIntl` and rebuilt it on next-intl** — see that prompt's section; the argument-not-a-
singleton reasoning below is unchanged and is why `createTranslator` was chosen over the
request-scoped `getTranslations`. That is not a style
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
  AUTHORED, not ported** — everything else in the dictionary is verbatim — and is flagged
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

  **Closing is a clean cut, and that is the honest half of this decision.** Closing
  navigates (the wordmark, Back, or the Escape key `SectionEscape` binds since prompt 8,
  which deleted the `Closer` button that used to start it); it does not play the
  transition in reverse, because the outgoing view on a
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
`'use client'` is a leaf with a single reason: `Stage`, `SkipLink`, `SectionHint` and
`LanguageSwitch` read the pathname (as did `Closer`, deleted in prompt 8, whose Escape
handler now lives in `SectionEscape`); `MarkStepper` measures a box; `LiveClock` ticks;
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
  the leaf builds its own, exactly as `(site)/error.tsx` does. **Superseded in prompt 8:**
  building one in the browser pulled both catalogs into the client bundle, so the form now
  takes NO props and reads `useTranslations()` from `NextIntlClientProvider`. The reason
  it could never take a `Dictionary` is unchanged.
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

## The rest of the dashboard, deployment and the audit (prompt 7)

Every content area is now editable from the dashboard, `legacy/` is deleted, the app builds
and runs in a container against Turso, CI runs the four-command gate, and Part C of the
adoption playbook has been run against the finished repo. (It was the last prompt in the
planned sequence; prompt 8 follows, and reverses two of the decisions recorded above.)

```
  src/app/(dashboard)/dashboard/(shell)/design/       CRUD, create + edit + delete + reorder
  src/app/(dashboard)/dashboard/(shell)/media/         same shape, plus a related-project select
  src/app/(dashboard)/dashboard/(shell)/studio/        singleton editor, one route, no [id]
  src/app/(dashboard)/dashboard/(shell)/contact/       singleton editor, same shape
  src/app/(dashboard)/dashboard/(shell)/messages/      the inbox: list, read, mark-read, delete
  src/modules/dashboard/components/RepeatableListField.tsx    string[] editor
  src/modules/dashboard/components/RepeatableGroupField.tsx   array-of-objects editor
  src/modules/dashboard/schemas/shared.ts              year bounds + the Persian-fallback helpers
  Dockerfile, .dockerignore, compose.yaml, .github/workflows/ci.yml, scripts/ci-fixture.ts
```

### Design and media follow the projects pattern exactly

`createDesignWorkAction` / `updateDesignWorkAction` / `deleteDesignWorkAction` /
`moveDesignWorkAction` and their media equivalents are `project-actions.ts` with the field
names changed: re-authorize, re-validate against a `strictObject` submission schema, call a
service through `toActionResult`, purge on success only. `design-work-service.ts` and
`media-service.ts` grew the same "dashboard half" `project-service.ts` already had —
bilingual `*Row` reads, no cache, `create`/`update`/`delete`/`move` — for the reasons
recorded under prompt 6.

**No search or filter rail for design (9 rows) or media (14 rows), and that is a scope
decision, not an omission.** `ProjectListScreen` filters 76 rows across four taxonomy axes
because a table that size is genuinely hard to scan; nine and fourteen rows are not. The
sortable `RecordTable` header and the reorder arrows are the whole list experience these two
tables need. Revisit if either collection grows enough that a flat list stops being legible.

### The related-project field is a select, populated by the ROUTE

`schemas/media-form.ts`'s `projectSlug` is a `<select>`, never free text — a hand-typed slug
that does not match a real project produces a dead link on `/en/media/<slug>`, which prompt 5
built "resolve the link before rendering it, tolerate a miss" specifically to survive at READ
time; the WRITE side should not manufacture the exact typo that behaviour exists for. The
options come from `listProjectRows()`, called by `media/[slug]/page.tsx` and `media/new/page.tsx`
(Server Components) and passed to the `'use client'` `MediaForm` as a prop, because a client
form cannot import a `server-only` service. The HTML `<select>` cannot hold `null`, so the form
spells "no related project" as `''` (`NO_RELATED_PROJECT`) and the submission schema converts
that to `null` on the way in.

### `RepeatableListField` and `RepeatableGroupField` — one generic pair, not six bespoke editors

`design_works.team` / `studio.team` / `studio.alumni` are `string[]` columns;
`design_works.facts`, `media.facts`, `studio.founders`, `studio.stats`, `studio.awards`,
`studio.chapters` and `contact.socials` are all arrays of small, flat objects. Building a
bespoke editor per field would be nine near-identical components differing only in which
keys they know about — nine places for one bug (a lost `Remove` handler, a swapped
`k`/`v`) to land once and need fixing nine times. `RepeatableGroupField` takes a `columns`
list of `{ key, label, multiline? }` and is schema-agnostic beyond that, which is what lets
one component describe six different row shapes. Both are built on react-hook-form's
`useFieldArray`, not a hand-rolled `useState` array, so add/remove stays inside the form's
normal dirty/validate lifecycle. Neither ships a raw JSON textarea — the one thing this
prompt was explicitly built to avoid, because a JSON blob in a text field is how a studio
breaks its own site at 11pm.

Both live in `modules/dashboard/components/`, not `common/components/form/`, on the same
promote-on-second-consumer rule `FormCheckboxGroup` already documents: the day a resource
outside `dashboard` needs either one, it moves unchanged.

**Order preservation was verified, not assumed**, after an end-to-end check first appeared to
show an appended award landing FIRST rather than last. The cause was the verification
script's own selector — `input[placeholder="Title"]` matches both the English AND the
Persian column, since `AWARD_COLUMNS`' labels are plain English strings used for both
locales' inputs, and once more than one row existed the script filled an EXISTING row
instead of the newly appended one. Re-run with a locator scoped to the "Awards · English"
`FormItem` confirmed `append()` places the new row last and the public page renders it
there — `useFieldArray.append` behaves exactly as documented. Recorded here because the
same placeholder-collision would trip up the next person who tries to script this form.

### Persian is optional here too, generalized to lists

Same resolved decision as projects (prompt 6): only `titleEn` is required, everywhere.
`withPersianFallback` in each area's form schema fills an empty Persian TEXT column with its
English counterpart (`fallbackText`, `modules/dashboard/schemas/shared.ts`) and — new in this
prompt — fills an empty Persian LIST wholesale from the English one (`fallbackList`), rather
than trying to merge per item. A studio publishing a new object should not be blocked on
translating its team or its facts table before the record can save at all. Per-ITEM content is
not filled in: an editor who adds a row and leaves it blank gets the blank row back, exactly as
a lone Persian text field left blank would.

The dashboard's OWN submission schemas (`design-work-form.ts`, `media-form.ts`,
`studio-form.ts`, `contact-form.ts`) are deliberately more lenient than
`common/schemas/*.ts`'s `*CreateSchema`s — e.g. `titleFa` has no `.min(1)` here, though the
common schema's inferred TYPE says `string`. This is not a drift: the common schemas are
never `.parse()`d in the dashboard write path at all (the repositories only parse the OUTPUT
row, per prompt 2's rule), so they function purely as a TypeScript type anchor that
`withPersianFallback`'s return value is checked against structurally. The zod `.min(1)` in
`ProjectCreate`/`DesignWorkCreate`/etc. is therefore decorative outside the seed and outside
any future code path that actually calls `.parse()` on them — worth knowing before assuming
those schemas are a runtime gate on this path.

### The studio and contact editors are singletons: no list, no create, no delete

**Resolved: one submit for the whole record**, not one action per collection
(`studioSubmissionSchema` / `contactSubmissionSchema` cover the entire row). `/studio` and
`/contact` are each read as ONE page — the manifesto sits above the founders which sit above
the numbers — and a partial save could leave the public page showing a combination the editor
never previewed. `updateStudioAction` and `updateContactAction` take no id at all: `studio`
and `contact` are pinned to id 1 by a CHECK constraint, and `updateStudio`/`updateContact`
always target that row. Neither service exposes a dashboard-facing `create*`: offering one
risks a second attempt at row 1, which the database would refuse with a constraint error
instead of the field-level message a form should give. If the database is unseeded,
`getStudioRow()`/`getContactRow()` return `null` and the page renders a plain "run
`npm run db:migrate`" message rather than a broken form — there is nothing to build a create
form's `defaultValues` from.

`RepeatableGroupField` is reused for `founders`, `stats`, `awards`, `chapters` and `socials`;
`RepeatableListField` is reused for `team` and `alumni`. No third variant was built.

### The messages inbox

`/dashboard/messages` lists `contact_messages` newest-first (already the repository's native
order — no column here is sortable in the UI, and `RecordTable` renders it with `key: null`
throughout to preserve that order rather than re-sorting). Unread rows carry a visual marker
(`text-t-hi` + a dot, `aria-hidden`) plus an `sr-only "(unread)"` word, so the state is never
colour-only.

**Marking a message read fires from a mounted CLIENT component, not from the route's own
render.** The tempting alternative — have `messages/[id]/page.tsx` call
`markContactMessageRead` while it renders — has a real failure mode: `next/link` prefetches a
route on hover/viewport by default, so a reader merely scanning the inbox and pausing over a
row would silently mark it read before ever opening it. Prefetching fetches the RSC payload
ahead of time; it does not mount or hydrate client components, so a `useEffect` in
`MessageDetailScreen` only fires on an actual, real navigation. This also keeps the write
inside the module's one mutation mechanism — a Server Action — rather than carving out a
second one (a route-render side effect) for this single case.

**No cache tag is purged, anywhere in `contact-message-actions.ts`, and that is checked by a
test, not assumed.** `contact_messages` is declared in `cache-tags.ts` but deliberately never
cached (prompt 2) and no public page reads it — the public contact PAGE reads the `contact`
singleton, a different table these actions never touch. `__tests__/contact-message-actions.test.ts`
reads the action file's own source and asserts it contains no `updateTag(` call and no
`next/cache` import, the same pinning technique `require-session.test.ts` uses for the
session gate, so a purge added here later without updating that test fails immediately.

### The cache tags this prompt's actions purge

| Action(s)                                                     | Purges                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `create`/`update`/`delete`/`moveDesignWorkAction`             | `design-works`, `design-work:<slug>`, and `design-work:<old-slug>` on a rename |
| `create`/`update`/`delete`/`moveMediaAction`                  | `media`, `media:<slug>`, and `media:<old-slug>` on a rename                    |
| `updateStudioAction`                                          | `studio` only — a singleton has no instance tag                                |
| `updateContactAction`                                         | `contact` only                                                                 |
| `markContactMessageReadAction` / `deleteContactMessageAction` | **nothing** — see above                                                        |

Verified end to end against the seeded database (§8 of the prompt this section answers):
editing a design work's Persian title changed `/fa/design/<slug>` immediately and left
`/en/design/<slug>` untouched; choosing a related project on a media entry produced a working
link on its public detail page; editing the studio manifesto changed `/en/studio` immediately;
an award added through `RepeatableGroupField` rendered on the public page in append order;
submitting the public contact form produced an unread row that opening marked read and
deleting removed. `docker compose`'s equivalent (a container built from this repo, run
against a database reached the same way Turso would be) served the site and reflected a
dashboard write on the public page from inside that same container — see the container
section below for what stood in for the real Turso credentials this environment does not
have.

### Deleting `legacy/`

Every prompt that needed it had read it: prompt 2 seeded from `legacy/data/`, prompt 3 ported
`legacy/js/` and `legacy/css/`, prompts 4 and 5 reproduced its layouts. `git rm -r legacy/`
landed in the same commit as `scripts/seed.ts` and the two tests that depended on it
(`seed.test.ts` directly, `project-repository.test.ts` indirectly through the now-deleted
`seeded-database.ts` fixture helper) — confirmed by grep before deleting anything, and by
running `npm run typecheck && npm run lint && npm run build && npm run test` clean afterward.
`project-repository.test.ts` was rewritten rather than deleted: it now migrates a throwaway
database and writes its own fixture row through `projectRepository.create`, so the
null-for-missing-slug and JSON-column-decodes-to-array contracts are still covered, with no
dependency on `legacy/` or any particular content having existed.

**The seed reproduced every record before deletion, and that was confirmed, not assumed:**
`npx tsx --conditions=react-server scripts/seed.ts` printed `projects 76 · design_works 9 ·
media 14 · studio 1 · contact 1 · contact_messages 0 (left untouched)` immediately before the
`git rm`, matching every count AGENTS.md already declared.

**`scripts/seed.ts` has no successor, and `npm run db:seed` is gone from `package.json`.**
_(The script name came back in prompt 9 for `scripts/seed-taxonomy.ts`, which seeds the term
table and nothing else — it is not this script reborn and has a different data source.)_
Its entire job was porting `legacy/data/*.js` into the database; once that tree is gone there
is nothing left to seed FROM. The database is now the only copy of the studio's content —
the README documents restoring a new environment from a `turso db shell ... .dump` backup
instead of re-running a migration script with no data source. **The production Turso database
must be seeded from `scripts/seed.ts` BEFORE this commit is deployed for the first time** —
run it from the last commit that still has both `scripts/seed.ts` and `legacy/` (available in
git history), against production credentials, before or as part of rolling this prompt out.
This repository was not deployed to a real Turso instance as part of this work — see the
container section below.

### The container needs no volume, and Cache Components needed a real database at BUILD time too

`Dockerfile` / `.dockerignore` / `compose.yaml` are the architecture skill's templates,
adapted for the one structural difference this app has from the template's assumed shape:
there is no HTTP backend and no `api` service, so `compose.yaml` has one service, not two, and
nothing here needs the "browser URL vs. container-internal URL" split the template exists to
teach — `TURSO_DATABASE_URL` is the same value everywhere. `Dockerfile`'s `ARG`/`ENV` set is
`NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_MEDIA_URL` (public, build-time) and
`TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` (also build-time — see below); `ADMIN_PASSWORD` and
`SESSION_SECRET` are baked in the builder stage as fixed, non-secret placeholder strings,
never as `ARG`s, so a real credential is never even offered the chance to land in a layer.

**A bug this prompt found and fixed: `public/` did not exist.** This app ships zero image
files, so no prior prompt had ever needed a `public/` directory — and the Dockerfile
template's `COPY --from=builder /app/public ./public` failed the image build outright with
"not found" the first time it was tried. Fixed by adding `public/.gitkeep`; Next's standalone
trace and the Dockerfile both need the directory to exist even though it holds nothing.

**`generateStaticParams` needs the database to hold real rows at BUILD time, not just at
runtime — verified by trying it empty.** With `cacheComponents: true`, Next 16 fails the build
outright if any `generateStaticParams` returns zero results ("all generateStaticParams
functions must return at least one result"); this app's project/design/media detail routes
derive their params from the database, so `docker build` needs `TURSO_DATABASE_URL` (and
`TURSO_AUTH_TOKEN` if it is a `libsql://` URL) to be REACHABLE and non-empty from wherever the
build runs, not only from the running container — both are therefore `ARG`s in the builder
stage, unlike a typical REST-backed app where only `NEXT_PUBLIC_*` values need to be. This is
the same constraint that shaped the CI fixture below.

**Verified locally with a substitution, not against real Turso — recorded rather than
glossed over.** This environment has no Turso credentials, so the container verification used
a local `file:` database (the seeded dev `kavan.db`) passed through a bind-mounted volume as
a stand-in for the network Turso connection production actually uses; `TURSO_DATABASE_URL` is
read identically either way; only the write path being local-disk instead of network-Turso is
different. `docker build` with that substitution produced 245 static pages matching the
seeded counts; the running container answered `/api/health` with `200 {"ok":true}` and
Docker's own `HEALTHCHECK` reported `healthy`; and a dashboard sign-in, a design-work edit,
and its immediate appearance on `/fa/design/<slug>` all succeeded against that same running
container. One operational finding from that run, specific to the substitution and NOT a
product defect: a bind-mounted host file must be writable by the container's non-root
`appuser` (uid 1001) — the container runs as non-root deliberately (Dockerfile), and a
read-only mount produced "Network error, no response" on save with nothing useful in
`docker logs` (a production Next server logs no per-request access log by default, unlike
`next dev`). Irrelevant to a real deploy, where Turso is reached over the network and there is
no local file whose permissions matter — recorded here so the next person debugging a
container-local write failure checks the mount before the code.

### CI needed its own fixture, because `scripts/seed.ts` cannot survive to serve it

`.github/workflows/ci.yml` runs the four-command gate on every push, minus the
`build-storybook` step the template appends (no component workshop in this project — see
Deviations, below). The harder problem was the database: `npm run build` needs a non-empty
one (previous section), but `scripts/seed.ts` is deleted in the SAME history CI has to keep
building against every push AFTER this one — a workflow step that shells out to a deleted
script breaks the very next push. `scripts/ci-fixture.ts` is the answer: it is NOT a seed —
no legacy data, no bilingual editorial content, no claim of being real — it migrates a
throwaway `file:` database and writes exactly one minimal row per table
`generateStaticParams` reads (one project, one design work, one media entry) through the same
repositories the app uses. Verified locally before committing: `npm run build` against that
fixtured throwaway database produced 53 static pages and exit code 0, where the same build
against a migrated-but-EMPTY database failed outright with the `generateStaticParams` error
above. It is intentionally not wired to any `package.json` script name a developer would run
by habit — it exists solely for CI, per `references/11-tooling-and-gates.md` §10's rule that
`scripts/` may hold ad-hoc operational tooling nothing in `src/` imports from.

### The two open decisions, resolved

- **Studio and contact save the whole record in one submit, not one action per collection.**
  See "The studio and contact editors are singletons," above. Recommended in the prompt and
  taken as recommended, because a partial save could show a combination of new and old
  content the editor never previewed on a page that is read as one continuous document.
- **A database backup belongs in the deploy sequence: yes.** `README.md`'s deploy steps open
  with `turso db shell <database-name> ".dump" > backup-$(date +%F).sql`, before migrations
  run. Taken as recommended: once `legacy/` is gone, the live database is the only copy of the
  studio's content, and the cost of the step is one documented command.

### Outstanding — owed, not fixed here

Nothing new. The one debt this repository already carried into this prompt is unchanged and
still owed: `references/02-design-system.md` §7's a11y stories for the nine `ds/` controls
(Button, Input, Textarea, Select, Checkbox, Table, Dialog, Field, Label), deferred under the
no-Storybook decision recorded below. This prompt added no `ds/`-tier component —
`RepeatableListField` and `RepeatableGroupField` are `dashboard`-module components, not `ds/`
primitives — so it neither pays down nor adds to that debt.

### The Part C conformance audit

Run against the finished repository. **Zero unmet blockers.** Every check below was executed
directly (grep commands from the playbook's "how to verify" column, or read the source where
a grep cannot settle the question) rather than inferred; a hit that turned out to be a
docstring or a test-mock forwarding call is called out as a false positive rather than
silently dropped.

**Verified this pass, all PASS**, spanning the checks most likely to have moved under this
prompt's diff and every blocker in the checklist:

`BND-01` `BND-02` (all six modules) `BND-03` `BND-04` `BND-05` `BND-08` (all six) `BND-11` ·
`DS-01` `DS-11` · `SCH-01` `SCH-10` · `ACT-01` `ACT-03` `ACT-05` `ACT-07` `ACT-09` `ACT-15`
`ACT-16` · `ERR-06` `ERR-11` · `RTE-02` `RTE-09` (single `(dashboard)/loading.tsx` covers
every nested route, including all five new areas) · `STA-09` · `TST-10` · `TOOL-01` `TOOL-11`
· `DATA-16`.

Two of those are worth a sentence each, because the grep alone is inconclusive:

- **`ACT-15`/`ACT-16`** (the two the prompt asked to be checked with particular care): every
  tag in `CACHE_TAGS` is purged by at least one action (`contactMessages` is the sole,
  documented exception — declared, never cached, never purged, exactly as prompt 2 specified)
  and `grep -rn "revalidateTag([^,)]*)" src` matches only the two dashboard action TEST FILES'
  own mock definitions (`revalidateTag: (...args) => revalidateTag(...args)`, a passthrough
  spy, never invoked with a literal single tag) — no production code calls the deprecated
  single-argument form anywhere.
- **`RTE-02`**: the raw grep also flags `DesignWorkListScreen.tsx` / `MediaListScreen.tsx` /
  `ProjectListScreen.tsx` reading `searchParams.sort` without `await`. Each is reading an
  ALREADY-AWAITED plain object passed down as a prop from its `page.tsx` (`const [rows,
params] = await Promise.all([...service call..., searchParams])`), not the Next.js promise
  itself — a false positive the heuristic cannot distinguish, confirmed by reading each
  `page.tsx`.

**Inherited, not re-verified item-by-item this pass:** every Part C item not listed above —
principally the `DS-`, `FRM-`, `STA-` and `TST-` items describing the `ds/`/`form/` tiers, the
React Query wiring and the mock layer, none of which this prompt touched. These were sound as
of prompt 6 (no contrary evidence found while working through this prompt) and this audit did
not re-derive them from scratch; a future full re-audit should still walk the complete
checklist rather than trust this note indefinitely.

**Score, computed only over the items actually verified in this pass** (blockers excluded
per the rubric — they gate rather than score): 7 majors met, 0 unmet; the minors checked
(`BND-11`, `RTE-09`) both met. `(3×7 + 1×2) / (3×7 + 1×2) = 1.00` on that subset. This is a
narrower claim than "the repository scores 1.00 on Part C" — it says the highest-risk slice
this prompt could have broken did not break, not that all ~100 items were individually
re-scored.

**Deviations, each recorded rather than silently accepted, and NOT counted as failures**:

- No search/filter rail for design or media (see above) — a scope decision proportional to
  9 and 14 rows, not a missing feature.
- `contact-message-actions.ts` purges no cache tag — by design, pinned by a test (see above).
- Marking a message read happens client-side on mount, not in the route's own render — see
  above; the alternative has a real prefetch-triggered false-positive-read failure mode.
- `scripts/seed.ts`, `legacy/` and their two dependent tests are gone; `scripts/ci-fixture.ts`
  stands in for CI's throwaway database, and is explicitly NOT a seed script reborn.
- The dashboard's own submission schemas are more lenient than `common/schemas/*.ts`'s
  `*CreateSchema`s on Persian fields — not a drift, because the latter are never `.parse()`d
  on this path (see "Persian is optional here too," above).
- Container verification substituted a local `file:` database for network Turso, for the
  reason stated above (no Turso credentials in this environment); the production Turso
  database must still be seeded from `scripts/seed.ts` before this prompt's first real
  deploy, from the commit before this one.

## next-intl, the Persian webfont and the masthead (prompt 8)

Two decisions this file recorded are **deliberately reversed here**, and both reversals are
written down beside the originals so the next agent does not "fix" them back: the
hand-rolled i18n layer is now next-intl, and "zero webfont bytes" is now "one webfont,
Persian only".

```
  src/common/i18n/routing.ts       defineRouting — locales, defaultLocale, prefix, no cookie
  src/common/i18n/navigation.ts    createNavigation — Link, usePathname, getPathname (+ 2 wrappers)
  src/common/i18n/request.ts       getRequestConfig, locale from next/root-params
  src/common/i18n/catalog.ts       loads the JSON, declares AppConfig, TYPES the fa catalog
  src/common/i18n/messages/{en,fa}.json   the strings
  src/common/i18n/translator.ts    getIntl(locale) — t · num · count · term · list
  src/common/components/layout/SectionEscape.tsx   the Escape key the deleted Closer had
```

### The installed version, and why the shape matters

**next-intl `4.14.0`** (`npm i next-intl@latest`, 2026-08-28), against Next.js `16.3.2`.
Its `peerDependencies` accept `next: ^16.0.0`, so 16.3 needed no pin and none was taken.

The App Router API changed shape at v4 and a v3-shaped setup fails at build naming a file
you did not write. What this repo uses is the v4 set: `defineRouting`, `createNavigation`,
`getRequestConfig`, and `createNextIntlPlugin` in `next.config.ts` — the plugin is what
aliases `next-intl/config` to `src/common/i18n/request.ts`, and **without it every
next-intl server API throws "Invalid i18n request configuration detected"**. The path is
non-default (`./src/common/i18n/request.ts`, not `src/i18n/request.ts`) because shared
infrastructure lives under `common/` here.

`request.ts` reads the locale from **`next/root-params`, not `requestLocale`**.
`requestLocale` is deprecated in v4 and reads a header, which under Cache Components would
make every page that touches it dynamic — this app prerenders 245 pages and must keep
doing so. `next/root-params` reads the `[locale]` segment and is static-safe on 16.3.

### Why the hand-rolled dictionary was reversed

`messages.ts` was a 411-line TypeScript object and `translator.ts` a hand-written `t`/`num`/
`term`/`list`. That was a defensible starting point and its header said so. It is reversed
because next-intl owns plural rules, per-locale number and date formatting, ICU message
arguments and rich text, and — the half that actually bit — it keeps **the routing, the
redirect and the alternate links in one place**, where the hand-rolled version had them in
three: a string-concatenating `localeHref`, a bespoke `Accept-Language` parser in the
proxy, and a `localeAlternates` that agreed with both only by inspection.

### The catalogs, and the two properties that had to survive the move

`src/common/i18n/messages/en.json` and `fa.json`, **generated from `messages.ts`
programmatically** rather than retyped, so every Persian string — zero-width non-joiners
included — is byte-identical to the port.

- **KEYS ARE NEVER RENAMED, REGROUPED OR TIDIED.** They are not an internal detail: the
  ported stylesheets and the projects module name them directly, and `term()` composes
  `${group}.${value}` from a **database column**, so `<group>.<value>` is load-bearing.
  `type.Interior Design` still has a space in it. Renaming one is a repo-wide edit.
- **Nested JSON, flat call site, and that is not a rename.** next-intl addresses a message
  by a dotted PATH, so `{"nav": {"projects": …}}` is asked for as `t('nav.projects')` —
  the exact string the old flat table used as its key. Every call site is unchanged.
- **A missing Persian string is still a COMPILE error.** `catalog.ts` annotates the Persian
  import as `Messages` (`const faMessages: Messages = fa`), which is what reproduces the old
  `Record<MessageKey, string>`. Verified by deleting `nav.projects` from `fa.json`:
  `npm run typecheck` fails and names the missing key. The `AppConfig` augmentation on top
  of that makes `t('nav.projcts')` a type error too — also verified.
- **The EXTRA-key direction is a test, not a type.** Excess-property checking does not apply
  to a variable assignment, so a Persian key nothing renders is invisible to `tsc`.
  `__tests__/catalog.test.ts` covers it, along with "no Persian numerals in a stored string"
  and a guard against ICU-significant characters (`{`, `}`, `'`) — next-intl parses every
  message as ICU, so one of those would be a silent parse failure rather than the string an
  author meant.
- **`term()` does NOT go through next-intl, deliberately.** next-intl renders the KEY for a
  missing message, which would put the literal `status.Warehouse` on a public page. Its
  argument comes from a database column and the dashboard can introduce a value nobody has
  translated, so `term()` looks at the catalogs directly and degrades **fa → en → the raw
  value**. Verified end to end: a project whose `status` column held `Mothballed` rendered
  `Mothballed` on the card, in the spec table and in the filter rail — never
  `status.Mothballed`, never blank.
- **`ui.close` was removed from both catalogs.** Its only consumer was the deleted closer
  (the button's label and `relang()`'s re-label of it). Grepped first, then removed together
  with the `ShellStrings.close` plumbing that fed it. `ui.escToClose` STAYS — `SectionHint`
  and the shell's `#hint` both still use it.

### Numbers: two paths, and which call sites take which

`num()` and `count()` are both on the dictionary and they are not interchangeable.

| Path           | Implementation                                                                 | Takes              | Call sites                                                                                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `num(value)`   | `faDigits` — a pure string transform, **digit shaping only, never grouping**   | `string \| number` | Years (`project.year`, `entry.year`, `work.year`, `chapter.year`, `award.year`, `BRAND.founded`), `contact.postcode`, zero-padded column and jump indices (`'01'`), and already-FORMATTED strings (`project.area` = `'1,240 m²'`) |
| `count(value)` | next-intl's `createFormatter().number` — locale digits **and** locale grouping | `number`           | Genuine quantities: the footer's project count, the filter rails' option counts and "shown" figure, `shown.length` on the design and media screens, `studio.team.length` / `alumni.length`                                        |

**`num` is not `format.number` and that is the whole point.** `format.number(2007)` is
`'۲٬۰۰۷'`, so routing years through the formatter would print a thousands separator inside
every project card's year. And several call sites hand it a string a number formatter
cannot take at all — `digits.ts:28` records that deliberately. `count` exists so a genuine
quantity still gets the separator right (U+066C in Persian) the day a collection passes a
thousand; today every one of them is under a hundred, so the two agree on real data and
`__tests__/translator.test.ts` pins the difference rather than the coincidence.

### Routing: what each prompt-4 helper became

| Prompt 4                         | Now                                                                                                                                                                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `localeHref(locale, path)`       | **Kept as a thin wrapper** over next-intl's `getPathname`. Fifteen callers need the STRING, not a `Link`: `basePath` props on the filter rails, `app/sitemap.ts`'s absolute URLs, the shell transition's imperative `router.push`                     |
| `switchLocale(pathname, next)`   | **Deleted, no successor.** `LanguageSwitch` asks next-intl's `usePathname()` for the locale-less path and hands `<Link locale={…}>` the swap                                                                                                          |
| `resolveLocale(acceptLanguage)`  | **Deleted.** next-intl negotiates with `Negotiator` + `@formatjs/intl-localematcher` inside the middleware                                                                                                                                            |
| `localeAlternates(locale, path)` | Same name, same callers, **now sourced from `getPathname`** so the canonical and the hreflang set cannot disagree — and cannot disagree with next-intl's own `alternateLinks` response header either, since both compile down to one `routing` object |
| `isLocale` / `DEFAULT_LOCALE`    | Kept, both now reading `routing` (`hasLocale`, `routing.defaultLocale`) rather than declaring a second copy                                                                                                                                           |

Two configuration choices in `routing.ts` are decisions, not defaults:

- **`localePrefix: 'always'`.** Both locales stay prefixed including the default. Dropping
  the prefix for English would change every canonical URL, `app/sitemap.ts` and both
  `generateStaticParams` sets at once.
- **`localeCookie: false`.** next-intl writes `NEXT_LOCALE` by default and **prefers it over
  `Accept-Language`**, which would reintroduce exactly the stored `kavan.lang` preference
  prompt 4 dropped: the language is in the URL, which is a better memory because it travels
  with a shared link. Asserted by a test (`set-cookie` must be absent) as well as by config.

**`routing.ts` must not import `next/navigation`** — `src/proxy.ts` imports it, and the
proxy runs before route resolution. That is the only reason `createNavigation` lives one
file away in `navigation.ts` instead of beside the config it configures.

**One behaviour regression, recorded rather than glossed over:** `resolveLocale` matched the
obsolete `pe` / `pe-IR` tag as Persian (`legacy/js/core/i18n.js:97` tested `/^fa|^pe/`).
next-intl's BCP-47 matcher does not, so `Accept-Language: pe-IR` now resolves to English
rather than Persian. Every other case is identical — quality ordering, `q=0`, a partial
match like `fan`, and an absent header — and all of them are pinned in
`src/__tests__/proxy.test.ts`. `pe` was deprecated in favour of `fa` in 1989 and no current
browser emits it; the fix, if one is ever wanted, is a `localeDetection` callback rather
than a second parser.

### The proxy composes two middlewares, in a fixed order

`src/proxy.ts` still exports its own `proxy` function and its own matcher. next-intl's
middleware is **built once at module scope and called INSIDE** it, after the
`isPrivateRoute` early return:

```ts
const routeLocale = createMiddleware(routing);          // compiled once, not per request

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPrivateRoute(pathname)) return gateDashboard(request, pathname);   // leg 1
  return routeLocale(request);                                             // leg 2
}
```

- **The file is NOT replaced by `export default createMiddleware(routing)`**, the shape
  next-intl documents. That would lose leg 1 entirely, and next-intl's matcher would then
  see `/dashboard` — the one request that must never be locale-prefixed, because the
  dashboard is deliberately outside `[locale]` and `/en/dashboard` is not a route.
- **The matcher is unchanged and is not merged with next-intl's.** One matcher, and
  `/dashboard` is caught by leg 1 before the locale leg ever runs.
- **`x-current-path` and the exact spelling `NextResponse.next({ request: { headers } })`
  are untouched.** The other spelling sets RESPONSE headers and breaks every Server Action
  in the app with no server error and no stack — see the file header.
- **The redirect is still a 307.** `NextResponse.redirect` defaults to 307 and next-intl
  passes no status, so this was verified rather than configured: `curl` on `/` answers
  `307`, `Location: /en`, and `/fa` under `Accept-Language: fa`.

Verified against a production build: `/dashboard`, `/dashboard/login` and
`/dashboard/projects` are never locale-prefixed even with `Accept-Language: fa`, and **two
Server Actions still succeed** — signing in, and saving a project, which answered "Saved.
The public site is already showing it" with no console error, wrote the row, and purged the
tag so `/en/projects/<slug>` reflected it immediately.

### The Persian webfont, and what it costs

`Vazirmatn` via `next/font/google` in `src/app/[locale]/layout.tsx`, `subsets: ['arabic',
'latin']`, `display: 'swap'`, exposed as the CSS variable `--f-vazirmatn` and referenced
from the Persian stack in `common/styles/i18n.css`. No family literal outside the token
layer, and `var(--f-vazirmatn, "Vazirmatn")` keeps a locally-installed copy working if the
request is blocked. The rest of the fallback stack stays behind it, so a failed request
lands on IRANSansX or Tahoma and never on a browser serif default.

- **The variable is set on the `<html>` of the PERSIAN document only**, alongside `is-fa`.
  English carries neither, so nothing there ever resolves to the family.
- **`preload: false`, and that is the load-bearing option.** `next/font` preloads by
  default, and the preload is emitted by the LAYOUT — which both locales share — so
  `/en` was fetching both `.woff2` subsets with `--f-vazirmatn` unset and not one glyph
  rendered from them. **This does not reproduce in `next dev` in a way you would notice and
  the tag names the file by hash, so it was caught by measuring, not by reading.** With
  preloading off the CSS drives the request, which happens under `html.is-fa` and nowhere
  else. Measured in a real browser against a production build: **English = 0 font requests;
  Persian = 2** (arabic + latin subsets), `document.fonts.check('16px Vazirmatn', 'کاوان')`
  true.
- **What it costs.** On Persian the fetch starts after the stylesheet is parsed rather than
  at HTML parse — a slightly later swap. With the font request held back 3s, Persian text
  paints immediately in the fallback (no FOIT, no blank) and reflows ~5% on swap. English
  is unchanged and still request-free.
- **The `@font-face` block itself rides in a stylesheet both locales link.** That is ~1KB of
  CSS on an English page and **zero font bytes**, which is the claim that matters.
- The two comments in `globals.css` that said "no next/font, no CDN font CSS" were corrected
  in the same commit rather than left to mislead.

### The closer is gone; the language switch stands in its place

`Closer.tsx` and its barrel export are deleted. `LanguageSwitch` moved into the slot it
occupied — the end of the masthead row — and is **moved, not duplicated**; nothing else
replaces the closer. Its three known loose ends were all handled, and a **fourth was found
by checking rather than assuming**:

1. **CSS.** `.closer` / `.closer__x` in `shell.css` and their two `[dir="rtl"]` mirrors in
   `i18n.css` are removed. No dead selectors.
2. **`motion/shell.ts`.** `getElementById('closer')`, `onCloserClick`, its `addEventListener`,
   its `destroy()` removal, and `relang()`'s re-label of the button's `<span>` are all gone
   together.
3. **The masthead's own positioning rule was rewritten, not just inherited.** The switch was
   `position: absolute; inset-inline-end: 5.5rem` — offset to clear the closer at `right: 0`
   — and hidden entirely when a section was open. It is now `margin-inline-start: auto` in
   the flex row, so `dir` mirrors it with **no RTL rule at all**; the closer needed one
   precisely because it was pinned to a physical edge. It inherits the closer's visibility
   contract: shown in an open section (the footer carries the switch on the wide index), and
   shown at every stage state below 860px where the footer has no room for it. Measured in
   both directions at 1440 and 800: flush against the masthead's inline-end, right in
   English and left in Persian.
4. **ESCAPE DID NOT SURVIVE, contrary to the assumption — and `SectionEscape` is the fix.**
   `Closer` bound Escape at the ROUTE level. The reasoning going in was that
   `createShell`'s own `keydown` handler already covered it. **It does not**, and pressing
   Escape on `/en/projects` did nothing at all: the shell is constructed by
   `ShellTransition`, which only the INDEX route renders, and navigating to a section
   unmounts it and runs `destroy()` — which takes that listener off `window` by design. A
   reader who deep-links to a section never had a shell in the first place. So on every
   route where Escape means anything, the handler was not bound.
   `common/components/layout/SectionEscape.tsx` is a non-visual client leaf in the site
   layout that restores it, with `Closer`'s exact rule (`history.length > 1 ? back() :
push(home)`). Verified in a browser: Escape returns to the index from a section, goes to
   the locale index from a deep link with no history behind it, and does nothing on the
   index.

### Client leaves stopped importing the catalogs

`NextIntlClientProvider` sits in `src/app/[locale]/layout.tsx` with `locale` and `messages`
passed **explicitly**, so the provider awaits no request scope — this layout is the root of
every prerendered page and letting it read request config under Cache Components is exactly
the thing `next/root-params` was chosen to avoid. What needs it is small and specific:
`LanguageSwitch`'s `Link` and `usePathname` resolve the current locale from that context.

It also paid for itself. `(site)/error.tsx` and `ContactForm` now call `useTranslations()`
instead of building a dictionary from a `locale` prop — which had pulled **both** catalogs
into the browser bundle. `ContactForm` therefore takes **no props at all** now, and
`ContactScreen` lost the `locale` it existed only to forward; `createContactFormSchema`
takes the `t` function rather than a whole `Dictionary`, so either accessor can feed it.
The dashboard is **not** wrapped in a provider and is not localized — that decision stands
unchanged.

### One test-only configuration change

`vitest.config.mts` gained `test.server.deps.inline: ['next-intl']`. next-intl ships ESM
that imports `next/server` and `next/navigation` as BARE specifiers; externalized — the
default for anything under `node_modules` — those reach Node's resolver, which cannot read
the `exports` map that maps them, and every suite touching `next-intl/middleware` or
`next-intl/navigation` fails with "Cannot find module … Did you mean to import
next/server.js?". It is a test-resolution concern only; the Next.js bundler resolves both.

### The two open decisions, resolved

- **`messages.ts` is DELETED, not kept as a re-export shim.** Taken as recommended. Two
  sources for one dictionary is the drift `cache-tags.ts:6` exists to prevent one concern
  over, and a shim would have kept a 411-line file alive as the thing everyone edits while
  the JSON quietly became the thing that ships. `catalog.ts` replaces it and is a **loader**,
  not a second copy: it imports the JSON, types it, and exports `MESSAGES`. `grep -rn
"getDictionary" src/` returns only three prose mentions in comments explaining the rename.
- **Persian numerals come from `faDigits` for strings and from next-intl's formatter for
  quantities.** Taken as recommended, and the split is sharper than the recommendation:
  see the table above. The deciding case is that `project.year` is a `number` yet must not
  be grouped, so "is it a number" was the wrong question — "is it a quantity" is the right
  one.

## Editable taxonomies (prompt 9)

Every closed axis in the app was a frozen `as const` array in `src/common/schemas/enums.ts`
and the write schemas enforced it with `z.enum`. So there was no way to add a category, hide
a retired or empty one, change the order options appear in, or change a Persian label —
every one of those was a code edit and a deploy, from a dashboard built so the studio would
not need one. A term is a row now.

```
  src/common/services/schema.ts             taxonomy_terms + its unique index
  src/common/schemas/taxonomy.ts            subjects, axes, SUBJECT_AXES, the row contract
  src/common/services/taxonomy-repository.ts   queries + THE zod parse
  src/common/services/taxonomy-service.ts   cached public half · uncached dashboard half
  src/common/utils/taxonomy.ts              the rail's three-way degradation rule (pure)
  src/modules/dashboard/components/TaxonomyEditor.tsx   ONE editor, mounted three times
  src/modules/dashboard/actions/taxonomy-actions.ts     five actions
  src/modules/dashboard/lib/taxonomy-guard.ts           the write-time check, as one clause
  scripts/seed-taxonomy.ts                  `npm run db:seed`
```

### The table, and the index that is not optional

`taxonomy_terms`: `id`, `subject` (`project|design|media`), `axis`
(`type|status|scale|category`), `value`, `label_en`, `label_fa`, `sort_order`, `visible`, and
the shared timestamps. **One table for all three subjects** — the axes differ but the shape
does not, and three tables would be three migrations, three repositories and three editors
for one change.

**`UNIQUE (subject, axis, value)`.** That triple is a term's identity — it is what a content
row's stored string resolves against. Without the index two rows can claim one value, and
then the option list renders it twice, the usage count goes to whichever was read first, and
deleting one leaves the other, with no error anywhere.

**There is deliberately NO foreign key** from a content row to a term, for the same reason
`media.project_slug` has none: a term may be hidden, deleted from a shell, or never have
existed for a value an older row carries, and such a row must **degrade** — render its raw
value, stay filterable — rather than disappear or fail a constraint.

### The write path: `z.enum` became a runtime check

`enums.ts` is **not deleted and is no longer the enforcement point**; its own header says so
at the top, in those words. The arrays stay for two real jobs: they are what
`scripts/seed-taxonomy.ts` writes into the table, in their declared order, and they are the
historical record of the vocabulary the archive was authored with. The exported types are
kept, now derived from the arrays rather than from a `z.enum`.

Enforcement moved to **`unknownTermErrors()` in `taxonomy-service.ts`**, reached through
`modules/dashboard/lib/taxonomy-guard.ts`'s `checkTaxonomy` — a plain module, not an export
from a `'use server'` file, which would have published it as an endpoint. Every content write
action runs it after the schema parse and answers `{ ok: false, status: 422, body: fieldErrors }`
naming the offending field, so `RecordForm` binds it with no new branch. A compile-time enum
is the wrong check once terms are editable: a type added five minutes ago would be rejected
by code that shipped last week. **The rest of every write schema is exactly as strict** —
still `strictObject`, still `.min(1)`.

The check reads **all** terms, hidden ones included: hiding takes an option off the public
rails, it does not retract the value from records that carry it, and those must stay saveable.

### The rails read the table, and degrade in three steps

`getProjectFilters(locale)`, `getDesignWorkFilters(locale)` and `getMediaFilters(locale)` each
compose `getPublicTerms(subject)` with their own rows through `common/utils/taxonomy.ts`'s
`optionsForAxis`. The rule has three branches and all three matter:

| Term state                          | On the rail                                             |
| ----------------------------------- | ------------------------------------------------------- |
| declared, visible, some row uses it | offered, with its `label_en`/`label_fa`                 |
| declared but HIDDEN                 | not offered at all, whatever the rows say               |
| not declared, some row uses it      | **appended**, unlabelled, so its records stay reachable |

- **Presence still gates.** A term nothing uses is not offered — the prompt-2 decision above,
  unrepealed. `visible` is a VETO over that set, not a way to force an empty option onto a rail.
- **The middle row was a real bug**, caught end-to-end and not by reading. The first
  implementation filtered `visible` in the QUERY (`listVisibleBySubject`), which looks
  obviously right and means a caller cannot tell a just-hidden term from a value nobody
  declared — so the append branch put it straight back on the rail with its raw English
  value, and hiding demoted a label and changed nothing else. The flag has to travel with the
  row. `taxonomy-repository.ts` carries a comment where that function used to be.
- **Labels degrade term → message catalog → raw value**, the same three steps the i18n layer
  documents for `term()`. Verified: a project whose `status` was `Mothballed` rendered
  `Mothballed` on the Persian rail and its detail page — never `status.Mothballed`, never blank.
- **`year` is NOT a term** and stays derived from the rows. It has no label to translate and
  no order to choose.

### The editor is on each subject's own page

`TaxonomyEditor`, exported from `@/modules/dashboard`, mounted three times with a different
`subject` on `/dashboard/projects`, `/dashboard/design` and `/dashboard/media`, above the
record list. **Not on a settings page**, and that placement is the feature: the count beside
each term is counted from the very rows in the table below it, so "can I delete this?" is
answerable without leaving the screen. One component rather than three copies, on the same
rule the rest of `index.ts` already lists.

Collapsed by default as a `<details>` — `FacetRail.tsx:64`'s pattern, inverted: that rail has
one group and nothing below it so it opens; this page's job is the LIST. Per term it shows the
English label, the Persian label in its own `dir`/`lang` the way `LocaleFieldPair` does, the
wire value, the use count, a visible toggle, edit, delete and `RowReorder`'s arrows. It also
lists **undeclared values** the records carry, so an option appearing on a public rail that
the editor does not list is never a mystery.

### Deleting an in-use term is refused with a 409 and a count

There is no foreign key, so the database would accept the delete and silently orphan the
rows: they keep the value, the value keeps rendering, and the only symptom is an option gone
from a rail that nobody can explain. `deleteTaxonomyTermAction` answers
`{ ok: false, status: 409, body: { count } }` and the editor says so and points at the visible
toggle — the non-destructive way to take an option off the site. `DeleteRecordDialog` gained
one prop for it (`resolveRefusal`), which branches on the status and the named key, never on
message text.

### Every term write purges TWO tags

`taxonomy-terms` **and** the collection tag of the term's subject — `projects`, `design-works`
or `media` — because a public rail is one cached entry composed from both tables. Purging only
the first refreshes an inner read nobody renders and leaves the rail as stale as before;
purging only the second updates the grid while the rail above it still offers the retired
option. `taxonomySubjectTag()` in `cache-tags.ts` is the second half, spelled once.

The subject is read from the ROW the write returned, never from an argument, so a crafted POST
cannot purge — or fail to purge — the wrong collection.

Nesting does not help: `getPublicTerms` carries `taxonomy-terms` on its OWN cache entry, and
that tag is not lifted onto the entry of a function that calls it. Every composing read spells
both tags out.

### The seed, and the one thing prompt 7 left behind

**`scripts/seed.ts` and `npm run db:seed` did not exist when this prompt ran** — prompt 7
deleted them with `legacy/`, their only data source. `scripts/seed-taxonomy.ts` is a new
script under the restored `db:seed` name, and its header says plainly that it seeds
`taxonomy_terms` **and nothing else**. It has a data source that is still in the repository and
always will be: the arrays in `enums.ts` plus the Persian labels in `i18n/messages/fa.json`.
It is not a content seed reborn; a content seed would need its own name and its own source.

- **Idempotent by UPSERT on the identity triple, not by delete-then-insert.** The old content
  seed deleted first; here that would throw away every label an editor changed, every position
  they reordered and every flag they cleared. A term that exists is left alone. Verified: two
  runs leave 29 rows.
- **`sort_order` is the position in the `enums.ts` array.** That order is the legacy one, is
  deliberate and is not alphabetical, and the seed is the only chance to carry it across.
  Verified: `Residential … Industrial`, `Completed / Under Construction / Concept`.
- **One term has no Persian yet: the design status `In production`**, which the ported catalog
  never carried (the legacy Persian layer translated a design work's status redundantly and
  that value was deliberately dropped). The seed falls back to the English string, as the read
  path does. It is owed a native reader, and the editor is now where it gets entered.

### The two open decisions, resolved

- **A term's `value` is IMMUTABLE after creation.** Taken as recommended. It is not on the
  update form, and — more to the point — it is not in `taxonomyTermUpdateSubmissionSchema`, so
  a POST carrying one is REFUSED by `strictObject` rather than ignored. A rename would have to
  rewrite every content row holding the old string inside the same transaction, and a partial
  rename is data corruption behind a green toast: both halves keep rendering. The labels carry
  any change, which is what they are for.
- **A hidden term still filters for someone holding its URL. Kept working.** Taken as
  recommended, and it falls out of the design rather than needing a branch: `parseFacet` and
  `parseProjectFilters` never validated against the taxonomy (`facets.ts:14` — 404-ing a stale
  link is the wrong answer), so `?type=Retired` still matches its records and still renders
  them. Verified on all three subjects.

### The `kindFor` coupling — read this before renaming a project type

`kindFor(seed, types)` at `src/common/lib/art/draw.ts:943` chooses a project's generated
drawing by matching TYPE SUBSTRINGS, lowercased and joined: `/urban|complex|industrial/`,
`/villa/`, `/interior|renovation/`, `/hospitality|office|commercial/`. A type that matches
none of them falls through to the default weighting.

**Nothing throws, and a project's drawing CHANGES when its types change.** Adding a type named
`Warehouse` is harmless; renaming `Villa` to `Villas`, or giving a project a new type
alongside its existing ones, silently redraws every card and detail page for that project —
the archive redrawing itself, with no error and no failing test.

This is a coupling between an editable taxonomy and the art layer, and it is the one thing in
prompt 9 that a term edit can change outside the taxonomy. Two mitigations exist and neither
is a guard: the wire `value` is immutable, so a term can never be _renamed_ into or out of one
of those regexes — only a new value assigned to a project can move it — and
`modules/projects/components/__tests__/drawing-identity.test.ts` pins the card/detail identity
(confirmed still passing). If a type ever needs to map to a drawing deliberately, the place to
do it is `kindFor`, not the term.

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
- **`legacy/` was a temporary reference and is now gone.** Landed in prompt 7 — see
  "Deleting `legacy/`" above. It was never part of the running application; every prompt
  that needed it ported the value it needed into `src/` or into `scripts/seed.ts` (itself
  deleted alongside it) and read the rest with eyes only. Nothing to re-enable; the content
  lives in the database and the code lives in `src/`, permanently.
- **CI seeds a minimal fixture, not real content** (`scripts/ci-fixture.ts`, prompt 7).
  Cache Components requires every `generateStaticParams` to return at least one result, so
  CI's throwaway database needs SOME rows in `projects`/`design_works`/`media` before
  `npm run build` will succeed — but the one thing that used to provide rows,
  `scripts/seed.ts`, is deleted along with its sole data source. The fixture script writes
  one minimal, clearly-fake row per table through the same repositories the app uses. Not a
  gap: it exists to satisfy a build-time constraint, not to stand in for real data anywhere
  a person would see it.

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
