/**
 * THE CONTACT MODULE — the contact page, and the site's only write.
 *
 * TWO DIFFERENT THINGS SHARE THE WORD "CONTACT" HERE, deliberately: `contact` is the
 * editable CONTENT of this page (a singleton row an editor changes), and
 * `contact_messages` is the INBOX (mail a stranger sends). This module reads the first and
 * writes the second, and they are different tables with different lifecycles.
 *
 * This barrel is the module's ENTIRE public API. `app/` imports from here and never one
 * level deeper; no other module imports it at all.
 *
 * The ACTION is exported because the form imports it internally, not because `app/` calls
 * it — a page must not invoke a write. It is listed here so the module's whole surface is
 * visible in one file, which is the point of a barrel.
 */
export { ContactScreen, type ContactScreenProps } from './components/ContactScreen';
export { ContactForm, type ContactFormProps } from './components/ContactForm';
export { sendContactMessageAction } from './actions/contact-message-actions';
export {
  createContactFormSchema,
  CONTACT_FORM_FIELDS,
  EMPTY_CONTACT_FORM,
  HONEYPOT_FIELD,
  type ContactFormValues,
} from './schemas/contact-form';
export { contactSubmissionSchema, type ContactSubmission } from './schemas/contact-submission';
