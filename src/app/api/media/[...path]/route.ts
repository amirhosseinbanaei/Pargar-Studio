// src/app/api/media/[...path]/route.ts
/**
 * GET /api/media/<stored path> — serves an uploaded image.
 *
 * ═══ PUBLIC BY DESIGN, AND THAT IS THE DECISION ═══════════════════════════════════
 * This route does NOT read the session, and it is the one route handler in this app that
 * does not. What it serves is the photograph on a public project page: gating it would mean
 * every card on `/en/projects` 401s for every visitor. Its sibling `/api/uploads` writes and
 * therefore authenticates; this one reads what the site has already published.
 *
 * The authorization that matters here is over the FILE NAMESPACE rather than over the
 * caller, and it is total: a request can only ever reach a regular file that resolves
 * inside `UPLOAD_DIR` and carries one of the five extensions this app stores. Nothing else
 * in that volume — a stray backup, a half-written `.part`, a symlink somebody added — is
 * reachable by anyone who guesses its name.
 *
 * ═══ NOTHING GATES IT EITHER ══════════════════════════════════════════════════════
 * `src/proxy.ts`'s matcher excludes `api`, so the locale leg never sees this path — which
 * is exactly right, since `/en/api/media/…` is not a route and a 307 in front of a binary
 * response is a corrupt payload rather than a redirect. Same reasoning as `/api/uploads`;
 * the difference is only in what each one has to check for itself.
 *
 * ═══ THE PATH-TRAVERSAL DEFENCE LIVES IN `upload-store.ts` ════════════════════════
 * `resolveStoredPath` resolves the request against the root FIRST and then checks the
 * prefix of the RESULT, plus `realpath` for symlinks. A `..` check against the raw string
 * is not enough and that function's comment says why at length: the segments arrive already
 * percent-decoded, so `%2e%2e`, `%252e%252e` and `..%2f` are three different strings and
 * one directory, while a check on the resolved answer has no list of tricks to keep up
 * with. It is in the store rather than here because the store is the only module that knows
 * where the root is.
 *
 * ═══ THE CACHE HEADER IS SAFE BECAUSE THE PATH IS IMMUTABLE ═══════════════════════
 * `immutable`, one year. A stored path contains 16 random bytes and is generated per upload,
 * so replacing a record's picture produces a NEW path and the old URL is simply no longer
 * referenced — the bytes at a given URL can never change. That is what makes the strongest
 * possible cache header correct here rather than reckless, and it is why the uploader
 * replaces a path instead of overwriting a file.
 */
import { openStoredImage } from '@/common/services/upload-store';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;

  const file = await openStoredImage(path);
  /**
   * ONE ANSWER FOR EVERY REFUSAL — escaped the root, does not exist, wrong extension, is a
   * directory. A prober who can tell "outside the root" from "not found" has been told
   * which of their encodings got through the resolver, which is the only feedback a
   * traversal attempt needs to make progress.
   */
  if (!file) return new Response('Not found', { status: 404 });

  return new Response(file.body, {
    status: 200,
    headers: {
      // From the STORED extension, which was itself derived from a byte sniff at upload —
      // a fact about the file rather than a claim from whoever asked for it.
      'Content-Type': file.contentType,
      'Content-Length': String(file.bytes),
      'Cache-Control': 'public, max-age=31536000, immutable',
      // These are bitmaps and are never interpreted as anything else, whatever a browser's
      // own sniffing might otherwise decide about a file whose bytes look ambiguous.
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
