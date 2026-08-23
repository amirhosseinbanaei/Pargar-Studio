/**
 * Panel content.
 *
 * Each section builds its markup once, mounts an inertia scroller, and
 * staggers its children in. Cards reveal themselves as they enter the pane
 * via IntersectionObserver, and their drawings are generated at that moment —
 * so opening Projects costs a dozen drawings, not seventy-six.
 *
 * Three sections carry detail views (Projects, Design, Media). They swap in
 * place inside the main pane rather than routing away, which keeps the rail,
 * the scroller and the shell transition untouched.
 *
 * Every string that reaches the reader goes through `t()`, `term()` or a
 * localised record, so switching language re-renders rather than re-writes.
 */

import { animate, stagger, wait, EASE, reduced } from '../core/anim.js';
import { smoothScroll } from './smooth.js';
import { draw, kindFor, drawingSet, portrait } from '../art/draw.js';
import { PROJECTS, FILTERS, bySlug } from '../../data/projects.js';
import { STUDIO, CONTACT, BRAND } from '../../data/studio.js';
import { DESIGN_WORKS, MEDIA } from '../../data/works.js';
import {
  t, num, term, list, isRTL,
  localiseProject, localiseDesign, localiseMedia,
  studio as localiseStudio, contact as localiseContact, brand as localiseBrand,
} from '../core/i18n.js';

/* --------------------------------------------------------------------------
   helpers
   -------------------------------------------------------------------------- */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/**
 * A stable seed for a person's plate.
 *
 * Always derived from the ENGLISH name, never the displayed one: stripping
 * non-Latin characters from a Persian name leaves nothing, which would hand
 * every member of the studio the same portrait.
 */
const seedOf = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** Latin runs inside Persian keep their own direction. */
const lat = (s) => `<span class="lat">${esc(s)}</span>`;

/** The comma of the current script. Persian uses U+060C, not U+002C. */
const comma = () => (isRTL() ? '، ' : ', ');

const shell = (rail, main, solo) => `
  <div class="panel__rail${solo ? ' u-hide' : ''}">
    <div class="smooth" data-scroll tabindex="-1">
      <div class="smooth__inner">${rail}</div>
    </div>
  </div>
  <div class="panel__main">
    <div class="smooth" data-scroll tabindex="-1">
      <div class="smooth__inner">${main}</div>
      <i class="smooth__track"><i class="smooth__thumb"></i></i>
    </div>
  </div>`;

const state = new WeakMap();

/* Where the rail sits beside the content there is room to leave a group open;
   stacked above it, an expanded group pushes everything below the fold. This
   is evaluated after mount, never baked into the markup — a template string is
   built before layout exists. */
const RAIL_STACKED = '(max-width: 900px)';
const railIsBeside = () => !window.matchMedia(RAIL_STACKED).matches;

function syncRailDefault(panel) {
  if (panel.dataset.railTouched) return;
  const heads = [...panel.querySelectorAll('.fgroup__head')];
  const beside = railIsBeside();
  heads.forEach((h, i) => h.setAttribute('aria-expanded', String(i === 0 && beside)));
}

/** A spec table row. */
const row = (k, v) => (v == null || v === '' ? '' :
  `<div class="spec__row"><span class="spec__k">${esc(k)}</span>
   <span class="spec__v">${v}</span></div>`);

/** The back link that leads out of a detail view. */
const backLink = (label) => `
  <button class="detail__back magnet" type="button" data-back>
    <svg viewBox="0 0 14 8" aria-hidden="true"><path d="M13 4H1M1 4l3.5-3M1 4l3.5 3"/></svg>
    <span>${esc(label)}</span>
  </button>`;

/** The three-plate drawing set at the head of a detail view. */
const plates = (seed, types) => `
  <div class="detail__plates">
    ${drawingSet(seed, types).map((k, i) => `
      <figure class="detail__plate">
        ${draw(k, seed + (i ? ':' + i : ''), 0.75)}
        <figcaption>${esc(t('kindName.' + k) === 'kindName.' + k ? k : t('kindName.' + k))}</figcaption>
      </figure>`).join('')}
  </div>`;

