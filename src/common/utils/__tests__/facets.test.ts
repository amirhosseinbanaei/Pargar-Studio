// @vitest-environment node
/**
 * The single-axis filter, which is URL state and therefore has to survive being typed by
 * hand, repeated, and re-clicked.
 */
import { describe, expect, it } from 'vitest';
import { facetHref, parseFacet } from '../facets';

describe('parseFacet', () => {
  it('reads the value', () => {
    expect(parseFacet({ category: 'Product' }, 'category')).toBe('Product');
  });

  it('takes the FIRST value of a repeated key', () => {
    // `?category=A&category=B` arrives as an array. Passed through, a `string[]` would
    // flow into a comparison that is false for every record — an empty grid with no
    // explanation.
    expect(parseFacet({ category: ['Product', 'Furniture'] }, 'category')).toBe('Product');
  });

  it('treats absent, empty and whitespace-only as no filter', () => {
    expect(parseFacet({}, 'category')).toBeUndefined();
    expect(parseFacet({ category: '' }, 'category')).toBeUndefined();
    expect(parseFacet({ category: '   ' }, 'category')).toBeUndefined();
    expect(parseFacet({ category: [] }, 'category')).toBeUndefined();
  });
});

describe('facetHref', () => {
  it('selects an option that is not selected', () => {
    expect(facetHref('/en/design', 'category', 'Product', undefined)).toBe(
      '/en/design?category=Product',
    );
  });

  it('TOGGLES OFF the option that is already selected', () => {
    // Re-clicking the active option clears the filter, which is what makes a single-select
    // rail navigable with no separate "all" entry.
    expect(facetHref('/en/design', 'category', 'Product', 'Product')).toBe('/en/design');
  });

  it('swaps one selection for another', () => {
    expect(facetHref('/fa/media', 'type', 'Award', 'Publication')).toBe('/fa/media?type=Award');
  });

  it('encodes a value with a space', () => {
    // "Detail Design" and "Interior Design" both contain one; unencoded, the href is a
    // malformed URL that silently loses the second word.
    expect(facetHref('/en/design', 'category', 'Detail Design', undefined)).toBe(
      '/en/design?category=Detail+Design',
    );
  });
});
