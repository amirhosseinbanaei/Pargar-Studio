// @vitest-environment node
/**
 * `shared.ts` is the one place the year bounds and the Persian-fallback rule are
 * implemented; every resource this prompt adds (design works, media, studio, contact)
 * imports these functions rather than re-deriving them. Testing them once here is what
 * makes it safe to trust every resource's schema test to cover only what is specific to
 * that resource.
 */
import { describe, expect, it } from 'vitest';
import { fallbackList, fallbackText, yearFieldAsNumber, yearFieldAsString } from '../shared';

describe('fallbackText', () => {
  it('fills an empty Persian value with the English one', () => {
    expect(fallbackText('', 'Kavan Studio')).toBe('Kavan Studio');
  });

  it('leaves a real Persian value alone, including zero-width characters', () => {
    const withZwnj = 'خانه‌ها';
    expect(fallbackText(withZwnj, 'Houses')).toBe(withZwnj);
  });

  it('treats whitespace-only as empty', () => {
    expect(fallbackText('   \n ', 'English')).toBe('English');
  });
});

describe('fallbackList', () => {
  it('duplicates the English array wholesale when the Persian one is empty', () => {
    expect(fallbackList([], ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('leaves a non-empty Persian array alone, even if shorter than the English one', () => {
    expect(fallbackList(['یک'], ['one', 'two'])).toEqual(['یک']);
  });

  it('returns a new array, never the caller’s own reference', () => {
    const en = ['a'];
    const result = fallbackList([], en);
    expect(result).toEqual(en);
    expect(result).not.toBe(en);
  });
});

describe('yearFieldAsString / yearFieldAsNumber agree with each other', () => {
  const string = yearFieldAsString(1900, 2200);
  const number = yearFieldAsNumber(1900, 2200);

  const cases: Array<[string, unknown]> = [
    ['a valid year', '2021'],
    ['the minimum', '1900'],
    ['below the minimum', '1899'],
    ['the maximum', '2200'],
    ['above the maximum', '2201'],
    ['an empty string', ''],
    ['a decimal', '2021.5'],
    ['non-numeric text', 'MMXXI'],
  ];

  for (const [name, value] of cases) {
    it(`judges ${name} the same way on both sides`, () => {
      expect(string.safeParse(value).success).toBe(number.safeParse(value).success);
    });
  }

  it('never coerces an empty year to 0', () => {
    // z.coerce.number() would turn '' into 0, which then passes the >=1900 check for the
    // wrong reason. The explicit regex in `yearFieldAsNumber` rejects it outright.
    expect(number.safeParse('').success).toBe(false);
  });

  it('accepts an already-numeric year on the submission side', () => {
    expect(number.safeParse(2021).success).toBe(true);
    expect(number.parse(2021)).toBe(2021);
  });

  it('converts a string year to a number on the submission side', () => {
    expect(number.parse('2021')).toBe(2021);
  });
});
