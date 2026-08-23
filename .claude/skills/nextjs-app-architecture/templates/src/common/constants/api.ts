// src/common/constants/api.ts
/**
 * The only place an origin or base URL is spelled out in the whole app, derived from
 * validated environment configuration.
 *
 * This file must NEVER contain a hardcoded origin literal — not as a default, not as a
 * development convenience, not "temporarily". A literal here is invisible to the env
 * validation, survives every deploy, and points production at a machine that does not
 * exist. It must also never be imported by anything that then builds a URL by hand at a
 * call site: services pass a PATH to `apiFetch`, which prefixes `API_URL` exactly once.
 *
 * The failure it prevents: `fetch(`${process.env.NEXT_PUBLIC_API_URL}/x`)` sprinkled
 * across call sites. One env rename breaks N files, and a base-URL typo becomes a 404 at
 * runtime instead of a boot failure.
 */
import { env } from '@/common/config/env';

/**
 * REST API base. The trailing slash is stripped so `${API_URL}${path}` — with every
 * service path starting with `/` — can never produce a double slash, which some servers
 * 404 and others silently redirect (losing the request body of a POST on the way).
 */
export const API_URL = env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');

/** Public origin this app is served from (metadata base, canonical URLs, sitemap). */
export const SITE_URL = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');

/** Origin serving uploaded media, when it differs from the API origin. */
export const MEDIA_URL = env.NEXT_PUBLIC_MEDIA_URL?.replace(/\/+$/, '') ?? null;

/**
 * Resolve a media path the backend returned into something an `<img>`/`<a>` can use.
 *
 * Backends are inconsistent about this within a single response: some fields come back
 * absolute, some root-relative, some without a leading slash. Normalizing in one helper
 * prevents both classic bugs — a doubled slash in the middle of the URL, and an absolute
 * URL that gets the media origin glued onto the front of it.
 */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (!MEDIA_URL) return path;
  return `${MEDIA_URL}/${path.replace(/^\/+/, '')}`;
}
