// src/modules/contact/components/ContactForm.tsx
'use client';
/**
 * The message form — the only interactive leaf on the public site, and the only place a
 * visitor writes anything.
 *
 * TIER 2 (`references/07-forms.md` §3): react-hook-form with `zodResolver`, rendered
 * through the `form/` tier so the label, `aria-describedby` and `aria-invalid` wiring
 * exists on every field without a per-form checklist. There is no hand-rolled `onSubmit`
 * and no `useState` mirroring the submit state — `handleSubmit` guards re-entry and
 * `FormButton` reads `isSubmitting` from context, so a double click cannot post twice.
 *
 * WHY TIER 2 AND NOT TIER 1. Four flat fields would ordinarily be a `useActionState` form.
 * The deciding requirement is the SUBMIT GATE: `FormButton` enables on `isValid`, which
 * has to be recomputed per keystroke (`mode: 'onChange'`), and tier 1 has no per-keystroke
 * validity. The second reason is the language: zod's messages have to come from the
 * dictionary, which means a schema built per render rather than a module constant.
 *
 * IT TAKES A `locale`, NOT A `Dictionary`. A dictionary is an object of FUNCTIONS, and
 * functions cannot cross the server/client boundary — passing one would fail at
 * serialization. `@/common/i18n` is client-safe by design (plain tables, no DOM, no
 * `server-only`), so this leaf builds its own, exactly as `(site)/error.tsx` does.
 *
 * ERRORS ARE BOUND, NEVER TOASTED BLINDLY: a form-level sentence cannot tell the reader
 * WHICH input to fix. And every branch below is on `status` — never on message text, which
 * would work in one language and silently stop matching in the other.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormButton, FormInput, FormTextarea } from '@/common/components/form';
import { applyFieldErrors } from '@/common/hooks/applyFieldErrors';
import { fieldErrors } from '@/common/errors';
import { getDictionary, type MessageKey } from '@/common/i18n';
import type { Locale } from '@/common/schemas/locale';
import { sendContactMessageAction } from '../actions/contact-message-actions';
import {
  CONTACT_FORM_FIELDS,
  EMPTY_CONTACT_FORM,
  HONEYPOT_FIELD,
  createContactFormSchema,
  type ContactFormValues,
} from '../schemas/contact-form';

/**
 * The localized message for each field the server can name.
 *
 * The action answers 422 with the WIRE schema's messages, which are English by design — a
 * wire schema must not carry copy. Rather than showing them, the form looks the FIELD up
 * here and prints its own sentence. That is the same "branch on which field the backend
 * named" rule as `references/04-actions-and-mutations.md` §5.1, and it is what keeps a
 * Persian page Persian even on the path a real reader can only reach with a crafted POST.
 */
const MESSAGE_KEY_BY_FIELD: Record<(typeof CONTACT_FORM_FIELDS)[number], MessageKey> = {
  name: 'form.errName',
  email: 'form.errEmail',
  subject: 'form.errSubject',
  body: 'form.errMessage',
};

function isKnownField(field: string): field is (typeof CONTACT_FORM_FIELDS)[number] {
  return (CONTACT_FORM_FIELDS as readonly string[]).includes(field);
}

export interface ContactFormProps {
  locale: Locale;
}

export function ContactForm({ locale }: ContactFormProps) {
  const dictionary = getDictionary(locale);
  const { t } = dictionary;

  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(createContactFormSchema(dictionary)),
    // Every field present and non-undefined, so each input is controlled from mount to
    // unmount rather than flipping on the first reset.
    defaultValues: EMPTY_CONTACT_FORM,
    // `onChange`, because `FormButton` gates on `isValid`: with any other mode the button
    // never enables until a first failed submit.
    mode: 'onChange',
  });

  const onSubmit = async (values: ContactFormValues) => {
    setFormMessage(null);
    setSent(false);

    const result = await sendContactMessageAction(values);

    if (result.ok) {
      // A create form, not an edit form: clear it, so a second message starts empty and
      // `isDirty` goes back to false (which re-disables the button).
      form.reset(EMPTY_CONTACT_FORM);
      setSent(true);
      return;
    }

    // 429 — the rate limiter. Its own copy, because "try again" is wrong advice here.
    if (result.status === 429) {
      setFormMessage(t('form.tooMany'));
      return;
    }

    // 422 — validation. Bind what the server named back onto the inputs, in this locale.
    if (result.status === 422) {
      const named = fieldErrors(result);
      const localized = Object.fromEntries(
        Object.entries(named).map(([field, message]) => [
          field,
          isKnownField(field) ? t(MESSAGE_KEY_BY_FIELD[field]) : message,
        ]),
      );
      const first = Object.keys(localized)[0];
      if (first !== undefined) {
        applyFieldErrors(form.setError, localized, CONTACT_FORM_FIELDS, setFormMessage);
        if (isKnownField(first)) form.setFocus(first);
        return;
      }
    }

    // Everything else — a 500, a dropped connection, a schema rejection with nothing
    // bindable. One sentence, in the reader's language.
    setFormMessage(t('form.failed'));
  };

  return (
    <Form {...form}>
      <form
        // `noValidate` so zod's localized messages are the only ones shown, instead of the
        // browser's own bubbles in whatever language it happens to be set to.
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex max-w-[42rem] flex-col gap-5"
      >
        {/*
          Rendered ALWAYS, not conditionally: a live region inserted at the same moment its
          text changes is not announced, because assistive technology has nothing to
          compare against.
        */}
        <p role="status" aria-live="polite" className="text-sm text-t-md">
          {sent ? t('form.sent') : null}
        </p>
        <p role="alert" className="text-sm text-danger">
          {formMessage}
        </p>

        <FormInput<ContactFormValues>
          name="name"
          label={t('form.name')}
          autoComplete="name"
          required
        />
        <FormInput<ContactFormValues>
          name="email"
          type="email"
          label={t('form.email')}
          autoComplete="email"
          // The address is Latin whatever the page's language is, so it keeps its own
          // direction inside the Persian layout — the `.lat` rule from `i18n.css`.
          classNames={{ input: 'lat' }}
          required
        />
        <FormInput<ContactFormValues>
          name="subject"
          label={t('form.subject')}
          autoComplete="off"
          required
        />
        <FormTextarea<ContactFormValues> name="body" label={t('form.message')} rows={7} required />

        {/*
          THE HONEYPOT. Registered directly rather than through the `Form*` tier, which is
          the one place that is right: those wrappers exist to give a control a label and
          aria wiring, and this control must have neither. It is off-screen, out of the tab
          order, hidden from assistive technology, and `autoComplete="off"` keeps a password
          manager from filling it. A bot that fills it gets a cheerful "sent" and no row.
        */}
        <div className="u-sr" aria-hidden="true">
          <label htmlFor="contact-company">Company</label>
          <input
            id="contact-company"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            {...form.register(HONEYPOT_FIELD)}
          />
        </div>

        <FormButton className="self-start">{t('form.send')}</FormButton>
      </form>
    </Form>
  );
}