/* --------------------------------------------------------------------------
   a collapsible filter group
   -------------------------------------------------------------------------- */

function fgroup(id, label, options, counts) {
  return `
    <div class="fgroup" data-group="${id}">
      <button class="fgroup__head" type="button" aria-expanded="false" data-toggle="${id}">
        <span>${esc(label)}</span>
        <svg class="fgroup__caret" viewBox="0 0 8 8" aria-hidden="true">
          <line x1="0" y1="4" x2="8" y2="4"/><line x1="4" y1="0" x2="4" y2="8"/>
        </svg>
      </button>
      <div class="fgroup__body">
        <ul class="fgroup__list">
          ${options.map((o) => `
            <li><button class="fopt" type="button" data-g="${id}" data-v="${esc(o.value)}"
                aria-pressed="false">
              <span>${esc(o.label)}</span>
              <span class="fopt__n"${counts ? ` data-count="${id}:${esc(o.value)}"` : ''}
                >${num(o.n ?? 0)}</span>
            </button></li>`).join('')}
        </ul>
      </div>
    </div>`;
}

const clearBtn = () =>
  `<button class="frow-clear magnet" type="button" data-clear>${esc(t('ui.clearAll'))}</button>`;

/* --------------------------------------------------------------------------
   Projects
   -------------------------------------------------------------------------- */

function projectCard(raw) {
  const p = localiseProject(raw);
  return `
    <button class="card magnet" type="button" data-slug="${esc(raw.slug)}"
            data-cursor="${esc(t('ui.view'))}" data-types="${esc(raw.type.join('|'))}"
            data-status="${esc(raw.status)}" data-scale="${esc(raw.scale)}"
            data-year="${raw.year}">
      <span class="card__frame" data-seed="${esc(raw.slug)}"
            data-kind="${esc(kindFor(raw.slug, raw.type))}"></span>
      <span class="card__body">
        <span class="card__title">${esc(p.title)}</span>
        <span class="card__year">${num(raw.year)}</span>
      </span>
      <span class="card__meta">${esc(term('type', raw.type[0]))} — ${esc(term('status', raw.status))}</span>
    </button>`;
}

function projectsHTML() {
  const groups = FILTERS.map((g) => fgroup(
    g.id, t('filter.' + g.id),
    g.options.map((o) => ({
      value: o,
      label: g.id === 'year' ? num(o) : term(g.id, o),
      n: PROJECTS.filter((p) => g.match(p, o)).length,
    })),
    true
  )).join('');

  return shell(
    `<p class="fcount" data-fcount></p>${groups}${clearBtn()}`,
    `<div class="grid" data-grid>${PROJECTS.map(projectCard).join('')}</div>
     <p class="empty u-hide" data-empty>${esc(t('filter.noMatch'))}</p>`
  );
}

function projectDetail(raw) {
  const p = localiseProject(raw);
  return `
    <article class="detail">
      ${backLink(t('ui.allProjects'))}
      <h3 class="detail__title">${esc(p.title)}</h3>
      <p class="detail__blurb">${esc(p.blurb)}</p>
      ${plates(raw.slug, raw.type)}
      <div class="detail__cols">
        <div class="spec">
          ${row(t('spec.type'), esc(list(raw.type.map((x) => term('type', x)))))}
          ${row(t('spec.status'), esc(term('status', raw.status)))}
          ${row(t('spec.scale'), esc(term('scale', raw.scale)))}
          ${row(t('spec.year'), num(raw.year))}
          ${row(t('spec.location'), esc(p.location))}
          ${row(t('spec.area'), num(raw.area))}
          ${row(t('spec.client'), esc(p.client))}
        </div>
        <div class="prose"><p>${esc(p.description)}</p></div>
      </div>
    </article>`;
}

/* --------------------------------------------------------------------------
   Design
   -------------------------------------------------------------------------- */

