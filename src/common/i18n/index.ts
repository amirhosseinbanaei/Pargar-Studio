// src/common/i18n/index.ts
/**
 * The i18n foundation: next-intl, two JSON catalogs, one accessor, one digit shaper.
 *
 * Import `@/common/i18n` and nothing deeper, except for `./routing` (which `src/proxy.ts`
 * needs without pulling in any React API) and `./navigation` (whose `Link` and
 * `usePathname` are React APIs). `getIntl(locale)` is the whole copy surface — there is no
 * ambient language state to read, set or subscribe to, because the locale is a URL segment
 * and every render receives it as a parameter.
 *
 * This module is SERVER-SAFE AND CLIENT-SAFE: no `server-only`, no DOM, no request scope.
 * `getIntl` builds a next-intl translator over the catalogs from an explicit locale, so
 * the two client leaves that need copy — `(site)/error.tsx` and `ContactForm` — can call
 * it directly instead of receiving an object of functions across the boundary, which is
 * not serializable.
 */
export { getIntl, type Dictionary, type MessageKey, type TermGroup } from './translator';
export { faDigits, DIGITS_FA } from './digits';
export { MESSAGES, type Messages } from './catalog';
