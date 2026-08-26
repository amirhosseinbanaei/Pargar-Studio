// src/modules/dashboard/components/ContactForm.tsx
/**
 * The contact editor. One row, one form, one submit — see `schemas/contact-form.ts`.
 */
'use client';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormInput } from '@/common/components/form';
import type { ContactRow } from '@/common/schemas/contact';
import { updateContactAction } from '../actions/contact-actions';
import {
  CONTACT_FORM_FIELDS,
  CONTACT_LOCALE_FIELDS,
  contactFormSchema,
  toContactFormValues,
  type ContactFormValues,
} from '../schemas/contact-form';
import { RecordForm } from './RecordForm';
import { LocaleFieldPair } from './LocaleFieldPair';
import { RepeatableGroupField } from './RepeatableGroupField';

const SOCIAL_COLUMNS = [
  { key: 'name', label: 'Platform' },
  { key: 'handle', label: 'Handle' },
] as const;

export interface ContactFormProps {
  contact: ContactRow;
}

export function ContactForm({ contact }: ContactFormProps) {
  const router = useRouter();

  return (
    <div className="flex max-w-[64rem] flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-fs-xl tracking-tight-kavan text-t-hi uppercase">Contact</h1>
        <p className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">
          contact · one record, saved as a whole
        </p>
      </header>

      <RecordForm<ContactFormValues, void>
        resolver={zodResolver(contactFormSchema)}
        defaultValues={toContactFormValues(contact)}
        fields={CONTACT_FORM_FIELDS}
        submitLabel="Save changes"
        successMessage="Saved. /contact is already showing it, in both languages."
        resetToSubmitted
        onSave={values => updateContactAction(values)}
        onSaved={() => router.refresh()}
      >
        <section className="flex flex-col gap-5">
          <h2 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">
            Address block — shared, not per-locale
          </h2>
          <p className="text-fs-xs tracking-flat-kavan text-t-xlo">
            A postcode or an email address translated per locale is a second value that can drift
            from the real one, so these six are one column each.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <FormInput<ContactFormValues> name="postcode" label="Postcode" />
            <FormInput<ContactFormValues> name="phone" label="Phone (display)" />
            <FormInput<ContactFormValues>
              name="phoneHref"
              label="Phone (tel: target)"
              description="Digits only, optionally a leading +."
              classNames={{ input: 'font-mono' }}
            />
            <FormInput<ContactFormValues> name="email" label="Email" type="email" />
            <FormInput<ContactFormValues> name="press" label="Press email" type="email" />
            <FormInput<ContactFormValues>
              name="lat"
              label="Latitude"
              classNames={{ input: 'font-mono' }}
            />
            <FormInput<ContactFormValues>
              name="lng"
              label="Longitude"
              classNames={{ input: 'font-mono' }}
            />
          </div>
        </section>

        <section className="flex flex-col gap-6 border-t border-rule pt-8">
          <div className="flex flex-col gap-1">
            <h2 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">Content</h2>
            <p className="text-fs-xs tracking-flat-kavan text-t-xlo">
              English on the left, Persian on the right. A Persian field left empty is stored as its
              English counterpart, so the Persian page never renders blank.
            </p>
          </div>

          {CONTACT_LOCALE_FIELDS.map(field => (
            <LocaleFieldPair<ContactFormValues>
              key={field.en}
              label={field.label}
              en={field.en}
              fa={field.fa}
              multiline={field.multiline}
              rows={'rows' in field ? field.rows : undefined}
            />
          ))}
        </section>

        <section className="flex flex-col gap-6 border-t border-rule pt-8">
          <h2 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">Socials</h2>
          <p className="text-fs-xs tracking-flat-kavan text-t-xlo">
            Rendered as text, not links — the record carries a platform name and a handle but no
            URL, and a guessed link can go somewhere wrong.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <RepeatableGroupField<ContactFormValues>
              name="socialsEn"
              label="Socials · English"
              columns={SOCIAL_COLUMNS}
              emptyRow={{ name: '', handle: '' }}
              itemLabel="Social"
            />
            <RepeatableGroupField<ContactFormValues>
              name="socialsFa"
              label="Socials · Persian"
              columns={SOCIAL_COLUMNS}
              emptyRow={{ name: '', handle: '' }}
              itemLabel="Social"
              dir="rtl"
              lang="fa"
            />
          </div>
        </section>
      </RecordForm>
    </div>
  );
}
