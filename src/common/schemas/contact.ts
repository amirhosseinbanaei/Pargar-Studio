// src/common/schemas/contact.ts
/**
 * Contracts for the `contact` singleton — the editable CONTENT of the public contact page
 * (`legacy/data/studio.js:165`), not the inbox. The inbox is `./contact-message`.
 *
 * ─── WHICH FIELDS ARE PER-LOCALE ──────────────────────────────────────────────────
 * Mirrored from `legacy/data/studio.fa.js:109`, not guessed. `CONTACT_FA` translates
 * exactly seven fields: `address`, `district`, `city`, `country`, `hours`, `socials` and
 * `careers`. Everything else — the postcode, both phone spellings, both email addresses
 * and the coordinates — is one shared column, because a second copy of an email address is
 * a second value that can drift from the real one.
 *
 * `socials` is per-locale despite being structured data: the Persian layer translates the
 * platform NAMES (`اینستاگرام`, `دیویزاره`) and keeps the handles identical.
 *
 * `careers` is stored even though it was not named in the table sketch this file was built
 * from: it exists in both `CONTACT` and `CONTACT_FA`, and dropping it would lose a
 * paragraph of live Persian copy.
 */
import { z } from 'zod';
import { jsonArray, looseString } from './helpers';
import { pickLocale, type Locale } from './locale';

export const CONTACT_ID = 1;

export const socialSchema = z.object({
  name: looseString,
  handle: looseString,
});

export type Social = z.infer<typeof socialSchema>;

/* ── READ ─────────────────────────────────────────────────────────────────────── */

export const contactRowSchema = z.object({
  id: z.number(),

  postcode: looseString,
  phone: looseString,
  phoneHref: looseString,
  email: looseString,
  press: looseString,
  /**
   * Strings, matching the column type. The value is an exact decimal someone typed; a
   * float round-trip turns `35.8112` into `35.811199999999999` in a map URL.
   */
  lat: looseString,
  lng: looseString,

  addressEn: looseString,
  addressFa: looseString,
  districtEn: looseString,
  districtFa: looseString,
  cityEn: looseString,
  cityFa: looseString,
  countryEn: looseString,
  countryFa: looseString,
  hoursEn: looseString,
  hoursFa: looseString,
  careersEn: looseString,
  careersFa: looseString,
  socialsEn: jsonArray(socialSchema),
  socialsFa: jsonArray(socialSchema),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ContactRow = z.infer<typeof contactRowSchema>;

/* ── LOCALE MAPPER ────────────────────────────────────────────────────────────── */

export function toLocaleContact(row: ContactRow, locale: Locale) {
  return {
    postcode: row.postcode,
    phone: row.phone,
    phoneHref: row.phoneHref,
    email: row.email,
    press: row.press,
    lat: row.lat,
    lng: row.lng,
    address: pickLocale(locale, row.addressEn, row.addressFa),
    district: pickLocale(locale, row.districtEn, row.districtFa),
    city: pickLocale(locale, row.cityEn, row.cityFa),
    country: pickLocale(locale, row.countryEn, row.countryFa),
    hours: pickLocale(locale, row.hoursEn, row.hoursFa),
    careers: pickLocale(locale, row.careersEn, row.careersFa),
    socials: pickLocale(locale, row.socialsEn, row.socialsFa),
  };
}

export type Contact = ReturnType<typeof toLocaleContact>;

/* ── WRITE ────────────────────────────────────────────────────────────────────── */

const socialWriteSchema = z.strictObject({
  name: z.string().min(1),
  handle: z.string().min(1),
});

export const contactUpdateSchema = z
  .strictObject({
    postcode: z.string(),
    phone: z.string(),
    /** Digits and a leading `+` only — it is a `tel:` target, not a display string. */
    phoneHref: z.string().regex(/^\+?\d+$/, 'digits only, optionally leading +'),
    email: z.email(),
    press: z.email(),
    lat: z.string().regex(/^-?\d+(\.\d+)?$/, 'expected a decimal'),
    lng: z.string().regex(/^-?\d+(\.\d+)?$/, 'expected a decimal'),

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
    socialsEn: z.array(socialWriteSchema),
    socialsFa: z.array(socialWriteSchema),
  })
  .partial();

export type ContactUpdate = z.infer<typeof contactUpdateSchema>;

export const contactCreateSchema = contactUpdateSchema.required();

export type ContactCreate = z.infer<typeof contactCreateSchema>;
