// @vitest-environment node
/**
 * The two catalog invariants that the TYPE system cannot see.
 *
 * A key present in `en.json` and missing from `fa.json` is a compile error — `catalog.ts`
 * annotates the Persian import as `Messages`, so `npm run typecheck` fails. This file
 * covers the two directions that check cannot: an EXTRA Persian key nothing renders
 * (excess-property checking does not apply to a variable assignment), and a Persian
 * numeral that has been baked into a stored string.
 *
 * These moved here from `translator.test.ts` when `messages.ts` became JSON.
 */
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../catalog';

/** Every `'<group>.<key>'` path in a catalog, sorted. */
function paths(catalog: Record<string, Record<string, string>>): string[] {
  return Object.entries(catalog)
    .flatMap(([group, entries]) => Object.keys(entries).map(key => `${group}.${key}`))
    .sort();
}

describe('the catalogs', () => {
  it('carry exactly the same key set', () => {
    expect(paths(MESSAGES.fa)).toEqual(paths(MESSAGES.en));
  });

  it('keeps numbers in Latin digits, as the database does', () => {
    // Conversion happens at render time and nowhere else; a shaped numeral in a stored
    // string cannot be searched, sorted or compared. See `../digits.ts`.
    for (const group of Object.values(MESSAGES.fa)) {
      for (const value of Object.values(group)) expect(value).not.toMatch(/[۰-۹]/);
    }
  });

  it('keeps the `<group>.<value>` shape term() composes from a database column', () => {
    // `translator.ts`'s `term()` builds `type.Residential` from a row's `types` column, so
    // these group names are load-bearing rather than cosmetic. Renaming one is a
    // repo-wide edit, not a local tidy-up.
    for (const group of ['type', 'status', 'scale', 'cat', 'kind', 'kindName']) {
      expect(MESSAGES.en).toHaveProperty(group);
      expect(MESSAGES.fa).toHaveProperty(group);
    }
    expect(MESSAGES.en.status).toHaveProperty('Under Construction');
  });

  it('contains no ICU-significant characters it does not mean', () => {
    // next-intl parses every message as ICU MessageFormat, where `{`, `}` and a lone `'`
    // are syntax. No message here takes an argument, so any of them would be a silent
    // parse failure rather than the string an author intended.
    for (const catalog of Object.values(MESSAGES)) {
      for (const group of Object.values(catalog)) {
        for (const value of Object.values(group)) expect(value).not.toMatch(/[{}']/);
      }
    }
  });
});
