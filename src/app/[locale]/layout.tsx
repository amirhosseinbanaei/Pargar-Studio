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
import { getDictionary } from '@/common/i18n';
import { isLocale, localeAlternates } from '@/common/i18n/routing';
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
  const { t, isRTL } = getDictionary(locale);

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
      className={rtl ? 'is-fa' : undefined}
      // Required in v16 when a stylesheet sets smooth scrolling: v16 stopped force-
      // overriding it during navigations, so without this every route change animates a
      // long scroll instead of jumping to the top.
      data-scroll-behavior="smooth"
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
