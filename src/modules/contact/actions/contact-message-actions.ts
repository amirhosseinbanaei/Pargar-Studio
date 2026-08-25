// src/modules/contact/actions/contact-message-actions.ts
'use server';
/**
 * THE ONLY SERVER ACTION IN THE PUBLIC SITE.
 *
 * Everything else the site does is a read behind `'use cache'`. This is the one write, and
 * the one endpoint a stranger can reach, so every rule in
 * `references/04-actions-and-mutations.md` §3 applies literally rather than by analogy.
 *
 * IT RETURNS, IT NEVER THROWS. An error thrown inside a Server Action is sanitized
 * crossing the RPC boundary: in production the client receives a generic `Error` with an
 * opaque digest, and the status, the body and the field errors are gone. `toActionResult`
 * is the one place a server-side throw becomes a result; `ActionResult` is a plain object,
 * so it survives serialization intact and `if (!result.ok)` narrows at the call site.
 *
 * IT RE-VALIDATES. The form validated the same values a moment ago with a localized
 * schema, and that proves nothing here: this is a public HTTP endpoint and the UI that
 * called it is not a security boundary. A hand-written POST reaches this function with no
 * form involved at all.
 *
 * IT TAKES NO IDENTITY. There is no session on the public site and there must never be an
 * author, owner or id argument — every argument is caller-controlled. The one thing the
 * caller cannot forge is the connection it came from, and that is read from the request
 * headers, not from the payload.
 *
 * WHAT IT DOES NOT DO:
 *  - It purges no cache tag. Confirmed rather than assumed: `contact_messages` is never
 *    cached (`common/services/cache-tags.ts`) and no public page reads the inbox — the
 *    contact PAGE reads the `contact` singleton, a different table this write never
 *    touches. An `updateTag` here would purge nothing.
 *  - It sends no email. The dashboard inbox in prompt 7 is where messages are read.
 *  - It does not `redirect()`. The form stays on the page and swaps to its sent state, so
 *    a reader can see that the message went and write another if they want to.
 */
import { z } from 'zod';
import { headers } from 'next/headers';
import { toActionResult, type ActionResult } from '@/common/services/action-result';
import { createContactMessage } from '@/common/services/contact-message-service';
import { contactSubmissionSchema } from '../schemas/contact-submission';
import { rateLimit } from '../lib/rate-limit';

/**
 * The connection this submission came from.
 *
 * `x-forwarded-for` is a LIST — `client, proxy1, proxy2` — and the client is the first
 * entry; taking the last would key the limit on the proxy and rate-limit every visitor
 * together. It is also forgeable by anyone who can set a header, which is exactly why this
 * value is used for nothing but a courtesy limit and never for authorization.
 *
 * `'unknown'` is a real bucket, not a failure: a request with no forwarding header (a
 * direct hit, or local development) shares one window, which is the conservative answer.
 */
async function callerKey(): Promise<string> {
  const head = await headers();
  const forwarded = head.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || head.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * `input` is `unknown` on purpose. Typing it as the form's values would be a comment, not
 * a check — the client controls what it sends, and the parse below is what makes it true.
 */
export async function sendContactMessageAction(input: unknown): Promise<ActionResult> {
  const parsed = contactSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    // The canonical validation envelope: `{ field: [message] }`, which `parseBody` in the
    // error system already understands, so the client binds it with no adapter. The
    // messages inside are the wire schema's, in English; the FORM re-localizes by field
    // name rather than showing them, because a message cannot be translated after the
    // fact but a field name can be looked up.
    return { ok: false, status: 422, body: z.flattenError(parsed.error).fieldErrors };
  }

  const { company, ...message } = parsed.data;

  /**
   * The honeypot, checked BEFORE the rate limit so a bot burns no one's window.
   *
   * It answers SUCCESS and writes nothing. Answering 422 would tell a script which field
   * to stop filling, and every subsequent run would get through; a silent accept means the
   * script's own logs say it worked and nothing arrives. The cost of being wrong is one
   * lost message from a reader whose browser autofilled a hidden field, which is why the
   * trap is a plausible-but-unusual name rather than something an autofiller recognizes.
   */
  if (company.trim() !== '') return { ok: true, data: undefined };

  const limit = rateLimit(await callerKey());
  // 429 is the whole message. The client branches on the STATUS and prints its own
  // localized copy — this site is bilingual, so a sentence chosen here would be right in
  // one language and wrong in the other.
  if (!limit.allowed) return { ok: false, status: 429 };

  return toActionResult(async () => {
    await createContactMessage(message);
  });
}