function designCard(raw) {
  const d = localiseDesign(raw);
  return `
    <button class="card magnet" type="button" data-dslug="${esc(raw.slug)}"
            data-cursor="${esc(t('ui.view'))}" data-cat="${esc(raw.category)}">
      <span class="card__frame" data-seed="${esc(raw.slug)}"
            data-kind="${esc(kindFor(raw.slug, [raw.category]))}"></span>
      <span class="card__body">
        <span class="card__title">${esc(d.title)}</span>
        <span class="card__year">${num(raw.year)}</span>
      </span>
      <span class="card__meta">${esc(term('cat', raw.category))}</span>
      <span class="card__note">${esc(d.blurb)}</span>
    </button>`;
}

function designHTML() {
  const cats = [...new Set(DESIGN_WORKS.map((d) => d.category))];
  return shell(
    `<p class="fcount" data-fcount></p>
     ${fgroup('category', t('filter.category'), cats.map((c) => ({
      value: c, label: term('cat', c),
      n: DESIGN_WORKS.filter((d) => d.category === c).length,
    })))}
     ${clearBtn()}`,
    `<div class="grid" data-grid>${DESIGN_WORKS.map(designCard).join('')}</div>
     <p class="empty u-hide" data-empty>${esc(t('filter.nothing'))}</p>`
  );
}

function designDetail(raw) {
  const d = localiseDesign(raw);
  return `
    <article class="detail">
      ${backLink(t('ui.allWorks'))}
      <h3 class="detail__title">${esc(d.title)}</h3>
      <p class="detail__blurb">${esc(d.blurb)}</p>
      ${plates(raw.slug, [raw.category])}
      <div class="detail__cols">
        <div class="spec">
          ${row(t('filter.category'), esc(term('cat', raw.category)))}
          ${row(t('spec.year'), num(raw.year))}
          ${row(t('spec.status'), esc(d.status))}
          ${row(t('spec.client'), esc(d.client))}
          ${row(t('spec.scope'), esc(d.scope))}
          ${row(t('spec.materials'), esc(d.materials))}
          ${row(t('spec.team'), esc(list(d.team || [])))}
          ${(d.facts || []).map((f) => row(f.k, esc(f.v))).join('')}
        </div>
        <div class="prose">
          ${String(d.description).split(/\n+/).map((x) => `<p>${esc(x)}</p>`).join('')}
        </div>
      </div>
    </article>`;
}

/* --------------------------------------------------------------------------
   Media
   -------------------------------------------------------------------------- */

function mediaCard(raw) {
  const m = localiseMedia(raw);
  // The plate shows the building the piece is about, which ties the entry to
  // the work rather than to the publication.
  const seed = raw.project || raw.slug;
  const proj = raw.project ? bySlug(raw.project) : null;
  return `
    <button class="card magnet" type="button" data-mslug="${esc(raw.slug)}"
            data-cursor="${esc(t('ui.view'))}" data-cat="${esc(raw.type)}">
      <span class="card__frame" data-seed="${esc(seed)}"
            data-kind="${esc(kindFor(seed, proj ? proj.type : []))}"></span>
      <span class="card__body">
        <span class="card__title">${esc(m.title)}</span>
        <span class="card__year">${num(raw.year)}</span>
      </span>
      <span class="card__meta">${lat(m.outlet)} — ${esc(term('kind', raw.type))}</span>
      <span class="card__note">${esc(m.blurb)}</span>
    </button>`;
}

function mediaHTML() {
  const kinds = [...new Set(MEDIA.map((m) => m.type))];
  return shell(
    `<p class="fcount" data-fcount></p>
     ${fgroup('type', t('filter.kind'), kinds.map((c) => ({
      value: c, label: term('kind', c),
      n: MEDIA.filter((m) => m.type === c).length,
    })))}
     ${clearBtn()}`,
    `<div class="grid" data-grid>${MEDIA.map(mediaCard).join('')}</div>
     <p class="empty u-hide" data-empty>${esc(t('filter.nothing'))}</p>`
  );
}

