// src/modules/dashboard/schemas/contact-form.ts
/**
 * The contact editor's contract — the second singleton, and the one with the fields that
 * are not prose. `email`, `press`, `phoneHref`, `lat` and `lng` are FUNCTIONAL: an invalid
 * one does not just read oddly, it breaks a `mailto:`/`tel:` link or draws the site plan's
 * pin in the wrong place. So, unlike every prose field in this module, these keep the exact
 * format constraints `common/schemas/contact.ts`'s write schema already carries — mirrored
 * here rather than imported, because that schema is `.partial()`-shaped for a PATCH body
 * and this one carries user-facing copy for `zodResolver`, and the two must still agree on
 * what they accept (`__tests__/schema-agreement`-style test, one per resource).
 *
 * ─── ONE SUBMIT FOR THE WHOLE RECORD ──────────────────────────────────────────────
 * Same resolved decision as `studio-form.ts`, for the same reason: `/contact` is read as
 * one page, and a partial save could show the new address beside numbers that were never
 * meant to be seen together.
 */
import { z } from 'zod';
import type { ContactRow, ContactUpdate } from '@/common/schemas/contact';
import {
  galleryField,
  imagePathField,
  requireAltWithImage,
  requireTranslatedList,
  toGalleryColumns,
  toGalleryFormItems,
  toNullableAlt,
  toNullablePath,
} from './image';

const PHONE_HREF_PATTERN = /^\+?\d+$/;
const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

const socialFormSchema = z.object({ name: z.string(), handle: z.string() });

/* ────────────────────────────────────────────────────────────────────────────────
   The form schema — carries copy
   ──────────────────────────────────────────────────────────────────────────────── */

export const contactFormSchema = z
  .object({
    postcode: z.string(),
    phone: z.string(),
    phoneHref: z.string().regex(PHONE_HREF_PATTERN, 'Digits only, optionally a leading +.'),
    email: z.email('Enter a valid email address.'),
    press: z.email('Enter a valid email address.'),
    lat: z.string().regex(DECIMAL_PATTERN, 'Enter a decimal, e.g. 35.8112.'),
    lng: z.string().regex(DECIMAL_PATTERN, 'Enter a decimal, e.g. 51.4383.'),

    addressEn: z.string(),
    addressFa: z.string(),
    districtEn: z.string(),
    districtFa: z.string(),
    cityEn: z.string(),
    cityFa: z.string(),
    countryEn: z.string(),
    countryFa: z.string(),
    hoursEn: z.string(),
    hoursFa: z.string(),
    careersEn: z.string(),
    careersFa: z.string(),

    socialsEn: z.array(socialFormSchema),
    socialsFa: z.array(socialFormSchema),

    /**
     * PICTURES (prompt 14). The cover fills the hero band at the top of `/contact` and the
     * first gallery image fills the site-plan slot beside the address — two boxes that held
     * drawings seeded from constants until this prompt, and therefore said nothing about
     * this studio in particular.
     */
    coverImage: imagePathField,
    coverAltEn: z.string(),
    coverAltFa: z.string(),
    gallery: galleryField,
  })
  .superRefine((values, ctx) => {
    requireAltWithImage(values, ctx);
    requireTranslatedList(values.socialsEn, values.socialsFa, ctx, 'socialsFa', 'socials');
  });

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export const CONTACT_FORM_FIELDS = [
  'postcode',
  'phone',
  'phoneHref',
  'email',
  'press',
  'lat',
  'lng',
  'addressEn',
  'addressFa',
  'districtEn',
  'districtFa',
  'cityEn',
  'cityFa',
  'countryEn',
  'countryFa',
  'hoursEn',
  'hoursFa',
  'careersEn',
  'careersFa',
  'socialsEn',
  'socialsFa',
  'coverImage',
  'coverAltEn',
  'coverAltFa',
  'gallery',
] as const satisfies ReadonlyArray<keyof ContactFormValues>;

