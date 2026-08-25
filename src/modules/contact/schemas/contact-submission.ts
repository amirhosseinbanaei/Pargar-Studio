// src/modules/contact/schemas/contact-submission.ts
/**
 * The schema the SERVER ACTION validates with — exact, bounded, and carrying no copy.
 *
 * A write schema is never tolerant. This one is built by extending the wire schema
 * (`contactMessageCreateSchema`, a `z.strictObject` with the real length caps and a real
 * email check) with the honeypot field the form adds, so the bounds have exactly one
 * definition: a cap that exists here and not there is a cap that drifts the first time
 * either is edited.
 *
 * Strict, so an unknown key is a rejection rather than a silently ignored extra — a
 * hand-crafted POST cannot smuggle a `readAt` or an `id` past it into the insert.
 *
 * WHY THE HONEYPOT HAS NO RULE. Written as `z.literal('')` a filled trap would fail the
 * parse and answer 422 with a field error naming the hidden input, which tells a bot
 * exactly what to stop filling and, worse, dead-ends any human whose password manager
 * autofilled it. It is a plain string here and the ACTION decides what a non-empty value
 * means.
 */
import { z } from 'zod';
import { contactMessageCreateSchema } from '@/common/schemas/contact-message';
import { CONTACT_LIMITS } from './limits';

export const contactSubmissionSchema = contactMessageCreateSchema.extend({
  /**
   * The one bound this schema tightens. The wire schema's `min(1)` is the FLOOR the
   * repository refuses to go below — it guards the column, not the conversation — and a
   * one-word body is not a message anyone can answer. The form applies the same minimum,
   * from the same constant, so the two cannot disagree.
   */
  body: z.string().trim().min(CONTACT_LIMITS.bodyMin).max(CONTACT_LIMITS.bodyMax),
  /** `HONEYPOT_FIELD` in `./contact-form`, spelled here so the inferred type keeps it. */
  company: z.string().max(200),
});

export type ContactSubmission = z.infer<typeof contactSubmissionSchema>;
