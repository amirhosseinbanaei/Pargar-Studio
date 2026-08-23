/**
 * Language.
 *
 * English and Persian, with everything the switch implies: direction, digits,
 * fonts, and the two typographic rules that Latin and Arabic script do not
 * share.
 *
 * The interface dictionary is small and loads with the page. The Persian
 * *content* layer — 76 project translations, the studio, the works — is
 * ~60KB and loads only when someone actually asks for Persian. Two things
 * follow from that: an English visitor never pays for a language they did not
 * choose, and a missing or broken Persian module degrades to English instead
 * of taking the whole site down with an import error.
 */

import { STRINGS, faDigits } from '../../data/i18n.js';

export const LANGS = ['en', 'fa'];
const KEY = 'kavan.lang';

let lang = 'en';
let fa = null;              // the Persian content layer, once loaded
let loading = null;         // in-flight load, so two clicks share one fetch
const subs = new Set();

/* --------------------------------------------------------------------------
   the Persian content layer
   -------------------------------------------------------------------------- */

function loadFa() {
  if (fa) return Promise.resolve(fa);
  if (loading) return loading;

  loading = Promise.all([
    import('../../data/projects.fa.js'),
    import('../../data/studio.fa.js'),
    import('../../data/works.fa.js'),
  ]).then(([p, s, w]) => {
    fa = {
      projects: p.PROJECTS_FA || {},
      studio: s.STUDIO_FA || {},
      contact: s.CONTACT_FA || {},
      brand: s.BRAND_FA || {},
      nav: s.NAV_FA || [],
      design: w.DESIGN_FA || {},
      media: w.MEDIA_FA || {},
    };
    return fa;
  }).finally(() => { loading = null; });

  return loading;
}

/** Warm the Persian layer without switching to it. */
export const prefetchFa = () => loadFa().catch(() => {});

/* --------------------------------------------------------------------------
   state
   -------------------------------------------------------------------------- */

export const getLang = () => lang;
export const isRTL = () => lang === 'fa';

/** Subscribe to language changes. Returns an unsubscribe function. */
export function onLang(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

/**
 * Switch language. Resolves once the new language is fully in effect, so a
 * caller can re-render knowing the content layer is present.
 */
export async function setLang(next, { silent = false } = {}) {
  if (!LANGS.includes(next) || next === lang) return;

  if (next === 'fa') {
    try {
      await loadFa();
    } catch (err) {
      // Stay in English rather than render half a translation.
      console.error('Persian content failed to load', err);
      return;
    }
  }

  lang = next;
  applyToDocument();
  try { localStorage.setItem(KEY, lang); } catch { /* private mode */ }
  if (!silent) for (const fn of subs) fn(lang);
}

/**
 * Resolve the starting language. Returns a promise because a returning
 * Persian visitor needs their content layer before the first render.
 */
export async function initLang() {
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* private mode */ }
  const navLang = (navigator.language || '').toLowerCase();
  const want = LANGS.includes(saved) ? saved : (/^fa|^pe/.test(navLang) ? 'fa' : 'en');

  if (want === 'fa') {
    try { await loadFa(); lang = 'fa'; } catch { lang = 'en'; }
  }
  applyToDocument();
  return lang;
}

function applyToDocument() {
  const html = document.documentElement;
  html.lang = lang;
  html.dir = isRTL() ? 'rtl' : 'ltr';
  html.classList.toggle('is-fa', isRTL());
}

/* --------------------------------------------------------------------------
   strings
   -------------------------------------------------------------------------- */

/**
 * Look up an interface string. Falls back through Persian -> English -> the
 * key itself, so a gap in the translation degrades to readable English rather
 * than to `studio.founders`.
 */
export function t(key) {
  const table = STRINGS[lang] || STRINGS.en;
  return table?.[key] ?? STRINGS.en?.[key] ?? key;
}

/** Digits, in the numeral system of the current language. */
export const num = (v) => (isRTL() ? faDigits(v) : String(v));

/**
 * Translate one of the fixed vocabularies — project type, status, scale,
 * design category, media kind. Unknown values pass straight through.
 */
export const term = (group, value) => {
  const s = t(`${group}.${value}`);
  return s === `${group}.${value}` ? value : s;
};

/** Join a list with the right separator for the script. */
export const list = (arr) => arr.join(isRTL() ? '، ' : ', ');

/* --------------------------------------------------------------------------
   content overlays
   -------------------------------------------------------------------------- */

/**
 * Merge a record with its Persian overlay. In English — and before the
 * Persian layer has loaded — this is the identity function, so English pays
 * nothing for the feature existing.
 */
const overlay = (bucket) => (rec, key) => {
  if (!isRTL() || !fa || !rec) return rec;
  const tr = fa[bucket][key ?? rec.slug];
  return tr ? { ...rec, ...tr } : rec;
};

export const localiseProject = overlay('projects');
export const localiseDesign = overlay('design');
export const localiseMedia = overlay('media');

const block = (bucket) => (en) => (isRTL() && fa ? { ...en, ...fa[bucket] } : en);

export const studio = block('studio');
export const contact = block('contact');
export const brand = block('brand');

/** Nav labels and captions for the five columns. */
export function nav(en) {
  if (!isRTL() || !fa) return en;
  const byId = new Map(fa.nav.map((x) => [x.id, x]));
  return en.map((x) => ({ ...x, ...(byId.get(x.id) || {}) }));
}

/* --------------------------------------------------------------------------
   script-aware typography
   -------------------------------------------------------------------------- */

/**
 * Whether a string can be split into per-character boxes for the title FLIP.
 *
 * Arabic-script letters JOIN. Wrapping each one in its own inline-block
 * destroys the shaping and renders the word as a row of disconnected
 * presentation forms — legible to nobody. Persian titles therefore fly as a
 * single unit, and the shell asks this before it splits anything.
 */
export const canSplitGlyphs = (s = '') => !/[؀-ۿݐ-ݿ]/.test(s);
