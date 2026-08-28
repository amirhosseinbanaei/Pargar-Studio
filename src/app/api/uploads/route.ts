// src/app/api/uploads/route.ts
/**
 * POST /api/uploads — the ONLY way a file enters this application.
 *
 * ═══ NOTHING GATES THIS ROUTE. IT GATES ITSELF. ═══════════════════════════════════
 * `src/proxy.ts`'s matcher excludes `api` deliberately (see the comment at its `config`):
 * a 307 is a valid answer to a document request and a corrupt one to a data request, so the
 * interception layer never runs here at all. Neither the coarse cookie-presence gate nor
 * anything else stands in front of this handler.
 *
 * So it calls `readSession()` ITSELF, as its first statement, and answers 401 BEFORE IT
 * READS A BYTE OF THE BODY. `project-actions.ts` makes this argument for Server Actions —
 * a public endpoint with a stable id, reachable with `curl` — and it applies here with more
 * force, because this endpoint writes files to a disk. An anonymous caller must not be able
 * to make this process allocate, parse or store anything, and reading the body before the
 * check would hand them all three.
 *
 * ═══ THE VALIDATION ORDER IS THE DESIGN ══════════════════════════════════════════
 * Each step refuses before the next one costs anything:
 *
 *  1. THE SESSION. Above. Nothing else happens for a caller who was never allowed in.
 *  2. THE SIZE, CHECKED WHILE STREAMING. The body is pulled chunk by chunk with a running
 *     total and abandoned the moment it passes the cap. Buffering first and checking after
 *     is how a 2 GB body becomes a memory exhaustion — the 413 is correct and arrives after
 *     the damage. `Content-Length` is checked first as a courtesy, because refusing before
 *     the upload starts is kinder than refusing after, but it is a claim and never the
 *     enforcement.
 *  3. THE REAL TYPE, by sniffing the leading bytes. `Content-Type` is caller-supplied and
 *     proves nothing: `mv notes.txt photo.jpg` is the whole attack and a browser labels the
 *     result `image/jpeg` from the extension alone.
 *  4. THE DECLARED DIMENSIONS, against a cap — the decompression bomb, which is small on
 *     the wire and enormous in the optimizer.
 *
 * Only then is anything written, and the stored path is GENERATED (`upload-store.ts`) —
 * the client's filename never touches the filesystem.
 *
 * ═══ RAW BYTES, NOT MULTIPART, AND WHY ════════════════════════════════════════════
 * The body IS the file. Two things follow, both of them the reason:
 *
 *  - `request.formData()` buffers the entire body before yielding a field, so step 2 could
 *    not be a streaming check at all — the cap would be enforced after the allocation it
 *    exists to prevent.
 *  - The uploader posts with `XMLHttpRequest`, whose `upload.onprogress` is the only real
 *    progress signal available in a browser (`references/07-forms.md` §6 says so outright:
 *    a Server Action and `fetch` have none, and a fake bar lies). Raw bytes make that a
 *    two-line client.
 *
 * ═══ IT ANSWERS IN THE ACTION ENVELOPE ════════════════════════════════════════════
 * The JSON body is an `ActionResult` and the HTTP status matches it, so the uploader
 * branches on `result.status` and a 422 carries a `fieldErrors` body that binds onto the
 * field exactly as `RecordForm` binds a Server Action's. That is the rule
 * `references/06-error-system.md` §4.3 states and `RecordForm.tsx:18` already follows —
 * one shape for every failure in the app, and never a branch on message text.
 */
import { readSession } from '@/common/services/session';
import { storeImage } from '@/common/services/upload-store';
import { sniffImage, SNIFF_BYTES } from '@/common/lib/images';
import { MAX_IMAGE_DIMENSION, MAX_UPLOAD_BYTES } from '@/common/constants/uploads';
import type { ActionResult } from '@/common/services/action-result';
/**
 * Declared in `common/schemas/image` rather than here, because the dashboard's uploader
 * consumes it and `modules → app` is not a legal import direction. Both ends of this
 * request read one type.
 */
import type { UploadedImage } from '@/common/schemas/image';

/** One place the envelope is spelled, so a status and its body can never disagree. */
function answer<T>(result: ActionResult<T>, status: number): Response {
  return Response.json(result, { status });
}

export async function POST(request: Request): Promise<Response> {
  /* 1 — THE SESSION, before the body. See the header. */
  const session = await readSession();
  if (session.status !== 'valid') {
    // Every non-valid status collapses to 401, exactly as the write actions do: telling
    // someone their signature parsed but their expiry did not is telling them their forgery
    // is close.
    return answer({ ok: false, status: 401 }, 401);
  }

  if (!request.body) {
    return answer({ ok: false, status: 422, body: { image: ['No file was sent.'] } }, 422);
  }

  /* 2a — the advisory pre-check. A claim, not the enforcement. */
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES) {
    return answer({ ok: false, status: 413, body: tooLarge() }, 413);
  }

  /* 2b — the real one, while streaming. */
  const collected = await collectBounded(request.body, MAX_UPLOAD_BYTES);
  if (collected === 'too-large') {
    return answer({ ok: false, status: 413, body: tooLarge() }, 413);
  }
  if (collected.byteLength === 0) {
    return answer({ ok: false, status: 422, body: { image: ['The file was empty.'] } }, 422);
  }

  /* 3 — what it actually is, and 4 — how big it says it is. */
  const sniffed = sniffImage(collected.subarray(0, SNIFF_BYTES));
  if (!sniffed) {
    return answer(
      {
        ok: false,
        status: 422,
        body: {
          image: ['That file is not a JPEG, PNG, WebP, AVIF or GIF image.'],
        },
      },
      422,
    );
  }

  if (sniffed.width > MAX_IMAGE_DIMENSION || sniffed.height > MAX_IMAGE_DIMENSION) {
    return answer(
      {
        ok: false,
        status: 422,
        body: {
          image: [
            `That image is ${sniffed.width}×${sniffed.height}. The limit is ${MAX_IMAGE_DIMENSION} pixels on either side.`,
          ],
        },
      },
      422,
    );
  }

  /* Only now does anything reach a disk. */
  const stored = await storeImage(collected, sniffed.extension);

  const data: UploadedImage = {
    path: stored.path,
    width: sniffed.width,
    height: sniffed.height,
    bytes: stored.bytes,
  };
  return answer({ ok: true, data }, 200);
}

/**
 * The field key is `image` in every 422 body above, and it is the name the uploader
 * registers under, so `applyFieldErrors` binds the message onto the control the person is
 * looking at rather than dropping it into the form-level region.
 */
function tooLarge(): Record<string, string[]> {
  const megabytes = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
  return { image: [`That file is larger than ${megabytes} MB.`] };
}

/**
 * Drain a stream into one buffer, giving up the moment it exceeds `limit`.
 *
 * THE POINT IS WHERE THE CHECK SITS: inside the loop, on a running total, before the chunk
 * is kept. The reader is cancelled on refusal, which tells the platform to stop pulling
 * from the socket rather than politely finishing a body that is already rejected.
 *
 * Chunks are collected and concatenated once at the end rather than into a growing buffer,
 * because repeatedly copying an 8 MB buffer to append 64 KB is quadratic — which is a
 * performance bug that only shows up on the largest files anyone uploads.
 */
async function collectBounded(
  body: ReadableStream<Uint8Array>,
  limit: number,
): Promise<Uint8Array | 'too-large'> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        return 'too-large';
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
