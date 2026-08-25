// src/common/i18n/index.ts
/**
 * The i18n foundation: two dictionaries, one accessor, one digit shaper.
 *
 * Import `@/common/i18n` and nothing deeper. `getDictionary(locale)` is the whole runtime
 * surface — there is no ambient language state to read, set or subscribe to, because the
 * locale is a URL segment and every render receives it as a parameter.
 *
 * This module is SERVER-SAFE AND CLIENT-SAFE: no `server-only`, no DOM. Client leaves that
 * need copy (the Tehran clock, the shell transition's announcements) take the strings they
 * need as props from a Server Component, or call `getDictionary` themselves — the tables
 * are plain objects and cost a few KB, not a fetch.
 */
export { getDictionary, type Dictionary, type TermGroup } from './translator';
export { faDigits, DIGITS_FA } from './digits';
export { en, fa, MESSAGES, type MessageKey } from './messages';
