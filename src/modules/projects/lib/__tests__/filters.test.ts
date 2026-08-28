// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Project } from '@/common/schemas/project';
import {
  filterProjects,
  hasAnyFilter,
  matchesFilters,
  optionCount,
  parseProjectFilters,
  toggleFilterHref,
} from '../filters';

const project = (over: Partial<Project>): Project => ({
  id: 1,
  slug: 'a',
  types: ['Residential'],
  status: 'Completed',
  scale: 'Large',
  year: 2025,
  area: '100 m²',
  sortOrder: 0,
  title: 'A',
  blurb: '',
  description: '',
  location: '',
  client: '',
  cover: null,
  gallery: [],
  ...over,
});

describe('parseProjectFilters', () => {
  it('reads the four axes and ignores anything else in the query', () => {
    expect(parseProjectFilters({ type: 'Villa', year: '2019', page: '3', q: 'brick' })).toEqual({
      type: 'Villa',
      year: '2019',
    });
  });

  it('takes the first value when a key is repeated', () => {
    // `?type=A&type=B` arrives as an array. Left as one it would flow a `string[]` into a
    // string comparison that can never be true, so the filter would silently match nothing.
    expect(parseProjectFilters({ type: ['Villa', 'Office'] })).toEqual({ type: 'Villa' });
  });

  it('treats an empty or whitespace value as absent', () => {
    expect(parseProjectFilters({ type: '', status: '   ' })).toEqual({});
  });
});

describe('matchesFilters', () => {
  it('matches `type` with includes, not equality', () => {
    // The regression this pins: a project carries MORE THAN ONE type, so equality would
    // drop every multi-type project from every type filter.
    const multi = project({ types: ['Residential', 'Interior Design'] });
    expect(matchesFilters(multi, { type: 'Interior Design' })).toBe(true);
    expect(matchesFilters(multi, { type: 'Residential' })).toBe(true);
    expect(matchesFilters(multi, { type: 'Villa' })).toBe(false);
  });

  it('compares the year as a string, because that is what a URL carries', () => {
    expect(matchesFilters(project({ year: 2019 }), { year: '2019' })).toBe(true);
    expect(matchesFilters(project({ year: 2019 }), { year: '2018' })).toBe(false);
  });

  it('ANDs the axes together', () => {
    const p = project({ status: 'Completed', scale: 'Large' });
    expect(matchesFilters(p, { status: 'Completed', scale: 'Large' })).toBe(true);
    expect(matchesFilters(p, { status: 'Completed', scale: 'Small' })).toBe(false);
  });

  it('matches everything when nothing is selected', () => {
    expect(matchesFilters(project({}), {})).toBe(true);
  });
});

describe('toggleFilterHref', () => {
  const base = '/en/projects';

  it('adds a filter and keeps the others', () => {
    expect(toggleFilterHref(base, { status: 'Completed' }, 'type', 'Villa')).toBe(
      '/en/projects?type=Villa&status=Completed',
    );
  });

  it('clicking the selected option clears it', () => {
    expect(toggleFilterHref(base, { type: 'Villa' }, 'type', 'Villa')).toBe('/en/projects');
  });

  it('replaces within an axis rather than accumulating', () => {
    expect(toggleFilterHref(base, { type: 'Villa' }, 'type', 'Office')).toBe(
      '/en/projects?type=Office',
    );
  });

  it('emits keys in a stable order regardless of selection order', () => {
    // Two URLs for one view is a cache miss and a confusing history.
    const a = toggleFilterHref(base, { year: '2019', type: 'Villa' }, 'scale', 'Large');
    const b = toggleFilterHref(base, { type: 'Villa', year: '2019' }, 'scale', 'Large');
    expect(a).toBe(b);
    expect(a).toBe('/en/projects?type=Villa&scale=Large&year=2019');
  });
});

describe('optionCount', () => {
  const projects = [
    project({ slug: 'a', types: ['Residential'], status: 'Completed' }),
    project({ slug: 'b', types: ['Villa'], status: 'Completed' }),
    project({ slug: 'c', types: ['Villa'], status: 'Concept' }),
  ];

  it('excludes its own axis, so a group shows what each option WOULD give', () => {
    // With `type=Residential` selected, the Villa option must still say 2 — not 0.
    expect(optionCount(projects, { type: 'Residential' }, 'type', 'Villa')).toBe(2);
  });

  it('still applies the other axes', () => {
    expect(optionCount(projects, { status: 'Completed' }, 'type', 'Villa')).toBe(1);
  });
});

describe('filterProjects / hasAnyFilter', () => {
  it('narrows the list', () => {
    const projects = [
      project({ slug: 'a', scale: 'Large' }),
      project({ slug: 'b', scale: 'Small' }),
    ];
    expect(filterProjects(projects, { scale: 'Small' }).map(p => p.slug)).toEqual(['b']);
  });

  it('reports whether anything is selected', () => {
    expect(hasAnyFilter({})).toBe(false);
    expect(hasAnyFilter({ year: '2019' })).toBe(true);
  });
});
