// src/common/constants/uploads.ts
/**
 * The upload contract, in ONE file, readable from both sides of the network.
 *
 * The endpoint enforces every limit here and the uploader in the dashboard reads the same
 * values to reject a file before spending the round trip on it. That split is the reason
 * this module is a plain constant file with no `server-only` and no `process.env`: the
 * CLIENT check is feedback, the SERVER check is the rule, and the two must be the same
 * numbers or the interface politely accepts a file the endpoint is about to refuse.
 *
 * Nothing here is a secret and nothing here is configuration. These are product limits —
 * changing one is a code change with a test, not an environment variable somebody can set
 * differently in two places.
 */

/**
 * The formats the endpoint accepts, keyed by the canonical MIME type it will store and
 * serve them under.
 *
 * `extension` is what the stored filename gets, and it is derived from the SNIFFED type,
 * never from the name the client sent — see `common/lib/images/sniff.ts`. `/api/media`
 * maps back the other way, from the stored extension to the `Content-Type` it answers
 * with, so an uploaded file can only ever be served as one of these six.
 *
 * SVG IS DELIBERATELY ABSENT, and it is the one omission worth a sentence: an SVG is a
 * document, not a bitmap. It can carry `<script>`, external references and CSS, and served
 * from this app's own origin — which is exactly what `/api/media` does — it executes with
 * the session cookie in scope. The site already generates every SVG it needs from pure
 * code; there is no reason to accept one from a file picker.
 */
export const ACCEPTED_IMAGE_TYPES = {
  'image/jpeg': { extension: 'jpg', label: 'JPEG' },
  'image/png': { extension: 'png', label: 'PNG' },
  'image/webp': { extension: 'webp', label: 'WebP' },
  'image/avif': { extension: 'avif', label: 'AVIF' },
  'image/gif': { extension: 'gif', label: 'GIF' },
} as const;

/** A MIME type this app stores. */
export type AcceptedImageType = keyof typeof ACCEPTED_IMAGE_TYPES;

/** The stored extensions, which is what `/api/media` allowlists a request path against. */
export const ACCEPTED_IMAGE_EXTENSIONS = Object.values(ACCEPTED_IMAGE_TYPES).map(
  entry => entry.extension,
) as readonly string[];

/**
 * The `accept` attribute for the file input.
 *
 * A HINT ONLY — it filters the picker's dialog and is trivially bypassed by dragging a file
 * in or by choosing "all files". The byte sniff on the server is what actually decides, and
 * this string exists so the common case does not present a person with files that are about
 * to be refused.
 */
export const IMAGE_ACCEPT_ATTRIBUTE = Object.keys(ACCEPTED_IMAGE_TYPES).join(',');

/**
 * 8 MB.
 *
 * Sized for a photograph of a building straight off a camera at web resolution, which is
 * the actual use: the studio's archive is 76 buildings and a cover image is the largest
 * thing anyone will send. It is checked WHILE STREAMING (`/api/uploads`), not after
 * buffering — buffering first and checking after is how a 2 GB body becomes a memory
 * exhaustion with a 413 that arrives too late to matter.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * 12000 px on either side.
 *
 * The cap is not about disk — an 8 MB file is 8 MB whatever its dimensions — it is about
 * what happens downstream. `next/image` decodes an uploaded file to re-encode it, and a
 * heavily-compressed image declaring 60000 × 60000 pixels is a decompression bomb: a few
 * hundred kilobytes on the wire that asks the optimizer for ~14 GB of bitmap. The
 * dimensions are read from the file's own header before it is stored, so a bomb is refused
 * at the door rather than at the first request for its optimized variant.
 */
export const MAX_IMAGE_DIMENSION = 12_000;

/**
 * The path prefix every stored image is served under.
 *
 * SAME-ORIGIN, which is what makes `NEXT_PUBLIC_MEDIA_URL` stay unset and
 * `mediaRemotePatterns()` in `next.config.ts` correctly keep returning an empty list: the
 * image optimizer needs no `remotePatterns` entry for a path on its own origin. See that
 * function's comment for what would change if storage ever moved off this app.
 */
export const MEDIA_URL_PREFIX = '/api/media';

/** `2026/08/9f3c….jpg` -> `/api/media/2026/08/9f3c….jpg`. */
export function mediaUrl(storedPath: string): string {
  return `${MEDIA_URL_PREFIX}/${storedPath}`;
}

/**
 * The shape a stored path may take, and the ONLY shape `/api/uploads` generates:
 * `YYYY/MM/<32 hex characters>.<extension>`.
 *
 * It is validated on BOTH ends and that is not belt-and-braces. On the write side it is a
 * self-check that the generator has not drifted. On the read side — the write schemas that
 * accept a path from the dashboard — it is the actual boundary: the browser sends the path
 * back as an ordinary form value on save, so without this a crafted submission could put
 * `../../etc/passwd` in the column and have `/api/media` asked for it on every render.
 * `/api/media` refuses that anyway by resolving and prefix-checking, but a column that can
 * only hold a well-formed path is one fewer thing depending on that route being right.
 */
export const STORED_IMAGE_PATH_PATTERN = new RegExp(
  `^\\d{4}/\\d{2}/[0-9a-f]{32}\\.(?:${ACCEPTED_IMAGE_EXTENSIONS.join('|')})$`,
);
