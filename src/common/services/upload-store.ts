// src/common/services/upload-store.ts
/**
 * THE ONLY MODULE THAT TOUCHES `UPLOAD_DIR`. Files go in through here and come out through
 * here; the two route handlers know a stored PATH and nothing about a directory.
 *
 * It is the ring-3 service for a store that happens to be a filesystem rather than a
 * database — same rule as every other service in this folder: `server-only`, reads its
 * configuration through `common/config/server-env` and never `process.env`, exposes plain
 * typed functions, and holds no UI copy and no HTTP status. `/api/uploads` and
 * `/api/media/[...path]` call this the way a page calls `project-service`.
 *
 * ─── THE PATH IS GENERATED, NEVER RECEIVED ────────────────────────────────────────
 * A stored path is `YYYY/MM/<16 random bytes as hex>.<sniffed extension>` and every
 * component of it is produced here:
 *
 *  - The DATE PARTITION keeps one directory from growing to tens of thousands of entries,
 *    which is what makes an `ls` during an incident usable and keeps a directory scan off
 *    the read path.
 *  - The RANDOM ID is the filename. Two people uploading `photo.jpg` must not collide, and
 *    more importantly the client's filename must never reach the filesystem at all: a
 *    caller-controlled path component is a path traversal, and sanitizing one correctly for
 *    every encoding, separator and unicode normalization is a problem nobody needs to have.
 *    16 bytes of `crypto.randomBytes` is 2^128; a collision is not a case worth handling.
 *  - The EXTENSION comes from the byte sniff, not from the upload. So a file that claims
 *    `.jpg` and is actually a PNG is stored — and later served — as a PNG, and a file that
 *    is neither never gets this far.
 *
 * The original filename is not stored anywhere, and that is a deliberate omission rather
 * than an oversight: nothing renders it, the alt text is what describes the image, and a
 * name like `IMG_4471 final FINAL (client's copy).jpg` is a liability the moment it is
 * echoed into a page or a log.
 *
 * ─── ORPHANS ARE SWEPT, NOT TRANSACTED (open decision, resolved) ──────────────────
 * A file is written the moment it is uploaded, before the record that references it is
 * saved — so an editor who uploads a picture and then closes the tab leaves a file nothing
 * points at. The alternative is a two-phase commit between a filesystem and a database that
 * cannot share a transaction, which is a real distributed-systems problem to solve for a
 * studio's photograph. `listAllStoredPaths()` below is the read half of the documented
 * sweep; AGENTS.md and the README carry the procedure. An unbounded directory on a volume
 * is an outage six months out, and a sweep is the cheap thing that prevents it.
 */
