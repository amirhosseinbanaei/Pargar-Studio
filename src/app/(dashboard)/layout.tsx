// src/app/(dashboard)/layout.tsx
/**
 * THE DASHBOARD'S ROOT LAYOUT — the app's second one, and deliberately so.
 *
 * ─── WHY IT IS OUTSIDE `[locale]` ─────────────────────────────────────────────────
 * The public site is bilingual and the locale is a URL segment, so `app/[locale]/layout.tsx`
 * is the root layout for everything under it. The dashboard is not part of that: it is an
 * admin tool with ONE interface language, and putting it under `[locale]` would create
 * `/en/dashboard` and `/fa/dashboard` — two URLs, two caches and two sets of chrome for one
 * tool that has exactly one user.
 *
 * A top-level route group with no `app/layout.tsx` above it is how the App Router spells
 * "two independent document trees", which is precisely what these are. `src/proxy.ts` gates
 * `/dashboard` before its locale leg ever runs, so nothing here is ever locale-prefixed.
 *
 * ─── THE INTERFACE LANGUAGE IS ENGLISH ────────────────────────────────────────────
 * Resolved in prompt 6 and recorded in AGENTS.md. Every field label in this tool maps
 * directly onto a database column name — `titleEn`, `sortOrder`, `projects` — and onto the
 * vocabulary AGENTS.md uses, which is what keeps the tool debuggable when something goes
 * wrong and somebody has to describe it. Persian was the alternative and is defensible, but
 * it would need the full RTL treatment from `legacy/css/i18n.css` applied to the dashboard
 * chrome, and the CONTENT is bilingual regardless — the Persian field is right there beside
 * the English one on every form.
 *
 * `dir="ltr"` therefore, and no `is-fa` class. The Persian INPUTS carry their own `dir` and
 * `lang` (`LocaleFieldPair`), which is the correct scope for it.
 *
 * ─── WHAT IT DOES NOT IMPORT ──────────────────────────────────────────────────────
 * None of the five ported stylesheets. `shell.css` and `panel.css` describe a five-column
 * editorial index and `i18n.css` describes a Persian document; the dashboard is neither, and
 * AGENTS.md already reserves Tailwind utilities for exactly this surface. `globals.css` IS
 * imported, because it is the token layer both surfaces share — that is what makes this a
 * champagne-on-near-black admin tool rather than a default Tailwind one.
 *
 * ─── NOTHING UNDER HERE IS EVER CACHED ────────────────────────────────────────────
 * No `'use cache'` anywhere in this subtree. An editor who is shown the value they just
 * replaced cannot tell a stale cache from a failed save, and will save again. The dashboard
 * reads go through the uncached half of `project-service.ts` for the same reason.
 */
import type { Metadata, Viewport } from 'next';
import { Providers } from '../providers';

// Same path as the public root layout imports it from: Tailwind v4 resolves `@source`
// relative to the stylesheet, so this file must not be moved or re-exported.
import '../globals.css';

export const viewport: Viewport = {
  // Dark-only, exactly as the public site. Declaring it paints form controls and scrollbars
  // to match before first paint, which matters more here — this surface is mostly controls.
  colorScheme: 'dark',
  themeColor: '#0c0b0a',
};

export const metadata: Metadata = {
  title: { default: 'Dashboard — Kavan Studio', template: '%s — Kavan Studio Dashboard' },
  /**
   * Belt as well as braces. `app/robots.ts` already disallows `/dashboard` from the same
   * `PRIVATE_ROUTES` array the gate reads, and this adds the per-page directive — the two
   * fail differently: `robots.txt` is a request a crawler may ignore, and a `noindex` header
   * is honoured by the ones that matter even when they arrive at a URL directly.
   *
   * Neither is the privacy mechanism. The session check on the route is.
   */
  robots: { index: false, follow: false, nocache: true },
};

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" data-scroll-behavior="smooth">
      <body className="bg-s-0 text-t-md">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
