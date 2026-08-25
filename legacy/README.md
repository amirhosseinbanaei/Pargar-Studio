# Kavan Studio

An architecture-studio site built as an upgraded reinterpretation of
[pargar.studio](https://pargar.studio) — same DNA, roughly a third of it
deliberately changed, and rebuilt from scratch on a faster foundation.

**Zero dependencies. Zero image files. Zero network requests after the HTML.**

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. There is no build step — the source *is* the
site.

---

## What it is

Five full-height columns between six hairline rules. Pick one and it takes the
stage: its siblings collapse, its title flies to the corner, and its content
mounts behind a sweeping hairline.

- **Projects** — 76 records, filterable by type / status / scale / year, each
  with a detail view
- **Design** — 9 works, each with a detail view: drawing set, scope, materials,
  team, and a two-paragraph account of the problem and the making
- **Media** — 14 entries, each with a detail view built around the excerpt,
  the studio's own note on the piece, and a link through to the building
- **Studio** — an index rail beside a hero band, manifesto, founders, numbers,
  history, awards, and the twenty-two people
- **Contact** — hero band, a three-column detail grid, and a drawn site plan
  instead of an embedded map

Everything reads in **English or Persian**, including all 76 projects.

---

## The two things worth knowing

### 1. Every image is drawn at runtime

There are no photographs, no `.jpg`, no `.svg` files, no CDN. `js/art/draw.js`
contains eight procedural generators — **elevation, massing, courtyard,
section, plan, jali screen, site contour** and **portrait** — that emit SVG
from a string seed. A project's slug is its seed, so its drawing is unique, and
identical on every machine and every reload, forever.

They are drawn to read like **photographs of buildings, not blueprints**: sky
behind the mass, foliage at the base, glass carrying the sky back, a shadow
side, and a few windows lit warm from inside. Colour comes from
`js/art/palette.js` — six facade materials (brick red, buff brick, concrete,
travertine, timber, stone), five skies, and a foliage range, sampled from the
reference site's own photography and seeded identically to the geometry.

The cost of the entire visual identity is about 16KB of generator code. Cards
draw themselves as they scroll into view, so opening Projects renders a dozen
drawings, not seventy-six.

### 2. Persian is a different typographic system, not a string swap

Two rules Latin and Arabic script do not share, and both break things
silently if you ignore them:

**Letters join.** The signature transition FLIPs the column title one glyph at
a time — that is what lets the tracking collapse ride on transforms instead of
on `letter-spacing`. Splitting a Persian word into per-character boxes destroys
the shaping and renders it as disconnected presentation forms. So the FLIP
target is always `.ch`; in English that is one box per letter, in Persian it is
a single box holding the whole word. Same code path, same animation.

**Tracking is wrong.** The wide letter-spacing that gives the English wordmark
its character severs those joins. Every tracking token collapses to zero under
`html.is-fa`, and the type scale steps up slightly, because Persian needs more
leading and reads small at the same nominal size.

Beyond that: `dir="rtl"` reverses the five columns so Projects sits under the
reader's first glance; digits become Persian numerals; the mark stepper mirrors
so the dot that grows matches what the reader sees; and Latin runs inside
Persian — emails, outlet names, coordinates — are isolated so they do not
scramble at a line boundary.

The interface dictionary ships with the page. The Persian **content** layer —
76 project translations, the studio, the works — is ~60KB and loads only when
someone asks for Persian, prefetched on idle. An English visitor never pays
for a language they did not choose, and a missing Persian module degrades to
English instead of taking the site down with an import error.

### 3. Nothing animates a layout property

The reference animates `top`, `left`, `width`, `height` and `letter-spacing`
on every frame of its signature transition, which forces layout ~60×/second.

Here the layout change is **instantaneous** — a class flips and CSS puts
everything in its final place in one frame. What the eye follows is a FLIP
played back per glyph: every character of the title is measured before and
after, then flown from where it was to where it now is with a stagger. The
tracking collapse you see is per-character `transform`, never `letter-spacing`.

Only `transform`, `opacity` and `clip-path` are ever animated.

---

## Architecture

```
index.html          the whole five-column shell, static — renders with no JS
css/
  tokens.css        design tokens: surfaces, text ramp, accent, motion curves
  base.css          reset and primitives
  shell.css         the five columns, masthead, marks, wipe
  panel.css         expanded panel, filters, cards, detail, editorial sheets
  chrome.css        preloader, cursor, inertia-scroll host
js/
  main.js           boot, hash routing, language switch, the Tehran clock
  core/anim.js      the motion core — easings, one shared rAF, WAAPI, FLIP
  core/i18n.js      language state, RTL, digits, on-demand Persian loading
  art/rng.js        seeded PRNG (FNV-1a + mulberry32)
  art/palette.js    materials, skies, foliage + colour mixing
  art/draw.js       the eight drawing generators
  ui/shell.js       the signature open/close transition
  ui/panel.js       per-section content, filtering, project detail
  ui/cursor.js      magnetic spring cursor
  ui/smooth.js      inertia scrolling
  ui/preload.js     preloader and opening reveal
data/
  projects.js       76 projects + the derived filter taxonomy
  studio.js         founders, manifesto, team, awards, contact
  works.js          9 design works + 14 media entries, with detail fields
  i18n.js           the interface dictionary, English and Persian
  projects.fa.js    all 76 projects in Persian   ┐
  studio.fa.js      the studio and contact in Persian │ loaded on demand
  works.fa.js       design and media in Persian       ┘
```

### Rules the code follows

**CSS owns every resting state.** Animations default to `fill: 'backwards'`,
never `forwards`. A forwards-filled animation keeps overriding the cascade
after it ends, so a value pinned by one transition silently wins against the
CSS describing the next one — that is how a closed panel's leftovers reappear
on the following open.

**Await `anim.done`, never `anim.finished`.** A hidden document stops advancing
its animation timeline, so an animation started just before a tab switch never
resolves. `done` races the real promise against the animation's own worst case,
so a transition state machine can never be stranded mid-flight.

**One rAF.** The cursor, the inertia scrollers and any parallax all subscribe
to a single ticker in `core/anim.js`. N competing rAF loops is the most common
source of jitter in sites like this. Damping is frame-rate independent, so the
feel is identical at 60Hz and 120Hz.

**The site works before the JS does.** The five-column shell is in the HTML and
styled by CSS. An inline script adds `is-intro` to mask the pieces the reveal
animates; removing that one class is all it takes to show the finished page, and
a hard 2.6s deadline plus a `visibilitychange` handler guarantee it comes off.
No JavaScript at all still gives you the whole shell.

---

## Performance

| | |
|---|---|
| Requests after HTML | 6 CSS + 13 JS modules, all local |
| Image bytes | **0** |
| Webfont bytes | **0** — geometric system stack, so no FOIT and no CLS |
| JS, uncompressed | ~115KB English; the ~60KB Persian layer loads only on request |
| Animated properties | `transform`, `opacity`, `clip-path` only |

Offscreen cards use `content-visibility: auto` with
`contain-intrinsic-size`, so 76 cards cost about as much as the dozen on
screen. `will-change` is applied for the duration of an animation and removed
after — a permanent hint holds a compositor layer forever.

---

## Accessibility

- Full keyboard model: arrows move between columns, Enter opens, Esc closes
- Inactive columns get `inert` while a panel is open
- Focus drives the same artwork and caption reveals as hover
- Focused elements are scrolled into view inside the inertia panes
- `aria-live` announcements on section change; skip link to the navigation
- `prefers-reduced-motion` collapses every duration to a single frame and
  removes the custom cursor entirely
- Deep links (`#projects`) work, and back/forward drive the shell rather than
  reloading the document; the document title tracks the state however you
  arrived at it
- `lang` and `dir` are set before first paint, so a Persian visitor never
  watches the layout flip after the fact

---

## How it differs from the reference

| pargar.studio | Kavan |
|---|---|
| jQuery + Bootstrap + anime.js + TweenMax + Owl + Fancybox + mixitup | zero dependencies |
| photographs | eight procedural drawing generators, in full colour |
| animates `top`/`left`/`width`/`height`/`letter-spacing` | transform / opacity / clip-path only |
| `letter-spacing` tween | per-glyph FLIP |
| `location.replace()` on popstate — reloads the document | History API, no reload |
| header dots stay decorative | dots compress into a section stepper |
| no keyboard model, no reduced-motion, no focus states | all three |
| native scrolling | inertia scrolling with a custom thumb |
| "About Us" | "Studio", with an index rail and a hero band |
| EN/FA toggle on some pages | full bilingual site, including all 76 projects |
| Design and Media are flat lists | every work and every press entry has a detail page |
| Futura (webfont) | geometric system stack, zero bytes |
| warm gold `#988344` on `#1E1916` | champagne `#e3cfa3` on `#0c0b0a` |
| photographic colour inside a dark shell | same — generated colour inside a dark shell |

Content, identity, founders, projects and copy are entirely original — this
shares the reference's structure and spirit, not its material.