export function toContactFormValues(row: ContactRow): ContactFormValues {
  return {
    postcode: row.postcode,
    phone: row.phone,
    phoneHref: row.phoneHref,
    email: row.email,
    press: row.press,
    lat: row.lat,
    lng: row.lng,
    addressEn: row.addressEn,
    addressFa: row.addressFa,
    districtEn: row.districtEn,
    districtFa: row.districtFa,
    cityEn: row.cityEn,
    cityFa: row.cityFa,
    countryEn: row.countryEn,
    countryFa: row.countryFa,
    hoursEn: row.hoursEn,
    hoursFa: row.hoursFa,
    careersEn: row.careersEn,
    careersFa: row.careersFa,
    socialsEn: row.socialsEn,
    socialsFa: row.socialsFa,
    // `?? ''` — nullable columns, and a controlled input handed `null` mounts uncontrolled.
    coverImage: row.coverImage ?? '',
    coverAltEn: row.coverAltEn,
    coverAltFa: row.coverAltFa,
    gallery: toGalleryFormItems(row.galleryEn, row.galleryFa),
  };
}

/* ────────────────────────────────────────────────────────────────────────────────
   The submission schema — carries no copy, same bounds as the form
   ──────────────────────────────────────────────────────────────────────────────── */

export const contactSubmissionSchema = z
  .strictObject({
    postcode: z.string(),
    phone: z.string(),
    phoneHref: z.string().regex(PHONE_HREF_PATTERN),
    email: z.email(),
    press: z.email(),
    lat: z.string().regex(DECIMAL_PATTERN),
    lng: z.string().regex(DECIMAL_PATTERN),

    addressEn: z.string(),
    addressFa: z.string(),
    districtEn: z.string(),
    districtFa: z.string(),
    cityEn: z.string(),
    cityFa: z.string(),
    countryEn: z.string(),
    countryFa: z.string(),
    hoursEn: z.string(),
    hoursFa: z.string(),
    careersEn: z.string(),
    careersFa: z.string(),

    socialsEn: z.array(socialFormSchema),
    socialsFa: z.array(socialFormSchema),

    /** Same three plus the list — see the form schema. */
    coverImage: imagePathField,
    coverAltEn: z.string(),
    coverAltFa: z.string(),
    gallery: galleryField,
  })
  .superRefine((values, ctx) => {
    requireAltWithImage(values, ctx);
    requireTranslatedList(values.socialsEn, values.socialsFa, ctx, 'socialsFa', 'socials');
  });

export type ContactSubmission = z.output<typeof contactSubmissionSchema>;

/** The parsed submission -> the write payload. Nothing is copied between locales; see
 *  `project-form.ts`'s `toProjectColumns`. */
export function toContactColumns(input: ContactSubmission): ContactUpdate {
  return {
    postcode: input.postcode,
    phone: input.phone,
    phoneHref: input.phoneHref,
    email: input.email,
    press: input.press,
    lat: input.lat,
    lng: input.lng,
    addressEn: input.addressEn,
    addressFa: input.addressFa,
    districtEn: input.districtEn,
    districtFa: input.districtFa,
    cityEn: input.cityEn,
    cityFa: input.cityFa,
    countryEn: input.countryEn,
    countryFa: input.countryFa,
    hoursEn: input.hoursEn,
    hoursFa: input.hoursFa,
    careersEn: input.careersEn,
    careersFa: input.careersFa,
    socialsEn: input.socialsEn,
    socialsFa: input.socialsFa,

    /** ALT TEXT IS NOT FALLEN BACK — see `./image`'s header. */
    coverImage: toNullablePath(input.coverImage),
    coverAltEn: toNullableAlt(input.coverAltEn),
    coverAltFa: toNullableAlt(input.coverAltFa),
    ...toGalleryColumns(input.gallery),
  };
}

/* ────────────────────────────────────────────────────────────────────────────────
   Layout metadata
   ──────────────────────────────────────────────────────────────────────────────── */

export const CONTACT_LOCALE_FIELDS = [
  { label: 'Address', en: 'addressEn', fa: 'addressFa', multiline: true, rows: 2 },
  { label: 'District', en: 'districtEn', fa: 'districtFa', multiline: false },
  { label: 'City', en: 'cityEn', fa: 'cityFa', multiline: false },
  { label: 'Country', en: 'countryEn', fa: 'countryFa', multiline: false },
  { label: 'Hours', en: 'hoursEn', fa: 'hoursFa', multiline: false },
  { label: 'Careers', en: 'careersEn', fa: 'careersFa', multiline: true, rows: 3 },
] as const satisfies ReadonlyArray<{
  label: string;
  en: keyof ContactFormValues;
  fa: keyof ContactFormValues;
  multiline: boolean;
  rows?: number;
  required?: boolean;
}>;
