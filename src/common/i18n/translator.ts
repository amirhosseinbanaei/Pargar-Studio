// src/common/i18n/translator.ts
/**
 * `getDictionary(locale)` — the one accessor every server render uses for interface copy.
 *
 * It replaces the legacy module-level language SINGLETON (`legacy/js/core/i18n.js:61`).
 * That singleton was correct for a single-document static site and is actively wrong here:
 * two requests for two locales can be rendering in the same process at the same moment, so
 * a module-scoped `let lang` would let one visitor's language leak into another's HTML.
 * The locale is a URL segment, so it is an ARGUMENT, and the returned object is immutable
 * and request-agnostic.
 *
 * The four helpers are ports of `legacy/js/core/i18n.js` — `t()` at :126, `num()` at :132,
 * `term()` at :138, `list()` at :144 — with their behaviour unchanged.
 *
 * WHAT HAS NO SUCCESSOR, deliberately: `prefetchFa`, `loadFa`, `onLang` and the overlay
 * merge at :154. The Persian CONTENT layer was a lazily-imported ~60KB module because the
 * static site was one document that had to swap languages in place. Here, content is
 * per-locale columns collapsed by the service (`toLocaleProject`), and switching language
 * is a NAVIGATION to the same route under the other locale prefix — so there is nothing to
 * load on demand, nothing to subscribe to, and no overlay to merge. See AGENTS.md.
 */
import { RTL_LOCALE, type Locale } from '@/common/schemas/locale';
import { faDigits } from './digits';
import { MESSAGES, en, type MessageKey } from './messages';

/**
 * The fixed vocabularies `term()` translates. Each names a key PREFIX in the dictionary,
 * and each corresponds to a canonical-English column in the database — `status`, `scale`,
 * `types`, `category`, media `type`. Their Persian is interface copy, not content, which
 * is exactly why it lives here and not in 76 rows (AGENTS.md).
 */
export type TermGroup = 'type' | 'status' | 'scale' | 'cat' | 'kind' | 'kindName';

export interface Dictionary {
  readonly locale: Locale;
  /** Persian. Drives `dir`, the `is-fa` class, digit shaping and the list separator. */
  readonly isRTL: boolean;
  /** A known interface string. The key set is closed, so a typo is a type error. */
  t: (key: MessageKey) => string;
  /** Digits in the numeral system of this locale. */
  num: (value: string | number) => string;
  /** One of the fixed vocabularies. An unknown value passes straight through. */
  term: (group: TermGroup, value: string) => string;
  /** Join with the comma of this script — U+060C in Persian, U+002C in English. */
  list: (items: readonly string[]) => string;
}

export function getDictionary(locale: Locale): Dictionary {
  const isRTL = locale === RTL_LOCALE;
  const table: Readonly<Record<string, string | undefined>> = MESSAGES[locale];

  /**
   * The dynamic lookup, and the ONLY place the legacy fa -> en -> key degradation still
   * applies. `t()` above cannot need it — `fa` is a total record over `MessageKey`, so the
   * compiler already proved every static key exists in both tables. This path exists for
   * `term()`, whose argument comes from a DATABASE COLUMN: the dashboard can introduce a
   * project type nobody has translated, and showing the raw English value is the correct
   * degradation. Blanking the field or throwing is not.
   */
  const lookup = (key: string): string => table[key] ?? (en as Record<string, string>)[key] ?? key;

  return {
    locale,
    isRTL,
    t: key => lookup(key),
    num: value => (isRTL ? faDigits(value) : String(value)),
    term: (group, value) => {
      const key = `${group}.${value}`;
      const translated = lookup(key);
      // `lookup` returns the key itself when nothing matched, which is the signal that
      // this value has no entry — hand back the raw value rather than "type.Warehouse".
      return translated === key ? value : translated;
    },
    list: items => items.join(isRTL ? '، ' : ', '),
  };
}
