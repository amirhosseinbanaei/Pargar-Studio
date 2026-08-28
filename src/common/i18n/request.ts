// src/common/i18n/request.ts
/**
 * next-intl's per-request configuration. `next.config.ts` points the plugin at this file,
 * which is what makes `next-intl/config` resolve to it — without the plugin every
 * next-intl server API throws "Invalid i18n request configuration detected".
 *
 * WHAT ACTUALLY DEPENDS ON THIS. Not `./translator`: `getIntl(locale)` takes its locale as
 * an argument and builds a translator over the catalogs directly, so it needs no request
 * scope and works unchanged in a Client Component. What needs this file is the part of
 * next-intl that has to know the CURRENT locale without being told — `Link` and
 * `usePathname` from `./navigation` when rendered on the server, and
 * `NextIntlClientProvider` when it fills in what a Client Component should inherit.
 *
 * THE LOCALE COMES FROM `next/root-params`, NOT FROM `requestLocale`. `requestLocale` is
 * deprecated in next-intl 4 and reads a header, which under Cache Components would make
 * every page that touches it dynamic — this app prerenders 163 pages from
 * `generateStaticParams` and must keep doing so. `next/root-params` reads the `[locale]`
 * segment itself and is static-safe on Next 16.3.
 */
import { notFound } from 'next/navigation';
import { locale as rootLocale } from 'next/root-params';
import { getRequestConfig } from 'next-intl/server';
import { MESSAGES } from './catalog';
import { isLocale } from './routing';

export default getRequestConfig(async ({ locale }) => {
  /**
   * `locale` is set only when a caller passed one explicitly (`getTranslations({locale})`).
   * Otherwise it comes from the root `[locale]` segment, which is an arbitrary string
   * until `isLocale` narrows it: the segment also catches unmatched URLs like
   * `/unknown.txt`, so an invalid value must 404 rather than reach the catalog lookup.
   */
  const resolved = locale ?? (await rootLocale());
  if (!isLocale(resolved)) notFound();

  return {
    locale: resolved,
    messages: MESSAGES[resolved],
    /**
     * The studio is in Tehran and every date the interface formats is a Tehran date — see
     * `./tehran-time.ts`, which the clock in the footer already uses. Pinning it here means
     * next-intl's own formatters agree with that module instead of following whatever zone
     * the server process happens to run in.
     */
    timeZone: 'Asia/Tehran',
  };
});
