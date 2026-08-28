// src/common/i18n/translator.ts
/**
 * `getIntl(locale)` — the one accessor every render uses for interface copy.
 *
 * IT REPLACED `getDictionary` IN PROMPT 8, and the change is the implementation rather
 * than the shape: `t` is now next-intl's translator over the JSON catalogs in
 * `./messages/`, so plural rules, ICU message arguments, rich text and per-locale number
 * formatting come from a library instead of being grown one special case at a time. The
 * returned object is still plain, synchronous and immutable, which is what keeps the
 * twenty-one call sites and the `dictionary` prop they pass down unchanged.
 *
 * WHY `createTranslator` AND NOT `getTranslations`. `getTranslations` is async and reads
 * the request scope; this app renders the same object in Server Components AND in two
 * client leaves (`(site)/error.tsx`, `ContactForm`), and passes it as a prop into module
 * components that take a locale, not a request. `createTranslator` takes the locale as an
 * ARGUMENT, which is the same reason `getDictionary` took one: two requests for two
 * locales can render in one process at the same moment, and anything module-scoped would
 * leak one visitor's language into another's HTML.
 *
 * WHAT STILL HAS NO SUCCESSOR, deliberately: `prefetchFa`, `loadFa`, `onLang` and the
 * overlay merge at `legacy/js/core/i18n.js:154`. The Persian CONTENT layer was a lazily
 * imported ~60KB module because the static site was one document that had to swap
 * languages in place. Here, content is per-locale columns collapsed by the service, and
 * switching language is a NAVIGATION — so there is nothing to load on demand, nothing to
 * subscribe to, and no overlay to merge. See AGENTS.md.
 */
import { createFormatter, createTranslator } from 'next-intl';
import { RTL_LOCALE, type Locale } from '@/common/schemas/locale';
import { MESSAGES, type Messages } from './catalog';
import { faDigits } from './digits';

/**
 * The fixed vocabularies `term()` translates. Each names a top-level GROUP in the catalog,
 * and each corresponds to a canonical-English column in the database — `status`, `scale`,
 * `types`, `category`, media `type`. Their Persian is interface copy, not content, which
 * is exactly why it lives here and not in 76 rows (AGENTS.md).
 */
export type TermGroup = 'type' | 'status' | 'scale' | 'cat' | 'kind' | 'kindName';

/** Every message path the interface may ask for, as `'<group>.<key>'`. */
export type MessageKey = {
  [G in keyof Messages]: `${G & string}.${keyof Messages[G] & string}`;
}[keyof Messages];

export interface Dictionary {
  readonly locale: Locale;
  /** Persian. Drives `dir`, the `is-fa` class, digit shaping and the list separator. */
  readonly isRTL: boolean;
  /** A known interface string. The key set is closed, so a typo is a type error. */
  t: (key: MessageKey) => string;
  /** Digits in the numeral system of this locale. No grouping — see `getIntl`. */
  num: (value: string | number) => string;
  /** A QUANTITY, formatted by next-intl: locale digits AND locale grouping. */
  count: (value: number) => string;
  /** One of the fixed vocabularies. An unknown value passes straight through. */
  term: (group: TermGroup, value: string) => string;
  /** Join with the comma of this script — U+060C in Persian, U+002C in English. */
  list: (items: readonly string[]) => string;
}

export function getIntl(locale: Locale): Dictionary {
  const isRTL = locale === RTL_LOCALE;
  const t = createTranslator({ locale, messages: MESSAGES[locale] });
  const format = createFormatter({ locale });

  return {
    locale,
    isRTL,

    t: key => t(key),

    /**
     * DIGIT SHAPING ONLY, NEVER GROUPING — and that is the whole reason this is not
     * `format.number`. What reaches `num()` is a year (`project.year` is a `number`), a
     * postcode, a zero-padded column index (`'01'`), or an already-FORMATTED string
     * (`'1,240 m²'`, `'1392–1404'`). A number formatter cannot take the last kind at all,
     * and on the first three it is actively wrong: `format.number(2007)` is `'۲٬۰۰۷'`, so
     * every project card would print its year with a thousands separator in it.
     *
     * `faDigits` is a pure string transform that replaces `0`–`9` and leaves everything
     * else — separators, letters, the `m²` — exactly as it was, which is what lets one
     * function serve all four shapes. See `./digits.ts`.
     */
    num: value => (isRTL ? faDigits(value) : String(value)),

    /**
     * THE OTHER HALF OF THE SPLIT: a genuine QUANTITY — how many projects matched, how
     * many people are on the team — goes through next-intl's formatter, which gets both
     * the locale's digits and its grouping separator (U+066C in Persian) right. Today
     * every collection here is under a hundred, so the two paths agree; the day a count
     * passes a thousand this one is still correct and `num()` would not be.
     */
    count: value => format.number(value),

    /**
     * THE ONE DYNAMIC LOOKUP, and the only place a missing message must not be an error.
     * `t()` above cannot need this — the catalog types prove every static key exists in
     * both locales — but `term()`'s argument comes from a DATABASE COLUMN: the dashboard
     * can introduce a project type nobody has translated.
     *
     * next-intl renders the KEY for a message it cannot find, which would put the literal
     * string `type.Warehouse` on a public page, so the lookup goes at the catalogs
     * directly and degrades fa -> en -> the raw value. Showing the raw English is the
     * correct degradation; blanking the field or throwing is not.
     */
    term: (group, value) => {
      const table = MESSAGES[locale][group] as Record<string, string | undefined>;
      const english = MESSAGES.en[group] as Record<string, string | undefined>;
      return table[value] ?? english[value] ?? value;
    },

    list: items => items.join(isRTL ? '، ' : ', '),
  };
}
