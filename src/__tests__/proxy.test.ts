// @vitest-environment node
/**
 * The proxy composes TWO middlewares in a fixed order, and both halves of that order are
 * load-bearing. This file pins the order and the locale behaviour prompt 8 moved into
 * next-intl.
 *
 * IT IS WHERE `resolveLocale`'s COVERAGE WENT. Prompt 4's hand-rolled `Accept-Language`
 * parser had its own unit test in `common/i18n/__tests__/routing.test.ts`; the parser is
 * gone, replaced by next-intl's negotiation inside the middleware, so its cases are
 * asserted here instead — through the real composed proxy, which also proves the 307 and
 * that `/dashboard` never reaches the locale leg at all. Testing the outcome at the seam
 * is stronger than testing the helper was: the old test could pass while the proxy wired
 * it up wrong.
 */
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import proxy from '../proxy';
import { SESSION_COOKIE } from '../common/config/session-cookie';

const ORIGIN = 'https://kavanstudio.test';

function request(path: string, init?: { acceptLanguage?: string; session?: string }) {
  const headers = new Headers();
  if (init?.acceptLanguage) headers.set('accept-language', init.acceptLanguage);
  if (init?.session) headers.set('cookie', `${SESSION_COOKIE}=${init.session}`);
  return new NextRequest(new URL(path, ORIGIN), { headers });
}

/** The `Location` of a redirect, as a path. */
function target(response: Response): string | null {
  const location = response.headers.get('location');
  return location === null ? null : new URL(location, ORIGIN).pathname;
}

describe('leg 1 — the dashboard gate runs first', () => {
  it('never locale-prefixes /dashboard', () => {
    // The reason the order is not negotiable: `/dashboard` sits outside `[locale]` on
    // purpose, and the locale leg would happily send it to `/en/dashboard`, which is not
    // a route. An anonymous visitor goes to the login page, not to a prefixed URL.
    const response = proxy(request('/dashboard'));
    expect(target(response)).toBe('/dashboard/login');
  });

  it('never locale-prefixes /dashboard/login, and lets an anonymous visitor reach it', () => {
    const response = proxy(request('/dashboard/login'));
    // No redirect at all — the login page is where an anonymous visitor belongs.
    expect(response.headers.get('location')).toBeNull();
    expect(response.status).toBe(200);
  });

  it('leaves a dashboard request with a session cookie alone, still unprefixed', () => {
    // Presence only — this gate is never the authorization decision.
    const response = proxy(request('/dashboard/projects', { session: 'anything' }));
    expect(response.headers.get('location')).toBeNull();
    expect(response.status).toBe(200);
  });

  it('carries the origin on the sign-in redirect so the form can return the visitor', () => {
    const response = proxy(request('/dashboard/media'));
    const location = new URL(response.headers.get('location') ?? '', ORIGIN);
    expect(location.searchParams.get('next')).toBe('/dashboard/media');
  });
});

describe('leg 2 — the locale redirect', () => {
  it('redirects the bare / with a 307, never a 308', () => {
    // The chosen locale depends on a request header, so the mapping is not permanent: a
    // 308 would pin a reader to whichever language they resolved to on their first visit,
    // in a redirect cache they cannot see.
    const response = proxy(request('/'));
    expect(response.status).toBe(307);
  });

  it('honours a Persian browser, as navigator.language did', () => {
    expect(target(proxy(request('/', { acceptLanguage: 'fa-IR,fa;q=0.9,en;q=0.8' })))).toBe('/fa');
    expect(target(proxy(request('/', { acceptLanguage: 'fa' })))).toBe('/fa');
  });

  it('respects quality order rather than document order', () => {
    expect(target(proxy(request('/', { acceptLanguage: 'en;q=0.2,fa;q=0.9' })))).toBe('/fa');
    expect(target(proxy(request('/', { acceptLanguage: 'fa;q=0.2,en;q=0.9' })))).toBe('/en');
  });

  it('ignores a range explicitly refused with q=0', () => {
    expect(target(proxy(request('/', { acceptLanguage: 'fa;q=0,en' })))).toBe('/en');
  });

  it('falls back to English when nothing matches, and when nothing is asked for', () => {
    expect(target(proxy(request('/', { acceptLanguage: 'de-DE,de;q=0.9' })))).toBe('/en');
    expect(target(proxy(request('/')))).toBe('/en');
  });

  it('does not match a language that merely starts with the same letters', () => {
    expect(target(proxy(request('/', { acceptLanguage: 'fan' })))).toBe('/en');
  });

  it('carries the rest of the path through the redirect', () => {
    expect(
      target(proxy(request('/projects/qeytarieh-08-residence', { acceptLanguage: 'fa' }))),
    ).toBe('/fa/projects/qeytarieh-08-residence');
  });

  it('leaves an already-prefixed path alone', () => {
    // The common case, and it runs on every navigation, RSC payload and `<Link>` prefetch.
    for (const path of ['/en', '/fa', '/en/projects', '/fa/studio']) {
      expect(proxy(request(path)).headers.get('location')).toBeNull();
    }
  });

  it('stores no locale preference', () => {
    // `localeCookie: false`. next-intl would otherwise write `NEXT_LOCALE` and prefer it
    // over `Accept-Language`, reintroducing exactly the `kavan.lang` memory prompt 4
    // dropped: the URL is the memory, because it travels with a shared link.
    const response = proxy(request('/', { acceptLanguage: 'fa' }));
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
