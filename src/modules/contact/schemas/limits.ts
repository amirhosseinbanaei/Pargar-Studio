// src/modules/contact/schemas/limits.ts
/**
 * The bounds the contact form and the Server Action BOTH enforce.
 *
 * Two schemas guard one submission — a localized one for typing (`./contact-form`) and an
 * exact one for the trust boundary (`./contact-submission`) — and they must agree. If the
 * form is stricter, the reader is stopped by a rule the server does not have; if the
 * ACTION is stricter, the form says a message is fine and the server rejects it, and the
 * error lands on a field that looks perfectly valid. The second is what happened in
 * development with a body minimum of 10 in one file and 1 in the other.
 *
 * The maxima are the wire schema's (`common/schemas/contact-message`), restated here as
 * the numbers both module schemas read; `contactSubmissionSchema` still inherits its
 * shape from that file, so the wire contract stays the single definition of WHAT a
 * message is. `schemas/__tests__/agreement.test.ts` asserts the two never diverge.
 */

export const CONTACT_LIMITS = {
  nameMax: 120,
  emailMax: 254,
  subjectMax: 200,
  /**
   * A real minimum, not a non-empty check. "hi" is not a message the studio can answer,
   * and a one-character body is almost always a mis-submit or a script probing the
   * endpoint.
   */
  bodyMin: 10,
  bodyMax: 5000,
} as const;
