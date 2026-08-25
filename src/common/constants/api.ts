// src/common/constants/api.ts
/**
 * The only place an origin or base URL is spelled out in the whole app, derived from
 * validated environment configuration.
 *
 * This file must NEVER contain a hardcoded origin literal — not as a default, not as a
 * development convenience, not "temporarily". A literal here is invisible to the env
 * validation, survives every deploy, and points production at a machine that does not
 * exist.
 *
 * PROJECT NOTE — no `API_URL`. The architecture's template exports one, because it models
 * an app whose data arrives over HTTP from a REST backend. This app has no backend: its
 * data source is its own SQLite / libSQL database, reached through `db -> repository ->
 * service` (prompt 2). There is no request to prefix, so exporting an API base would be a
 * constant nothing could ever correctly use. See AGENTS.md for that deviation.
 */
import { env } from '@/common/config/env';

/**
 * Public origin this app is served from (metadata base, canonical URLs, sitemap, robots).
 *
 * The trailing slash is stripped so that `${SITE_URL}${path}` — with every path starting
 * with `/` — can never produce a double slash, which some hosts 404 and others silently
 * redirect.
 */
export const SITE_URL = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');

/**
 * Origin serving uploaded media, when one exists. `null` today: the site ships zero image
 * files — every drawing is generated as SVG at runtime.
 */
export const MEDIA_URL = env.NEXT_PUBLIC_MEDIA_URL?.replace(/\/+$/, '') ?? null;

/**
 * Resolve a stored media path into something an `<img>` / `<a>` can use.
 *
 * Stored paths are inconsistent by nature — some absolute, some root-relative, some with
 * no leading slash at all. Normalizing in one helper prevents both classic bugs: a doubled
 * slash in the middle of the URL, and an absolute URL that gets the media origin glued
 * onto the front of it.
 */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (!MEDIA_URL) return path;
  return `${MEDIA_URL}/${path.replace(/^\/+/, '')}`;
}