function mediaDetail(raw) {
  const m = localiseMedia(raw);
  const proj = raw.project ? bySlug(raw.project) : null;
  const lp = proj ? localiseProject(proj) : null;
  const seed = raw.project || raw.slug;
  return `
    <article class="detail">
      ${backLink(t('ui.allMedia'))}
      <p class="detail__eyebrow">${lat(m.outlet)} · ${esc(term('kind', raw.type))} · ${num(raw.year)}</p>
      <h3 class="detail__title">${esc(m.title)}</h3>

      <blockquote class="quote">
        <p class="quote__t">${esc(m.excerpt)}</p>
        ${m.author ? `<footer class="quote__a">${esc(m.author)}, ${lat(m.outlet)}</footer>` : ''}
      </blockquote>

      ${plates(seed, proj ? proj.type : [])}

      <div class="detail__cols">
        <div class="spec">
          ${row(t('spec.outlet'), lat(m.outlet))}
          ${row(t('spec.year'), num(raw.year))}
          ${row(t('filter.kind'), esc(term('kind', raw.type)))}
          ${row(t('spec.author'), m.author ? esc(m.author) : '')}
          ${(m.facts || []).map((f) => row(f.k, esc(f.v))).join('')}
        </div>
        <div>
          <h4 class="sheet__h sheet__h--flush">${esc(t('media.note'))}</h4>
          <div class="prose"><p>${esc(m.context)}</p></div>
          ${lp ? `
            <h4 class="sheet__h">${esc(t('media.related'))}</h4>
            <button class="relate magnet" type="button" data-goproject="${esc(proj.slug)}">
              <span class="relate__f">${draw(kindFor(proj.slug, proj.type), proj.slug, 0.62)}</span>
              <span class="relate__b">
                <span class="relate__t">${esc(lp.title)}</span>
                <span class="relate__m">${esc(term('type', proj.type[0]))} — ${num(proj.year)}</span>
              </span>
            </button>` : ''}
        </div>
      </div>
    </article>`;
}

/* --------------------------------------------------------------------------
   Studio
   -------------------------------------------------------------------------- */

const STUDIO_SECTIONS = [
  ['practice', 'studio.practice'],
  ['founders', 'studio.founders'],
  ['numbers', 'studio.numbers'],
  ['history', 'studio.history'],
  ['awards', 'studio.awards'],
  ['people', 'studio.people'],
  ['previously', 'studio.previously'],
];

