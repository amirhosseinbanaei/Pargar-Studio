// src/common/schemas/contact-message.ts
/**
 * Contracts for the `contact_messages` inbox — submissions from the public contact form
 * (prompt 5), read in the dashboard (prompt 7).
 *
 * This is the second, distinct meaning of "contact" in this codebase. `./contact` is the
 * editable CONTENT of the contact page; this is the INBOUND mail. They share a word and
 * nothing else — different table, different lifecycle, different reader.
 *
 * NO per-locale columns, deliberately: a visitor writes in whichever language they choose,
 * and there is nothing to translate. That is also why this file has no locale mapper.
 */
import { z } from 'zod';
import { looseString } from './helpers';

/* ── READ ─────────────────────────────────────────────────────────────────────── */

export const contactMessageRowSchema = z.object({
  id: z.number(),
  name: looseString,
  email: looseString,
  subject: looseString,
  body: looseString,
  createdAt: z.date(),
  /** `null` means unread. Absence of a read time, not a boolean that can disagree with one. */
  readAt: z.date().nullable(),
});

export type ContactMessage = z.infer<typeof contactMessageRowSchema>;

/* ── WRITE ────────────────────────────────────────────────────────────────────── */

/**
 * EXACT, and the only schema in this file a stranger can reach. The public form posts
 * here, so every bound is a real one: the length caps are what stops a single request
 * writing a megabyte into the inbox, and `z.email()` is what stops the reply address being
 * unusable.
 *
 * The FORM schema — with its user-facing, localized messages — is a separate file that
 * prompt 5 writes beside the form. This one guards the trust boundary; that one guards the
 * typing experience, and neither can do the other's job.
 */
export const contactMessageCreateSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(254),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
});

export type ContactMessageCreate = z.infer<typeof contactMessageCreateSchema>;