import 'server-only';
import { randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { serverEnv } from '@/common/config/server-env';
import { ACCEPTED_IMAGE_EXTENSIONS, STORED_IMAGE_PATH_PATTERN } from '@/common/constants/uploads';

/** Where a stored file ended up, and what it turned out to be. */
export interface StoredImage {
  /** Relative to `UPLOAD_DIR`, forward slashes, e.g. `2026/08/9f3c….jpg`. */
  path: string;
  width: number;
  height: number;
  bytes: number;
}

/** What `openStoredImage` hands a route handler. */
export interface StoredImageStream {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  bytes: number;
}

/* ────────────────────────────────────────────────────────────────────────────────
   Writing
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * Build the stored path for a file of this type. Exported for the test that asserts the
 * generator and `STORED_IMAGE_PATH_PATTERN` agree — a generator that drifts from the
 * pattern would produce paths the write schemas then refuse, on save, with a validation
 * message about a field nobody typed into.
 */
export function generateStoredPath(extension: string, now = new Date()): string {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}/${month}/${randomBytes(16).toString('hex')}.${extension}`;
}

/**
 * Write bytes to a generated path and return where they landed.
 *
 * WRITTEN TO A TEMPORARY NAME AND RENAMED. `rename` within one filesystem is atomic, so a
 * reader can only ever see the complete file or no file — never the half of it that had
 * been flushed when the process was killed mid-write. A half-written JPEG is worse than a
 * missing one: it renders as a grey band, passes every existence check, and looks like a
 * rendering bug.
 */
export async function storeImage(
  bytes: Uint8Array,
  extension: string,
): Promise<{ path: string; bytes: number }> {
  const path = generateStoredPath(extension);
  const absolute = join(uploadRoot(), ...path.split('/'));
  const temporary = `${absolute}.${randomBytes(6).toString('hex')}.part`;

  await mkdir(join(absolute, '..'), { recursive: true });
  await writeFile(temporary, bytes, { flag: 'wx' });
  try {
    await rename(temporary, absolute);
  } catch (error) {
    // Leaving a `.part` file behind on a failed rename would be an orphan the sweep does
    // not know about, since it matches no stored path. Best-effort, and the original
    // failure is what propagates.
    await unlink(temporary).catch(() => undefined);
    throw error;
  }

  return { path, bytes: bytes.byteLength };
}

/* ────────────────────────────────────────────────────────────────────────────────
   Reading — and the path-traversal defence
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * Resolve a REQUESTED path against `UPLOAD_DIR`, or answer `null`.
 *
 * ─── THIS IS THE SECURITY BOUNDARY OF `/api/media`, SO READ THE ORDER ─────────────
 * The check is: resolve first, then compare the RESULT's prefix. It is emphatically NOT a
 * scan of the incoming string for `..`, and the difference is the whole point:
 *
 *  - The framework has already percent-decoded the segments by the time a route handler
 *    sees them, and a decoder that runs before a string check can be fed `%2e%2e`,
 *    `%252e%252e`, `..%2f`, overlong UTF-8, or a backslash on a platform that accepts one.
 *    Every one of those is a different string and the same directory.
 *  - `path.resolve` normalizes `..` for real, so `a/../../etc/passwd` becomes `/etc/passwd`
 *    and the prefix comparison then simply fails. There is no list of tricks to keep up
 *    with, because the comparison is on the answer rather than on the question.
 *  - `realpath` is the second half and covers what resolution cannot: a SYMLINK inside
 *    `UPLOAD_DIR` pointing anywhere else resolves lexically to a path that IS under the
 *    root, and only asking the filesystem where it really goes catches it. The root is
 *    realpath'd too, or a symlinked upload directory would fail its own check.
 *  - The trailing `sep` on the prefix is not cosmetic: without it `/data/uploads-evil`
 *    passes a `startsWith('/data/uploads')` test.
 *
 * The EXTENSION ALLOWLIST is the belt to that braces. Even a path that resolves inside the
 * root may only be served if it ends in one of the extensions this app stores, so a stray
 * `.env`, `.sql` backup or `.part` file that ended up in the volume is not readable through
 * this route by anyone who guesses its name.
 *
 * `null` for every failure, with no distinction between "escaped", "not there" and "wrong
 * extension" — the caller answers 404 for all three. Telling a prober which of their
 * attempts resolved to a real file outside the root is telling them the traversal worked.
 */
export async function resolveStoredPath(segments: readonly string[]): Promise<string | null> {
  if (segments.length === 0) return null;
  // A NUL byte truncates a path in some syscalls; reject rather than normalize.
  if (segments.some(segment => segment.length === 0 || segment.includes('\0'))) return null;

  const extension = segments[segments.length - 1].split('.').pop()?.toLowerCase() ?? '';
  if (!ACCEPTED_IMAGE_EXTENSIONS.includes(extension)) return null;

  let root: string;
  try {
    root = await realpath(uploadRoot());
  } catch {
    // The directory does not exist yet (nothing has ever been uploaded). Nothing to serve.
    return null;
  }

  const candidate = resolve(root, ...segments);
  let actual: string;
  try {
    actual = await realpath(candidate);
  } catch {
    return null; // no such file, a broken symlink, or no permission — all one answer
  }

  return actual === root || actual.startsWith(root + sep) ? actual : null;
}

/**
 * Open a stored file for streaming, or answer `null`.
 *
 * ─── THE `turbopackIgnore` COMMENTS ARE NOT DECORATION ────────────────────────────
 * `stat` and `createReadStream` are called with a path the tracer cannot see through — it
 * is resolved at runtime from `UPLOAD_DIR`, which is an absolute path OUTSIDE the project
 * and unknowable at build time. Faced with that, Turbopack's static analysis gives up and
 * traces THE WHOLE PROJECT into `output: 'standalone'`, and the build says so.
 *
 * Measured rather than assumed: without these two comments the standalone output carries
 * 292 source files, `src/` and `public/` included — the exact thing standalone tracing
 * exists to avoid, and which the container image in `Dockerfile` then ships.
 *
 * The opt-out is correct here rather than a suppression, and the distinction matters
 * because AGENTS.md bans suppressions: there is genuinely nothing for the tracer to find.
 * These files are not build inputs, they are not in the repository, and they live on a
 * mounted volume that does not exist until the container runs. Telling the tracer to stop
 * looking is the accurate answer, not a silenced warning.
 *
 * STREAMED, NOT READ INTO MEMORY. `createReadStream` hands the platform a file descriptor
 * and lets it push chunks; `readFile` would hold every byte of every concurrently-requested
 * image in the heap at once, which on a page of twelve photographs is the difference
 * between a few kilobytes of buffers and a hundred megabytes.
 *
 * The `Content-Type` is derived from the STORED extension, which this module generated from
 * a byte sniff — so it is a fact about the file rather than a claim from whoever asked for
 * it, and the set it can take is closed.
 */
export async function openStoredImage(
  segments: readonly string[],
): Promise<StoredImageStream | null> {
  const absolute = await resolveStoredPath(segments);
  if (!absolute) return null;

  const info = await stat(/* turbopackIgnore: true */ absolute).catch(() => null);
  // A directory inside the store resolves and passes the prefix check; only a regular file
  // is servable.
  if (!info?.isFile()) return null;

  const extension = absolute.split('.').pop()?.toLowerCase() ?? '';
  const contentType = CONTENT_TYPE_BY_EXTENSION[extension];
  if (!contentType) return null;

  return {
    body: Readable.toWeb(
      createReadStream(/* turbopackIgnore: true */ absolute),
    ) as ReadableStream<Uint8Array>,
    contentType,
    bytes: info.size,
  };
}

/* ────────────────────────────────────────────────────────────────────────────────
   The sweep's read half
   ──────────────────────────────────────────────────────────────────────────────── */

/**
 * Every stored path currently on disk, in the same `YYYY/MM/id.ext` spelling the database
 * columns hold — so the sweep is a set difference and nothing has to translate between two
 * representations of one file.
 *
 * Nothing in the request path calls this. It exists for the documented reclamation
 * procedure (AGENTS.md, README) and for the test that pins the round trip from
 * `storeImage`'s output to this listing.
 */
export async function listAllStoredPaths(): Promise<string[]> {
  const root = uploadRoot();
  const entries = await readdir(root, { recursive: true, withFileTypes: true }).catch(() => []);
  return entries
    .filter(entry => entry.isFile())
    .map(entry =>
      // `parentPath` is absolute; the stored spelling is relative with forward slashes.
      join(entry.parentPath, entry.name)
        .slice(root.length + 1)
        .split(sep)
        .join('/'),
    )
    .filter(path => STORED_IMAGE_PATH_PATTERN.test(path))
    .sort();
}

/* ────────────────────────────────────────────────────────────────────────────────
   Internals
   ──────────────────────────────────────────────────────────────────────────────── */

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
};

/**
 * Read through `serverEnv`, never `process.env` — the same rule `db.ts` follows, and for
 * the same reason: the schema is what guarantees the value is present and absolute, and a
 * second reader would bypass both checks.
 *
 * Read per call rather than captured at module scope so a test can point the store
 * somewhere else without re-importing the module graph.
 */
function uploadRoot(): string {
  return serverEnv.UPLOAD_DIR;
}
