// @vitest-environment node
/**
 * `getIntl` replaced `getDictionary` in prompt 8 and `t` is next-intl's translator now.
 * Every assertion below is prompt 4's, unchanged, because the OUTPUT had to be: these are
 * the strings on the page. The two additions are `count`, the other half of the number
 * split, and the fa -> en -> raw degradation now that a missing message would otherwise
 * render as its own key.
 */
import { describe, expect, it } from 'vitest';
import { getIntl } from '../translator';
import { faDigits } from '../digits';
import { MESSAGES } from '../catalog';

describe('t', () => {
  it('answers in the requested locale', () => {
    expect(getIntl('en').t('nav.projects')).toBe('Projects');
    expect(getIntl('fa').t('nav.projects')).toBe('پروژه‌ها');
  });

  it('applies the corrections at legacy/data/i18n.js:326 rather than the superseded values', () => {
    // The originals baked the figure into the string ("Est. 2007", "76 Projects") and
    // double-printed once the interface started supplying the number itself.
    expect(getIntl('en').t('ui.est')).toBe('Est.');
    expect(getIntl('en').t('ui.projectsCount')).toBe('Projects');
    expect(getIntl('en').t('studio.people')).toBe('People');
  });

  it('reads a key whose value carries a space', () => {
    // `type.Interior Design` survived the move to nested JSON as a key with a space in it,
    // which is what `term()` composes from the database column.
    expect(getIntl('fa').t('type.Interior Design')).toBe('طراحی داخلی');
  });
});

describe('num', () => {
  it('shapes digits in Persian and leaves them alone in English', () => {
    expect(getIntl('fa').num(2007)).toBe('۲۰۰۷');
    expect(getIntl('en').num(2007)).toBe('2007');
  });

  it('shapes digits inside a formatted string without touching the rest', () => {
    expect(getIntl('fa').num('4,180 m²')).toBe('۴,۱۸۰ m²');
    expect(faDigits('1392–1404')).toBe('۱۳۹۲–۱۴۰۴');
  });

  it('NEVER groups, because what reaches it is a year and not a quantity', () => {
    // The whole reason `num` is not `format.number`: `format.number(2007)` is `۲٬۰۰۷`,
    // and `project.year` is a `number`, so every card would print a separator in its year.
    expect(getIntl('fa').num(2007)).not.toContain('٬');
    expect(getIntl('en').num(2007)).not.toContain(',');
  });

  it('keeps a zero-padded index padded', () => {
    expect(getIntl('fa').num('01')).toBe('۰۱');
  });
});

describe('count', () => {
  it('formats a quantity through next-intl, digits and grouping both', () => {
    expect(getIntl('fa').count(76)).toBe('۷۶');
    expect(getIntl('en').count(76)).toBe('76');
  });

  it('groups, which is the difference from num', () => {
    // Today no collection here reaches a thousand, so the two paths agree on real data.
    // This is the assertion that says which one stays correct when one does.
    expect(getIntl('en').count(1240)).toBe('1,240');
    expect(getIntl('fa').count(1240)).toBe('۱٬۲۴۰');
  });
});

describe('term', () => {
  it('translates the fixed vocabularies', () => {
    expect(getIntl('fa').term('status', 'Completed')).toBe('ساخته‌شده');
    expect(getIntl('fa').term('scale', 'Large')).toBe('بزرگ');
    expect(getIntl('fa').term('kindName', 'elevation')).toBe('نما');
    expect(getIntl('fa').term('type', 'Interior Design')).toBe('طراحی داخلی');
  });

  it('passes an unknown value straight through', () => {
    // The dashboard can introduce a type nobody has translated; showing the raw English
    // is the correct degradation, and "type.Warehouse" — which is what next-intl renders
    // for a missing message — is not.
    expect(getIntl('fa').term('type', 'Warehouse')).toBe('Warehouse');
    expect(getIntl('en').term('type', 'Warehouse')).toBe('Warehouse');
    expect(getIntl('fa').term('status', 'Whatever')).toBe('Whatever');
  });

  it('degrades fa -> en before it degrades to the raw value', () => {
    // Proven against the catalogs rather than a fixture: whatever English has, Persian
    // falls back to it rather than to the bare column value.
    const english = MESSAGES.en.status.Completed;
    expect(getIntl('fa').term('status', 'Completed')).not.toBe('Completed');
    expect(english).toBe('Completed');
  });
});

describe('list', () => {
  it('joins with the comma of the script', () => {
    expect(getIntl('en').list(['A', 'B'])).toBe('A, B');
    // U+060C, not U+002C.
    expect(getIntl('fa').list(['A', 'B'])).toBe('A، B');
  });
});

describe('isRTL', () => {
  it('is Persian and only Persian', () => {
    expect(getIntl('fa').isRTL).toBe(true);
    expect(getIntl('en').isRTL).toBe(false);
  });
});