function studioHTML() {
  const S = localiseStudio(STUDIO);
  const B = localiseBrand(BRAND);

  const jump = `
    <nav class="jump" aria-label="${esc(t('studio.practice'))}">
      ${STUDIO_SECTIONS.map(([id, key], i) => `
        <button class="jump__b magnet" type="button" data-jump="${id}"
                ${i === 0 ? 'aria-current="true"' : ''}>
          <span class="jump__n">${num(String(i + 1).padStart(2, '0'))}</span>
          <span class="jump__t">${esc(t(key))}</span>
        </button>`).join('')}
    </nav>`;

  const body = `
    <div class="sheet">

      <section class="band" id="s-practice" data-sec="practice">
        <div class="band__art">${draw('elevation', 'kavan-studio-house', 0.42)}</div>
        <div class="band__cap">
          <span class="band__k">${esc(B.city)}</span>
          <span class="band__v">${esc(B.name)}</span>
        </div>
      </section>

      <div class="split">
        <p class="sheet__lead">${esc(S.manifesto)}</p>
        <aside class="side">
          <h4 class="side__h">${esc(t('studio.name'))}</h4>
          <p class="side__p">${esc(B.meaning)}</p>
          <h4 class="side__h">${esc(t('studio.numbers'))}</h4>
          <dl class="side__stats">
            ${S.stats.map((x) => `
              <div><dt>${esc(x.label)}</dt><dd>${num(x.value)}</dd></div>`).join('')}
          </dl>
        </aside>
      </div>

      <h4 class="sheet__h" id="s-founders" data-sec="founders">${esc(t('studio.founders'))}</h4>
      <div class="duo">
        ${S.founders.map((f, i) => `
          <div class="person">
            <span class="person__plate">${portrait(seedOf(STUDIO.founders[i].name), 0.82)}</span>
            <p class="person__name">${esc(f.name)}</p>
            <p class="person__role">${esc(f.role)}</p>
            <p class="person__born">${esc(f.born)}</p>
            <p class="person__bio">${esc(f.bio)}</p>
          </div>`).join('')}
      </div>

      <h4 class="sheet__h" id="s-numbers" data-sec="numbers">${esc(t('studio.numbers'))}</h4>
      <div class="stats">
        ${S.stats.map((x) => `
          <div class="stat"><p class="stat__v">${num(x.value)}</p>
          <p class="stat__k">${esc(x.label)}</p></div>`).join('')}
      </div>

      <h4 class="sheet__h" id="s-history" data-sec="history">${esc(t('studio.history'))}</h4>
      <div class="timeline">
        ${S.chapters.map((c) => `
          <div class="tl__row"><span class="tl__y">${num(c.year)}</span>
          <span class="tl__t">${esc(c.text)}</span></div>`).join('')}
      </div>

      <h4 class="sheet__h" id="s-awards" data-sec="awards">${esc(t('studio.awards'))}</h4>
      <div class="rows">
        ${S.awards.map((a) => `
          <div class="row">
            <span class="row__y">${num(a.year)}</span>
            <span><span class="row__t">${esc(a.title)}</span><br>
              <span class="row__b">${esc(a.project)}</span></span>
            <span class="row__o">${esc(a.body)}</span>
            <span class="row__k">${esc(term('kind', 'Award'))}</span>
          </div>`).join('')}
      </div>

      <h4 class="sheet__h" id="s-people" data-sec="people">${esc(t('studio.people'))} — ${num(S.team.length)}</h4>
      <div class="folk">
        ${S.team.map((p, i) => `
          <figure class="folk__x">
            <span class="folk__plate">${portrait(seedOf(STUDIO.team[i]), 1.12)}</span>
            <figcaption class="folk__n">${esc(p)}</figcaption>
          </figure>`).join('')}
      </div>

      <h4 class="sheet__h" id="s-previously" data-sec="previously">${esc(t('studio.previously'))} — ${num(S.alumni.length)}</h4>
      <ul class="names">${S.alumni.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>

    </div>`;

  return shell(jump, body);
}

/* --------------------------------------------------------------------------
   Contact
   -------------------------------------------------------------------------- */

function contactHTML() {
  const c = localiseContact(CONTACT);
  const B = localiseBrand(BRAND);

  return shell('', `
    <div class="sheet">

      <section class="band band--tall">
        <div class="band__art">${draw('elevation', 'kavan-dezashib-street', 0.4)}</div>
        <div class="band__cap">
          <span class="band__k">${esc(c.district)}</span>
          <span class="band__v">${esc(B.name)}</span>
        </div>
      </section>

      <div class="cgrid">
        <div>
          <div class="cblock">
            <p class="cblock__k">${esc(t('contact.address'))}</p>
            <p class="cblock__v">${esc(c.address)}<br>${esc(c.city)}${comma()}${esc(c.country)}<br>
              <span style="color:var(--t-lo)">${num(CONTACT.postcode)}</span></p>
          </div>
          <div class="cblock">
            <p class="cblock__k">${esc(t('contact.telephone'))}</p>
            <p class="cblock__v"><a class="magnet" href="tel:${esc(CONTACT.phoneHref)}">${lat(CONTACT.phone)}</a></p>
          </div>
        </div>

        <div>
          <div class="cblock">
            <p class="cblock__k">${esc(t('contact.email'))}</p>
            <p class="cblock__v"><a class="magnet" href="mailto:${esc(CONTACT.email)}">${lat(CONTACT.email)}</a></p>
            <p class="cblock__v cblock__v--sm"><a class="magnet" href="mailto:${esc(CONTACT.press)}">${lat(CONTACT.press)}</a>
              <span style="color:var(--t-xlo)"> · ${esc(t('contact.press'))}</span></p>
          </div>
          <div class="cblock">
            <p class="cblock__k">${esc(t('contact.hours'))}</p>
            <p class="cblock__v cblock__v--sm">${esc(c.hours)}</p>
          </div>
        </div>

        <div>
          <div class="cblock">
            <p class="cblock__k">${esc(t('contact.elsewhere'))}</p>
            <div class="socials">
              ${c.socials.map((s, i) => `<a class="magnet" href="#" data-cursor="${esc(t('ui.open'))}"
                >${esc(s.name)} ${lat(CONTACT.socials[i].handle)}</a>`).join('')}
            </div>
          </div>
          <div class="cblock">
            <p class="cblock__k">${esc(t('contact.careers'))}</p>
            <p class="cblock__v cblock__v--sm">${esc(c.careers)}</p>
          </div>
        </div>
      </div>

      <h4 class="sheet__h">${esc(t('contact.findUs'))}</h4>
      <div class="cmapwrap">
        <div class="cmap">
          ${draw('court', 'kavan-dezashib-site', 0.62)}
          <i class="cmap__pin"></i>
          <span class="cmap__note">${esc(c.district)} — ${lat(CONTACT.coordinates.lat.toFixed(4) + ', ' + CONTACT.coordinates.lng.toFixed(4))}</span>
        </div>
        <div class="cmap__aside">
          <p class="prose"><p>${esc(c.address)}${comma()}${esc(c.city)}.</p></p>
        </div>
      </div>

    </div>`, true);
}

