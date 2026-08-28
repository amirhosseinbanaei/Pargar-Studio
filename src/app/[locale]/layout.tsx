// src/app/[locale]/layout.tsx
/**
 * THE root layout — the only one, and it lives under `[locale]` on purpose.
 *
 * `lang`, `dir` and the `is-fa` class are decided by the URL segment, so they are correct
 * in the first byte of the document. The legacy site could not do that: it served one HTML
 * file for both languages and ran a blocking inline script in `<head>` to flip the
 * direction before first paint (`legacy/index.html:29`), because otherwise a Persian
 * visitor watched the entire layout mirror itself after the fact. That script has no
 * successor here — the segment IS the answer, and there is nothing to flip.
 *
 * `is-fa` is not decoration: `i18n.css` keys the Persian tracking collapse on it, because
 * the 0.42em letter-spacing that makes the Latin wordmark work pulls Arabic-script letters
 * apart at their joins.
 *
 * Everything under `/` is nested here, so there is no `app/layout.tsx`. The bare `/` is
 * redirected by `src/proxy.ts` rather than rendered, which is why nothing needs a second
 * root layout.
 */
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { Vazirmatn } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getIntl, MESSAGES } from '@/common/i18n';
import { isLocale } from '@/common/i18n/routing';
import { localeAlternates } from '@/common/i18n/navigation';
import { localeValues } from '@/common/schemas/locale';
import { env } from '@/common/config/env';
import { Providers } from '../providers';

// `globals.css` stays at `src/app/globals.css`: Tailwind v4 resolves `@source` relative to
// the stylesheet, so moving it would silently change which files the scanner reads.
import '../globals.css';
/**
 * The ported legacy stylesheets, imported ONCE, here, in this order.
 *
 * Order is load-bearing and is the order the static site used: `globals.css` first because
 * every rule in the others reads its custom properties by name, `base` resets,
 * `shell`/`panel`/`chrome` build on it, `route` restates the panel geometry for a real
 * route (the one file here that is NOT a port), and `i18n` LAST so it can override the
 * Latin defaults without a single `!important`.
 */
import '@/common/styles/base.css';
import '@/common/styles/shell.css';
import '@/common/styles/panel.css';
import '@/common/styles/chrome.css';
import '@/common/styles/route.css';
import '@/common/styles/i18n.css';

/**
 * THE ONE WEBFONT IN THIS APPLICATION, and it is Persian-only.
 *
 * `i18n.css` has named "Vazirmatn" first in the Persian stack since the port, but nothing
 * ever loaded it — so Persian rendered in Vazirmatn for a reader who happened to have it
 * installed and fell through to Tahoma for everyone else. Latin type is unchanged and
 * still requests nothing: the geometric system stack in `--f-sans` is the whole English
 * design (see `globals.css`).
 *
 * `variable`, not `className`: the family name must reach the Persian stack in
 * `common/styles/i18n.css` through the token layer, exactly as every colour and duration
 * does. Inlining `'Vazirmatn'` in a component — or anywhere outside a custom property —
 * would put a font literal where the design system says a token goes, and would lose
 * next/font's generated fallback metrics with it.
 *
 * `display: 'swap'` so Persian text paints immediately in IRANSansX or Tahoma and is
 * re-rendered when the file arrives: a FOIT on the primary reading font is a blank page,
 * which is a worse failure than one repaint. next/font self-hosts the file and emits an
 * adjusted local fallback, so the swap costs very little layout shift and there is no
 * third-party request on the critical path.
 *
 * `arabic` AND `latin`: Persian pages carry Latin runs — outlet names, emails, the
 * coordinates on the contact page — and `.lat` in `i18n.css` sets them in `var(--f-sans)`,
 * which resolves to this stack inside `html.is-fa`.
 *
 * `preload: false`, AND THAT IS THE LOAD-BEARING OPTION, not a performance tweak.
 * `next/font` preloads by default, and a preload is emitted by the LAYOUT — which both
 * locales share — so `<link rel="preload" as="font">` went into the English document too
 * and Chrome duly fetched both subsets on `/en`, with `--f-vazirmatn` unset and not one
 * glyph rendered from them. Verified in a production build, not assumed: the preload does
 * not show up in a `dev`-only diff, and the tag is easy to miss because it names the file
 * by hash. With preloading off, the request is driven by the CSS instead — the browser
 * fetches the face only when something actually resolves to it, which happens under
 * `html.is-fa` and nowhere else.
 *
 * WHAT IT COSTS, on Persian: the fetch starts after the stylesheet is parsed rather than
 * at HTML parse. That is a slightly later swap, which `display: 'swap'` already covers —
 * against a whole unused font downloaded on every English page.
 */
const vazirmatn = Vazirmatn({
  subsets: ['arabic', 'latin'],
  display: 'swap',
  preload: false,
  variable: '--f-vazirmatn',
});

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/**
 * Both locales, so every page under this layout is a build-time candidate. Two entries is
 * the whole set — this is not a list that grows with the data.
 */
export function generateStaticParams() {
  return localeValues.map(locale => ({ locale }));
}

export const viewport: Viewport = {
  // Dark-only: the canvas is #0c0b0a and there is no light theme. Declaring it here paints
  // form controls and scrollbars to match before first paint.
  colorScheme: 'dark',
  themeColor: '#0c0b0a',
  viewportFit: 'cover',
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { t, isRTL } = getIntl(locale);

  const brand = t('brand.name');
  // `legacy/js/main.js:25`, exactly: the index title joins the tagline and the city with
  // the comma of the SCRIPT — U+060C in Persian, U+002C in English.
  const home = `${brand} — ${t('brand.tagline')}${isRTL ? '، ' : ', '}${t('ui.tehran')}`;

  return {
    metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
    // One template at the root; every route below exports a bare `title`. A route that
    // spelled out the suffix would drift the day the practice is renamed.
    title: { default: home, template: `%s — ${brand}` },
    description: t('cap.projects'),
    openGraph: { type: 'website', siteName: brand, title: home, locale },
    robots: { index: true, follow: true },
    alternates: localeAlternates(locale),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  // The segment is an arbitrary string until this line. Validating it HERE means no
  // component below ever receives one that is not a `Locale`.
  if (!isLocale(locale)) notFound();

  const rtl = locale === 'fa';

  return (
    <html
      lang={locale}
      dir={rtl ? 'rtl' : 'ltr'}
      /**
       * THE FONT VARIABLE IS SET ON THE PERSIAN DOCUMENT ONLY. `next/font` emits the
       * `@font-face` alongside the class it returns, so an English page that never carries
       * `vazirmatn.variable` never references the family and the browser never fetches an
       * Arabic-subset file it would not render a glyph from. `is-fa` rides along in the
       * same attribute because `i18n.css` keys the Persian tracking collapse on it.
       */
      className={rtl ? `is-fa ${vazirmatn.variable}` : undefined}
      // Required in v16 when a stylesheet sets smooth scrolling: v16 stopped force-
      // overriding it during navigations, so without this every route change animates a
      // long scroll instead of jumping to the top.
      data-scroll-behavior="smooth"
    >
      <body>
        {/*
          `locale` and `messages` are passed EXPLICITLY rather than left to next-intl to
          read from the request config. Both are already in hand here, and letting the
          provider await them would make this layout — the root of all 163 prerendered
          pages — read request scope under Cache Components.

          What needs it is small and specific: `LanguageSwitch` uses next-intl's `Link` and
          `usePathname`, which resolve the current locale from this context. It also means
          the two client leaves that render copy no longer have to import the catalogs into
          the browser bundle to get at them.
        */}
        <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
