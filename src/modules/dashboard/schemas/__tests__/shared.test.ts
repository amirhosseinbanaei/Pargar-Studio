// @vitest-environment node
/**
 * `shared.ts` is the one place the year bounds are implemented; design works and media both
 * import them rather than re-deriving them. Testing them once here is what makes it safe to
 * trust every resource's schema test to cover only what is specific to that resource.
 *
 * ─── THE `fallbackText` / `fallbackList` SUITES WENT WITH THE FUNCTIONS (prompt 14) ─
 * Both helpers implemented "duplicate English into an empty Persian column on save", the
 * decision prompt 14 reverses, and both are deleted. What replaced them is tested where it
 * lives rather than here: `./image.test.ts` pins that a Persian value is never copied and
 * that an empty required one is refused, and `requireTranslatedList` — the rule that makes
 * removing `fallbackList` safe — is pinned there too.
 */
import { describe, expect, it } from 'vitest';
import { yearFieldAsNumber, yearFieldAsString } from '../shared';

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