/* --------------------------------------------------------------------------
   builders
   -------------------------------------------------------------------------- */

const BUILD = {
  projects: projectsHTML,
  design: designHTML,
  media: mediaHTML,
  studio: studioHTML,
  contact: contactHTML,
};

/* --------------------------------------------------------------------------
   mount / unmount
   -------------------------------------------------------------------------- */

export async function mountPanel(id, panel) {
  const build = BUILD[id];
  if (!build) return;

  panel.innerHTML = build();
  panel.hidden = false;
  panel.classList.toggle('panel--solo', id === 'contact');

  const scrollers = [...panel.querySelectorAll('[data-scroll]')].map((h) => smoothScroll(h));
  const io = makeCardObserver(panel);

  const st = { scrollers, io, id, filters: {}, detail: null, saved: null };
  state.set(panel, st);

  syncRailDefault(panel);
  st.mq = window.matchMedia(RAIL_STACKED);
  st.onBreak = () => { syncRailDefault(panel); st.scrollers[0]?.measure(); };
  st.mq.addEventListener('change', st.onBreak);

  wireFilters(panel, st);
  wireDetail(panel, st);
  wireJump(panel, st);

  panel.style.opacity = '1';
  panel.classList.add('is-live');

  const targets = [
    ...panel.querySelectorAll('.panel__rail .fgroup, .panel__rail .fcount, .frow-clear'),
    ...panel.querySelectorAll('.jump__b'),
    ...panel.querySelectorAll('.sheet > *'),
  ];
  const cards = [...panel.querySelectorAll('.card')].slice(0, 12);

  // `backwards` and never `forwards`: the fill holds the start value during
  // the stagger delay, then hands the element back to plain CSS. A cancelled
  // or throttled entrance therefore leaves content visible, not blank.
  await Promise.all([
    stagger(targets, [{ opacity: 0, transform: 'translate3d(0,14px,0)' },
                      { opacity: 1, transform: 'none' }],
      { duration: 700, step: 30, easing: EASE.expo, fill: 'backwards' }),
    stagger(cards, [{ opacity: 0, transform: 'translate3d(0,20px,0)' },
                    { opacity: 1, transform: 'none' }],
      { duration: 780, step: 42, easing: EASE.expo, delay: 60, fill: 'backwards' }),
  ]);

  scrollers.forEach((s) => s?.measure());
}

export async function unmountPanel(panel) {
  const st = state.get(panel);
  if (!st) { panel.hidden = true; return; }

  await animate(panel, [{ opacity: 1 }, { opacity: 0 }],
    { duration: 260, easing: EASE.out })?.done;

  st.scrollers.forEach((s) => s?.destroy());
  st.io?.disconnect();
  st.secIO?.disconnect();
  st.mq?.removeEventListener('change', st.onBreak);
  state.delete(panel);

  panel.classList.remove('is-live');
  panel.innerHTML = '';
  panel.hidden = true;
  panel.style.opacity = '0';
  delete panel.dataset.railTouched;
}

