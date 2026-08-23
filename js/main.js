/**
 * KAVAN STUDIO — boot.
 *
 * Order matters here: the shell is already in the HTML and styled, so the page
 * is legible before this file runs at all. Everything below is enhancement.
 */

import { createShell } from './ui/shell.js';
import { initCursor } from './ui/cursor.js';
import { runPreload, revealShell, endIntro } from './ui/preload.js';
import { NAV } from '../data/studio.js';
import { initLang, setLang, onLang, getLang, prefetchFa, isRTL, t, num } from './core/i18n.js';

const VALID = new Set(NAV.map((n) => n.id));

/* --------------------------------------------------------------------------
   routing — hash based, so the site works from file:// and any static host
   -------------------------------------------------------------------------- */

const readHash = () => {
  const h = location.hash.replace(/^#\/?/, '').split('/')[0];
  return VALID.has(h) ? h : null;
};

const pageTitle = (id) => (id
  ? `${t('nav.' + id)} — ${t('brand.name')}`
  : `${t('brand.name')} — ${t('brand.tagline')}${isRTL() ? '، ' : ', '}${t('ui.tehran')}`);

/* --------------------------------------------------------------------------
   static chrome — the strings that live in index.html rather than in a panel
   -------------------------------------------------------------------------- */

function applyChrome() {
  const set = (sel, s) => { const el = document.querySelector(sel); if (el) el.textContent = s; };

  set('.wordmark span', t('brand.name'));
  set('#closer span', t('ui.close'));
  set('.preload__sub', `${t('brand.tagline')} — ${t('ui.tehran')}`);
  set('.u-skip', t('ui.skip'));
  set('.footbar__set:first-child > span:first-child', t('ui.tehran'));

  const wide = document.querySelector('.footbar__set--wide');
  if (wide) {
    wide.innerHTML = '';
    for (const s of [`${t('ui.est')} ${num(2007)}`, `${num(76)} ${t('ui.projectsCount')}`]) {
      const el = document.createElement('span');
      el.textContent = s;
      wide.append(el);
    }
  }

  document.querySelectorAll('.lang__b').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.lang === getLang()));
  });

  document.title = pageTitle(readHash());
}

function wireLangSwitch(shell, cursor) {
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('.lang__b');
    if (!b) return;
    e.preventDefault();
    b.disabled = true;
    setLang(b.dataset.lang).finally(() => { b.disabled = false; });
  });

  onLang(async () => {
    applyChrome();
    startClock();               // the clock formatter is locale-dependent
    await shell.relang();
    cursor?.refresh?.();
  });
}

/* --------------------------------------------------------------------------
   boot
   -------------------------------------------------------------------------- */

async function boot() {
  await initLang();

  const live = document.getElementById('live');
  const cursor = initCursor();

  const shell = createShell({
    cursor,
    live,
    onChange({ id, push }) {
      // The title reflects where you are, whether you arrived by clicking,
      // by deep link, or by pressing Back. Only a deliberate navigation
      // writes a new history entry.
      document.title = pageTitle(id);
      if (!push) return;
      const url = id ? `#${id}` : location.pathname + location.search;
      history.pushState({ id: id ?? null }, '', url);
    },
  });

  applyChrome();
  wireLangSwitch(shell, cursor);

  // Back/forward drive the shell rather than reloading the page — the
  // reference site called location.replace() here, which threw away the
  // whole document on every step.
  addEventListener('popstate', () => {
    const id = readHash();
    if (id && id !== shell.openId) shell.open(id, { push: false });
    else if (!id && shell.openId) shell.close({ push: false });
  });

  startClock();
  shell.warmArt();

  // Warm the Persian layer once the page is idle, so the switch is instant
  // for anyone who reaches for it — without costing anything up front.
  if (getLang() === 'en') {
    if ('requestIdleCallback' in window) requestIdleCallback(() => prefetchFa(), { timeout: 6000 });
    else setTimeout(prefetchFa, 3000);
  }

  // Hard deadline. Whatever the intro is doing — throttled in a background
  // tab, blocked on a stylesheet, or simply broken — the site is on screen
  // within 2.6s of boot. endIntro() is idempotent.
  const deadline = setTimeout(endIntro, 2600);

  // Someone who tabs away mid-intro should come back to a finished page, not
  // a paused one; WAAPI stops advancing while the document is hidden.
  const onHide = () => { if (document.hidden) endIntro(); };
  document.addEventListener('visibilitychange', onHide);

  runPreload()
    .then(() => revealShell())
    .then(() => {
      const id = readHash();
      if (id) return shell.open(id, { push: false });
    })
    .catch((err) => { console.error(err); })
    .finally(() => {
      clearTimeout(deadline);
      endIntro();
      document.removeEventListener('visibilitychange', onHide);
    });
}

/* --------------------------------------------------------------------------
   Tehran clock in the footer — UTC+03:30
   -------------------------------------------------------------------------- */

let clockTimer = 0;

function startClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  clearInterval(clockTimer);
  const fmt = new Intl.DateTimeFormat(getLang() === 'fa' ? 'fa-IR' : 'en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tehran',
    numberingSystem: getLang() === 'fa' ? 'arabext' : 'latn',
  });
  const tick = () => { el.textContent = `${fmt.format(new Date())} ${t('ui.irst')}`; };
  tick();
  clockTimer = setInterval(tick, 30_000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
