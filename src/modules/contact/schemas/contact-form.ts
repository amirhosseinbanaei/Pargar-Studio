// src/modules/contact/schemas/contact-form.ts
/**
 * The CLIENT form schema — the one the typing experience is validated against.
 *
 * Separate from the wire schema in `@/common/schemas/contact-message`, and the split is
 * the point: this one carries user-facing copy, that one carries the contract. Messages
 * here are localized strings; a wire schema must never contain a sentence written for a
 * human, because it is also the schema a repository parses with and its messages end up
 * in logs and in a 422 body.
 *
 * IT IS A FACTORY, not a constant, because this site is bilingual. A module-level schema
 * would bake one language's messages into the module at import time, and the Persian page
 * would then show "Please enter your name." under a Persian label. The dictionary is
 * passed in and the schema is built per render — it costs a few object allocations and it
 * is the only way the messages can be in the reader's language.
 *
 * THE BOUNDS COME FROM `./limits`, which the ACTION's schema reads too. They must not be
 * spelled twice: if they drift, the form accepts something the action rejects and the
 * reader is told to fix a field that looks fine — the worst kind of validation failure,
 * because there is nothing visible to fix.
 */
import { z } from 'zod';
import type { Dictionary } from '@/common/i18n';
import { CONTACT_LIMITS } from './limits';

/**
 * The honeypot's field name. Plausible enough for a bot to fill, absent from the table.
 *
 * Spelled as a literal in the two schemas rather than as a computed key: a computed
 * property widens the inferred object type, and `ContactFormValues` would lose the field
 * name that `register()` and `applyFieldErrors` are typed against.
 */
export const HONEYPOT_FIELD = 'company';

export function createContactFormSchema(dictionary: Dictionary) {
  const { t } = dictionary;
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t('form.errName'))
      .max(CONTACT_LIMITS.nameMax, t('form.errLong')),
    email: z.email(t('form.errEmail')).max(CONTACT_LIMITS.emailMax, t('form.errLong')),
    subject: z
      .string()
      .trim()
      .min(1, t('form.errSubject'))
      .max(CONTACT_LIMITS.subjectMax, t('form.errLong')),
    body: z
      .string()
      .trim()
      .min(CONTACT_LIMITS.bodyMin, t('form.errMessage'))
      .max(CONTACT_LIMITS.bodyMax, t('form.errLong')),
    /**
     * The honeypot. It is part of the form's values so react-hook-form owns it and it
     * travels with the submission; it has no message and no rule, because a human never
     * fills it and a bot must not be told that filling it was the mistake.
     */
    company: z.string(),
  });
}

export type ContactFormValues = z.infer<ReturnType<typeof createContactFormSchema>>;

/**
 * The fields this form renders — the allow-list `applyFieldErrors` binds against. A
 * server-named field outside this list becomes a form-level message instead of a
 * `setError` on an input nobody can see or clear.
 */
export const CONTACT_FORM_FIELDS = [
  'name',
  'email',
  'subject',
  'body',
] as const satisfies ReadonlyArray<keyof ContactFormValues>;

/** Empty values for every field, so each input is controlled from mount to unmount. */
export const EMPTY_CONTACT_FORM: ContactFormValues = {
  name: '',
  email: '',
  subject: '',
  body: '',
  company: '',
};
