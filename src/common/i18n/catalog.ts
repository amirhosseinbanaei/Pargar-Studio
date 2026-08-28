// src/common/i18n/catalog.ts
/**
 * The two message catalogs, loaded from JSON, plus the type that makes a missing Persian
 * string a COMPILE error.
 *
 * WHAT REPLACED WHAT. Until prompt 8 this was `messages.ts`, a 411-line TypeScript object
 * with `en` as the source of keys and `fa` typed as a total record over them. next-intl
 * owns the dictionary now and reads JSON, so the strings moved to `./messages/*.json` —
 * verbatim, key for key, with no renaming and no regrouping. This file is the loader, not
 * a second copy: `./messages/en.json` is the only place an English string is written.
 *
 * KEYS ARE NESTED HERE AND FLAT AT THE CALL SITE, and that is not a rename. next-intl
 * addresses a message by a dotted PATH, so `{"nav": {"projects": …}}` is asked for as
 * `t('nav.projects')` — the exact string the old flat table used as its key. Every key the
 * ported stylesheets, the shell module and the projects module name is unchanged, and the
 * `<group>.<value>` shape `term()` builds from a database column still resolves.
 *
 * DO NOT RENAME A KEY. The keys are not an internal detail — `translator.ts`'s `term()`
 * composes them from a database column, and the ported CSS and the shell module name them
 * directly. Renaming one here is a repo-wide rename, not a local edit.
 *
 * Numbers stay in LATIN digits in both catalogs, exactly as they do in the database. See
 * `./digits.ts` for why conversion happens at render time and nowhere else.
 */
import type { Locale } from '@/common/schemas/locale';
import en from './messages/en.json';
import fa from './messages/fa.json';

/**
 * English is the SOURCE OF KEYS, as it was before the move to JSON. Every group and every
 * key in it is required of Persian below.
 */
export type Messages = typeof en;

/**
 * THE TOTAL-RECORD CHECK, and the reason it is an annotated `const` rather than a plain
 * re-export. Assigning `fa.json` to `Messages` makes a key present in `en.json` and absent
 * from `fa.json` fail `npm run typecheck`, which is the property the old
 * `Record<MessageKey, string>` on `messages.ts:239` bought and a bare pair of JSON files
 * does not. Deleting a Persian string is a build failure, not a silent English fallback on
 * a Persian page.
 *
 * The reverse — an EXTRA Persian key nothing renders — is invisible to this check, because
 * excess-property checking does not apply to a variable assignment. `__tests__/catalog.test.ts`
 * covers that direction.
 */
const faMessages: Messages = fa;

/** The two catalogs, keyed by locale. */
export const MESSAGES: Readonly<Record<Locale, Messages>> = { en, fa: faMessages };

/**
 * Tells next-intl what this app's messages and locales are, so `t('nav.projects')` is
 * checked against the catalog and `t('nav.projcts')` is a type error. Augmenting
 * `next-intl` rather than declaring a global `IntlMessages` is the v4 spelling — the
 * interface lives in `use-intl/core` and next-intl re-exports it.
 */
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
