// src/proxy.ts
/**
 * Locale routing, and nothing else.
 *
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`; the body and the matcher are the same.
 *
 * WHY THE REDIRECT LIVES HERE. Every route in this app is under `/[locale]/`, so
 * `app/[locale]/layout.tsx` is the ONE root layout — the only place `lang`, `dir` and the
 * `is-fa` class can be set before the first byte, which is the whole reason the legacy
 * site ran an inline script in `<head>` (`legacy/index.html:29`). That leaves nothing at
 * `/` to render a redirect from, and rendering one would need a second root layout anyway.
 * A rewrite before route resolution is exactly what this hook is for.
 *
 * WHAT IS DELIBERATELY ABSENT: any authorization decision. There is no session to check
 * yet, and when prompt 6 adds one the gate belongs here only as a coarse
 * authenticated/anonymous redirect — never as a role or ownership check, which is
 * forgeable from the client and would then exist in two places that drift.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LOCALE, isLocale, resolveLocale } from '@/common/i18n/routing';

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split('/')[1];

  // Already prefixed. Fall straight through — this runs on EVERY request, navigation, RSC
  // payload and `<Link>` prefetch alike, so the common case must cost one string split.
  if (isLocale(first)) return NextResponse.next();

  /**
   * `legacy/js/core/i18n.js:97` chose the starting language from `navigator.language`,
   * falling back to English. `Accept-Language` is the server-side form of the same signal
   * and the only one available before a document exists, so the intent survives the move
   * even though the mechanism cannot.
   *
   * A stored preference has no successor: the language is in the URL now, so a reader who
   * chose Persian is holding a Persian link. That is a better memory than `localStorage`,
   * which was per-browser and invisible to anyone they sent the link to.
   */
  const locale = resolveLocale(request.headers.get('accept-language')) ?? DEFAULT_LOCALE;

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;

  /**
   * A 307, not a 308. The chosen locale depends on a request header, so this mapping is
   * not permanent and must not be cached by intermediaries or burned into a browser's
   * redirect cache — a reader whose browser is set to Persian would otherwise be pinned to
   * whichever language they happened to resolve to on their very first visit.
   */
  return NextResponse.redirect(url, 307);
}

export const config = {
  /**
   * Everything except the paths a redirect would corrupt or make more expensive:
   *
   *  - `api` — a 307 is a valid answer to a document request and a corrupt one to a data
   *    request; a `fetch` follows it and parses HTML as JSON.
   *  - `_next/static`, `_next/image` — running this on every byte the page loads adds
   *    latency to all of them for a decision that can never apply.
   *  - anything with a file extension — `favicon.ico`, `icon.svg`, `robots.txt`,
   *    `sitemap.xml`. A locale prefix on an asset URL is a 404.
   */
  matcher: ['/((?!api|_next/static|_next/image|.*\\.[^/]+$).*)'],
};
