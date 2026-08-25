// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getDictionary } from '../translator';
import { faDigits } from '../digits';
import { en, fa } from '../messages';

describe('the dictionaries', () => {
  it('carry exactly the same key set', () => {
    // A missing Persian key is a type error at compile time; this catches the reverse —
    // an extra Persian key nothing renders, which the type system cannot see.
    expect(Object.keys(fa).sort()).toEqual(Object.keys(en).sort());
  });

  it('keeps numbers in Latin digits, as the database does', () => {
    // Conversion happens at render time and nowhere else; a shaped numeral in a stored
    // string cannot be searched, sorted or compared.
    for (const value of Object.values(fa)) expect(value).not.toMatch(/[۰-۹]/);
  });
});

describe('t', () => {
  it('answers in the requested locale', () => {
    expect(getDictionary('en').t('nav.projects')).toBe('Projects');
    expect(getDictionary('fa').t('nav.projects')).toBe('پروژه‌ها');
  });

  it('applies the corrections at legacy/data/i18n.js:326 rather than the superseded values', () => {
    // The originals baked the figure into the string ("Est. 2007", "76 Projects") and
    // double-printed once the interface started supplying the number itself.
    expect(getDictionary('en').t('ui.est')).toBe('Est.');
    expect(getDictionary('en').t('ui.projectsCount')).toBe('Projects');
    expect(getDictionary('en').t('studio.people')).toBe('People');
  });
});

describe('num', () => {
  it('shapes digits in Persian and leaves them alone in English', () => {
    expect(getDictionary('fa').num(2007)).toBe('۲۰۰۷');
    expect(getDictionary('en').num(2007)).toBe('2007');
  });

  it('shapes digits inside a formatted string without touching the rest', () => {
    expect(getDictionary('fa').num('4,180 m²')).toBe('۴,۱۸۰ m²');
    expect(faDigits('1392–1404')).toBe('۱۳۹۲–۱۴۰۴');
  });
});

describe('term', () => {
  it('translates the fixed vocabularies', () => {
    expect(getDictionary('fa').term('status', 'Completed')).toBe('ساخته‌شده');
    expect(getDictionary('fa').term('scale', 'Large')).toBe('بزرگ');
    expect(getDictionary('fa').term('kindName', 'elevation')).toBe('نما');
  });

  it('passes an unknown value straight through', () => {
    // The dashboard can introduce a type nobody has translated; showing the raw English
    // is the correct degradation, and "type.Warehouse" is not.
    expect(getDictionary('fa').term('type', 'Warehouse')).toBe('Warehouse');
    expect(getDictionary('en').term('type', 'Warehouse')).toBe('Warehouse');
  });
});

describe('list', () => {
  it('joins with the comma of the script', () => {
    expect(getDictionary('en').list(['A', 'B'])).toBe('A, B');
    // U+060C, not U+002C.
    expect(getDictionary('fa').list(['A', 'B'])).toBe('A، B');
  });
});

describe('isRTL', () => {
  it('is Persian and only Persian', () => {
    expect(getDictionary('fa').isRTL).toBe(true);
    expect(getDictionary('en').isRTL).toBe(false);
  });
});