/* --------------------------------------------------------------------------
   card drawings, revealed on entry
   -------------------------------------------------------------------------- */

const EAGER = 12;

function paint(frame) {
  const { seed, kind } = frame.dataset;
  if (seed && !frame.firstChild) frame.innerHTML = draw(kind || 'elevation', seed, 0.75);
  frame.closest('.card')?.classList.add('is-in');
}

function makeCardObserver(panel) {
  const frames = [...panel.querySelectorAll('.card__frame')];
  frames.slice(0, EAGER).forEach(paint);

  const rest = frames.slice(EAGER);
  if (!rest.length) return null;

  if (document.hidden || !('IntersectionObserver' in window)) {
    rest.forEach(paint);
    return null;
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      paint(e.target);
    }
  }, { root: panel.querySelector('.panel__main .smooth') || null,
       rootMargin: '300px 0px', threshold: 0.01 });

  rest.forEach((f) => io.observe(f));
  return io;
}

/* --------------------------------------------------------------------------
   filtering
   -------------------------------------------------------------------------- */

function wireFilters(panel, st) {
  const rail = panel.querySelector('.panel__rail');
  if (!rail || !panel.querySelector('[data-grid]')) return;

  rail.addEventListener('click', (e) => {
    const head = e.target.closest('[data-toggle]');
    if (head) {
      // From here on the visitor owns which groups are open.
      panel.dataset.railTouched = '1';
      head.setAttribute('aria-expanded',
        head.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
      queueMicrotask(() => st.scrollers[0]?.measure());
      return;
    }

    if (e.target.closest('[data-clear]')) {
      st.filters = {};
      rail.querySelectorAll('.fopt').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      applyFilters(panel, st);
      return;
    }

    const opt = e.target.closest('.fopt');
    if (!opt) return;
    const { g, v } = opt.dataset;
    const on = opt.getAttribute('aria-pressed') === 'true';
    rail.querySelectorAll(`.fopt[data-g="${g}"]`)
      .forEach((b) => b.setAttribute('aria-pressed', 'false'));
    if (on) delete st.filters[g];
    else { st.filters[g] = v; opt.setAttribute('aria-pressed', 'true'); }
    applyFilters(panel, st);
  });

  applyFilters(panel, st);
}

function matches(card, filters, id) {
  for (const [g, v] of Object.entries(filters)) {
    if (id === 'projects') {
      if (g === 'type' && !card.dataset.types.split('|').includes(v)) return false;
      if (g === 'status' && card.dataset.status !== v) return false;
      if (g === 'scale' && card.dataset.scale !== v) return false;
      if (g === 'year' && card.dataset.year !== v) return false;
    } else if (card.dataset.cat !== v) return false;
  }
  return true;
}

const COUNT_KEY = { projects: 'ui.projectsCount', design: 'ui.worksCount', media: 'ui.entriesCount' };

function applyFilters(panel, st) {
  const cards = [...panel.querySelectorAll('[data-grid] .card')];
  let shown = 0;
  const appearing = [];

  for (const c of cards) {
    const ok = matches(c, st.filters, st.id);
    const wasOut = c.classList.contains('is-out');
    c.classList.toggle('is-out', !ok);
    if (ok) { shown++; if (wasOut) appearing.push(c); }
  }

  panel.querySelector('[data-empty]')?.classList.toggle('u-hide', shown > 0);

  const count = panel.querySelector('[data-fcount]');
  if (count) {
    const key = COUNT_KEY[st.id] || 'ui.projectsCount';
    const label = t(key) === key ? '' : t(key);
    count.textContent = `${num(shown)} ${label}`.trim();
  }

  if (st.id === 'projects') {
    panel.querySelectorAll('[data-count]').forEach((el) => {
      const [g, v] = el.dataset.count.split(':');
      const rest = { ...st.filters };
      delete rest[g];
      el.textContent = num(cards.filter((c) => matches(c, rest, st.id) &&
        matches(c, { [g]: v }, st.id)).length);
    });
  }

  if (appearing.length && !reduced()) {
    stagger(appearing.slice(0, 20),
      [{ opacity: 0, transform: 'translate3d(0,12px,0)' }, { opacity: 1, transform: 'none' }],
      { duration: 560, step: 24, easing: EASE.expo });
  }

  st.scrollers.forEach((s) => s?.measure());
}

/* --------------------------------------------------------------------------
   detail views — Projects, Design, Media
   -------------------------------------------------------------------------- */

const DETAIL = {
  slug:  { find: bySlug, view: projectDetail },
  dslug: { find: (s) => DESIGN_WORKS.find((d) => d.slug === s), view: designDetail },
  mslug: { find: (s) => MEDIA.find((m) => m.slug === s), view: mediaDetail },
};

function wireDetail(panel, st) {
  const main = panel.querySelector('.panel__main .smooth__inner');
  if (!main) return;
  const scroller = st.scrollers[st.scrollers.length - 1];

  panel.addEventListener('click', async (e) => {
    const card = e.target.closest('.card[data-slug], .card[data-dslug], .card[data-mslug]');
    if (card) {
      for (const key of Object.keys(DETAIL)) {
        const value = card.dataset[key];
        if (!value) continue;
        const rec = DETAIL[key].find(value);
        if (!rec) return;
        if (!st.saved) st.saved = main.innerHTML;
        st.detail = value;
        await swap(main, DETAIL[key].view(rec), scroller);
        return;
      }
      return;
    }

    // A media entry can send you to the building it is about.
    const go = e.target.closest('[data-goproject]');
    if (go) {
      const rec = bySlug(go.dataset.goproject);
      if (rec) await swap(main, projectDetail(rec), scroller);
      return;
    }

    if (e.target.closest('[data-back]') && st.saved) {
      const saved = st.saved;
      st.saved = null;
      st.detail = null;
      await swap(main, saved, scroller);
      st.io?.disconnect();
      st.io = makeCardObserver(panel);
      applyFilters(panel, st);
    }
  });
}

async function swap(host, html, scroller) {
  await animate(host, [{ opacity: 1, transform: 'none' },
                       { opacity: 0, transform: 'translate3d(0,-10px,0)' }],
    { duration: 220, easing: EASE.out })?.done;

  host.innerHTML = html;
  scroller?.reset();
  scroller?.measure();

  const kids = [...host.querySelectorAll('.detail > *, .grid, .rows')];
  await stagger(kids.length ? kids : [host],
    [{ opacity: 0, transform: 'translate3d(0,16px,0)' }, { opacity: 1, transform: 'none' }],
    { duration: 640, step: 40, easing: EASE.expo });
  host.style.opacity = '1';
  host.style.transform = 'none';
  await wait(0);
}

/* --------------------------------------------------------------------------
   the Studio rail — an index of the page, not a filter
   -------------------------------------------------------------------------- */

function wireJump(panel, st) {
  const nav = panel.querySelector('.jump');
  if (!nav) return;
  const scroller = st.scrollers[st.scrollers.length - 1];
  const host = panel.querySelector('.panel__main .smooth');
  const inner = panel.querySelector('.panel__main .smooth__inner');

  nav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-jump]');
    if (!b) return;
    const target = panel.querySelector(`[data-sec="${b.dataset.jump}"]`);
    if (!target || !scroller) return;
    const top = target.getBoundingClientRect().top - inner.getBoundingClientRect().top;
    scroller.scrollTo(Math.max(0, top - 12));
  });

  // Mark the section you are actually looking at.
  const secs = [...panel.querySelectorAll('[data-sec]')];
  if (!secs.length || document.hidden || !('IntersectionObserver' in window)) return;

  st.secIO = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const id = en.target.dataset.sec;
      nav.querySelectorAll('[data-jump]').forEach((b) => {
        if (b.dataset.jump === id) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      });
    }
  }, { root: host, rootMargin: '0px 0px -70% 0px', threshold: 0 });

  secs.forEach((s) => st.secIO.observe(s));
}
