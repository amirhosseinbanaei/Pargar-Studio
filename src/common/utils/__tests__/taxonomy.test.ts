// @vitest-environment node
/**
 * The rule the public filter rails degrade by.
 *
 * It is the one piece of prompt 9 that is easy to get subtly wrong in a way nothing else in
 * the gate would notice: an option list that silently drops a value makes a whole set of
 * records unreachable, and the only symptom is a filter that is simply not there. Pure, so
 * it needs no database and no React tree.
 */
import { describe, expect, it } from 'vitest';
import { optionsForAxis, withCurrentValues } from '../taxonomy';
import type { TaxonomyTermRow } from '@/common/schemas/taxonomy';

const term = (value: string, overrides: Partial<TaxonomyTermRow> = {}): TaxonomyTermRow => ({
  id: 1,
  subject: 'project',
  axis: 'status',
  value,
  labelEn: value,
  labelFa: `fa:${value}`,
  sortOrder: 0,
  visible: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

describe('optionsForAxis', () => {
  const terms = [
    term('Completed', { id: 1, sortOrder: 0 }),
    term('Under Construction', { id: 2, sortOrder: 1 }),
    term('Concept', { id: 3, sortOrder: 2 }),
  ];

  it('keeps the terms’ own order, not alphabetical order', () => {
    // The seeded order is the legacy one and is deliberate — `Completed` before `Concept`.
    // Sorting alphabetically here is the mistake that would silently reorder every rail.
    const options = optionsForAxis(terms, ['Concept', 'Completed', 'Under Construction'], 'en');
    expect(options.map(option => option.value)).toEqual([
      'Completed',
      'Under Construction',
      'Concept',
    ]);
  });

  it('offers only terms some row actually uses', () => {
    // An option beside a zero is a filter that matches nothing — the failure the derived
    // taxonomy existed to prevent, and one an editable term list must not reintroduce.
    const options = optionsForAxis(terms, ['Completed']);
    expect(options.map(option => option.value)).toEqual(['Completed']);
  });

  it('APPENDS a value no term declares rather than dropping it', () => {
    // The whole degradation. A project whose status has no term must stay filterable; a
    // value that vanishes from every rail is a set of records nobody can reach.
    const options = optionsForAxis(terms, ['Completed', 'Mothballed']);
    expect(options.map(option => option.value)).toEqual(['Completed', 'Mothballed']);
  });

  it('marks an undeclared value with a null label, for the caller to degrade', () => {
    // `null` is what sends the rail to the message catalog and then to the raw value. A
    // fabricated label here would put the wrong word on a public page.
    const [known, unknown] = optionsForAxis(terms, ['Completed', 'Mothballed']);
    expect(known.label).toBe('Completed');
    expect(unknown.label).toBeNull();
  });

  it('reads the Persian label for the Persian locale', () => {
    const [option] = optionsForAxis(terms, ['Completed'], 'fa');
    expect(option.label).toBe('fa:Completed');
  });

  it('sorts undeclared values, so two identical requests build the same rail', () => {
    const options = optionsForAxis(terms, ['Zeta', 'Alpha', 'Completed']);
    expect(options.map(option => option.value)).toEqual(['Completed', 'Alpha', 'Zeta']);
  });

  it('counts a repeated value once — a rail lists an option, not an occurrence', () => {
    const options = optionsForAxis(terms, ['Completed', 'Completed', 'Completed']);
    expect(options).toHaveLength(1);
  });

  it('DROPS a hidden term entirely, even though records still use it', () => {
    /**
     * The bug this whole three-way rule exists for, and the one end-to-end verification
     * caught rather than reading.
     *
     * If the service handed over only the visible terms, a term just hidden would be
     * indistinguishable from a value nobody declared — so the append branch below would put
     * it straight back on the rail carrying its raw English value, and hiding would demote a
     * label and change nothing else. The flag travels with the row precisely so this case
     * can be told apart from the next one.
     */
    const withHidden = [terms[0], term('Concept', { id: 3, sortOrder: 2, visible: false })];
    const options = optionsForAxis(withHidden, ['Completed', 'Concept']);

    expect(options.map(option => option.value)).toEqual(['Completed']);
  });

  it('still APPENDS a value that no term declares at all', () => {
    // The other half of the same decision. Hidden means "the studio retired this option";
    // undeclared means "nobody has said anything about this value" — and the records
    // carrying the second must stay reachable, so it is offered unlabelled.
    const withHidden = [terms[0], term('Concept', { id: 3, sortOrder: 2, visible: false })];
    const options = optionsForAxis(withHidden, ['Completed', 'Concept', 'Mothballed']);

    expect(options.map(option => option.value)).toEqual(['Completed', 'Mothballed']);
  });
});

describe('withCurrentValues', () => {
  const declared = [
    { value: 'Completed', label: 'Completed' },
    { value: 'Concept', label: 'Concept' },
  ];

  it('leaves a declared value where it is', () => {
    expect(withCurrentValues(declared, ['Completed'])).toEqual(declared);
  });

  it('appends a value the record carries that no option lists', () => {
    // A select whose value is not among its options renders blank, and saving that form
    // would rewrite a field the editor never touched.
    const options = withCurrentValues(declared, ['Mothballed']);
    expect(options.at(-1)).toEqual({ value: 'Mothballed', label: null });
  });

  it('ignores an empty current value — a create form has none yet', () => {
    expect(withCurrentValues(declared, [''])).toEqual(declared);
  });

  it('does not duplicate a value it already lists', () => {
    expect(withCurrentValues(declared, ['Completed', 'Completed'])).toHaveLength(2);
  });
});
