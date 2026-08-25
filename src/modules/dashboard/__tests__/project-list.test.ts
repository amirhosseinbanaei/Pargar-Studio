// @vitest-environment node
/**
 * Search, the four filters, the derived facets and the sort — pure functions, no React, no
 * router, no database.
 *
 * The two rules worth pinning are the ones that fail SILENTLY. A `type` filter written with
 * equality still returns rows, just never the multi-type ones; a search that skips the
 * Persian column still finds things, just never through a Persian title. Neither throws,
 * neither shows up in a build, and both make records unfindable in a tool whose entire job
 * is finding a record to edit.
 */
import { describe, expect, it } from 'vitest';
import type { ProjectRow } from '@/common/schemas/project';
import {
  filterProjectRows,
  hasAnyProjectFilter,
  parseProjectListQuery,
  projectListFacets,
  projectListHref,
} from '../lib/project-list';
import { parseSortState, sortRows, type RecordTableColumn } from '../components/RecordTable';

const row = (overrides: Partial<ProjectRow>): ProjectRow =>
  ({
    id: 1,
    slug: 'a-house',
    types: ['Residential'],
    status: 'Completed',
    scale: 'Medium',
    year: 2021,
    area: '',
    sortOrder: 0,
    titleEn: 'A House',
    titleFa: 'یک خانه',
    blurbEn: '',
    blurbFa: '',
    descriptionEn: '',
    descriptionFa: '',
    locationEn: '',
    locationFa: '',
    clientEn: '',
    clientFa: '',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }) as ProjectRow;

const ROWS: ProjectRow[] = [
  row({
    id: 1,
    slug: 'qeytarieh-08-residence',
    titleEn: 'Qeytarieh 08 Residence',
    titleFa: 'خانه قیطریه',
    types: ['Residential', 'Interior Design'],
    year: 2021,
    status: 'Completed',
    scale: 'Medium',
    sortOrder: 0,
  }),
  row({
    id: 2,
    slug: 'niavaran-office',
    titleEn: 'Niavaran Office',
    titleFa: 'دفتر نیاوران',
    types: ['Office'],
    year: 2019,
    status: 'Concept',
    scale: 'Large',
    sortOrder: 1,
  }),
  row({
    id: 3,
    slug: 'darband-villa',
    titleEn: 'Darband Villa',
    titleFa: 'ویلای دربند',
    types: ['Villa', 'Residential'],
    year: 2023,
    status: 'Under Construction',
    scale: 'Small',
    sortOrder: 2,
  }),
];

const query = (overrides: Partial<ReturnType<typeof parseProjectListQuery>> = {}) => ({
  search: '',
  filters: { type: null, status: null, scale: null, year: null },
  ...overrides,
});

describe('the type filter', () => {
  it('MATCHES WITH `includes`, so a multi-type project is not silently dropped', () => {
    // Written as equality this returns only `niavaran-office`'s single-type kin and drops
    // both multi-type projects from a filter they genuinely belong in. Nothing errors.
    const matched = filterProjectRows(
      ROWS,
      query({ filters: { type: 'Residential', status: null, scale: null, year: null } }),
    );

    expect(matched.map(r => r.slug)).toEqual(['qeytarieh-08-residence', 'darband-villa']);
  });

  it('matches a secondary type as readily as a primary one', () => {
    const matched = filterProjectRows(
      ROWS,
      query({ filters: { type: 'Interior Design', status: null, scale: null, year: null } }),
    );
    expect(matched.map(r => r.slug)).toEqual(['qeytarieh-08-residence']);
  });
});

describe('search', () => {
  it('finds a record by its PERSIAN title', () => {
    // The reason this list reads `ProjectRow` rather than a locale-collapsed `Project`.
    // Searching only the English column makes half the archive unfindable.
    const matched = filterProjectRows(ROWS, query({ search: 'نیاوران' }));
    expect(matched.map(r => r.slug)).toEqual(['niavaran-office']);
  });

  it('finds a record by English title, case-insensitively, and by slug', () => {
    expect(filterProjectRows(ROWS, query({ search: 'QEYTARIEH' })).map(r => r.slug)).toEqual([
      'qeytarieh-08-residence',
    ]);
    expect(filterProjectRows(ROWS, query({ search: 'darband-v' })).map(r => r.slug)).toEqual([
      'darband-villa',
    ]);
  });

  it('returns everything for an empty search rather than nothing', () => {
    expect(filterProjectRows(ROWS, query({ search: '' }))).toHaveLength(3);
  });

  it('combines with a filter rather than replacing it', () => {
    const matched = filterProjectRows(
      ROWS,
      query({
        search: 'villa',
        filters: { type: 'Residential', status: null, scale: null, year: null },
      }),
    );
    expect(matched.map(r => r.slug)).toEqual(['darband-villa']);
  });
});

describe('parseProjectListQuery', () => {
  it('takes the first value of a repeated parameter and trims blanks to null', () => {
    const parsed = parseProjectListQuery({ q: ' house ', type: ['Villa', 'Office'], status: '  ' });
    expect(parsed.search).toBe('house');
    expect(parsed.filters.type).toBe('Villa');
    // A blank parameter is "no filter", not "filter on the empty string" — otherwise a URL
    // with `?status=` matches nothing and looks like a broken page.
    expect(parsed.filters.status).toBeNull();
  });

  it('reports whether anything is actually filtering', () => {
    expect(hasAnyProjectFilter(query())).toBe(false);
    expect(hasAnyProjectFilter(query({ search: 'x' }))).toBe(true);
    expect(
      hasAnyProjectFilter(
        query({ filters: { type: 'Villa', status: null, scale: null, year: null } }),
      ),
    ).toBe(true);
  });
});

describe('projectListFacets', () => {
  it('derives the options from the rows that exist, flattening multi-valued types', () => {
    const facets = projectListFacets(ROWS);
    expect(facets.type).toEqual(['Interior Design', 'Office', 'Residential', 'Villa']);
    expect(facets.status).toEqual(['Completed', 'Concept', 'Under Construction']);
    // Newest first — a year list is scanned from the top.
    expect(facets.year).toEqual(['2023', '2021', '2019']);
  });

  it('offers no options at all for an empty table, rather than a stale hardcoded list', () => {
    const facets = projectListFacets([]);
    expect(facets.type).toEqual([]);
    expect(facets.year).toEqual([]);
  });
});

describe('projectListHref', () => {
  it('omits every empty parameter, so "no filters" has ONE spelling', () => {
    // `?q=&type=&status=&scale=&year=` is a different URL from the bare path, and two
    // spellings of one view cache separately and read differently in a bookmark.
    expect(projectListHref('/dashboard/projects', query())).toBe('/dashboard/projects');
  });

  it('omits the default ascending direction but keeps a descending one', () => {
    expect(projectListHref('/dashboard/projects', query(), { key: 'year', direction: 'asc' })).toBe(
      '/dashboard/projects?sort=year',
    );
    expect(
      projectListHref('/dashboard/projects', query(), { key: 'year', direction: 'desc' }),
    ).toBe('/dashboard/projects?sort=year&dir=desc');
  });

  it('carries the search and the filters alongside the sort', () => {
    const href = projectListHref(
      '/dashboard/projects',
      query({ search: 'house', filters: { type: 'Villa', status: null, scale: null, year: null } }),
      { key: 'title', direction: 'asc' },
    );
    expect(href).toBe('/dashboard/projects?q=house&type=Villa&sort=title');
  });
});

describe('sortRows', () => {
  const columns: RecordTableColumn<ProjectRow>[] = [
    { key: 'title', header: 'Title', cell: () => null, sortValue: r => r.titleEn },
    { key: 'year', header: 'Year', cell: () => null, sortValue: r => r.year },
    { key: 'types', header: 'Types', cell: () => null },
  ];

  it('leaves the natural order UNTOUCHED when nothing is sorted', () => {
    // `sort_order` is the archive's own order and the one the reorder arrows write. A
    // default sort here would make those arrows appear to do nothing.
    const sorted = sortRows(ROWS, columns, { key: null, direction: 'asc' });
    expect(sorted).toBe(ROWS);
  });

  it('sorts numbers numerically, in both directions', () => {
    expect(sortRows(ROWS, columns, { key: 'year', direction: 'asc' }).map(r => r.year)).toEqual([
      2019, 2021, 2023,
    ]);
    expect(sortRows(ROWS, columns, { key: 'year', direction: 'desc' }).map(r => r.year)).toEqual([
      2023, 2021, 2019,
    ]);
  });

  it('sorts strings with localeCompare, not by code point', () => {
    const mixed = [
      row({ titleEn: 'apple' }),
      row({ titleEn: 'Banana' }),
      row({ titleEn: 'cherry' }),
    ];
    // A plain `<` puts every uppercase letter before every lowercase one, so this would come
    // back as Banana, apple, cherry — immediately visible in a list of project titles.
    expect(
      sortRows(mixed, columns, { key: 'title', direction: 'asc' }).map(r => r.titleEn),
    ).toEqual(['apple', 'Banana', 'cherry']);
  });

  it('does not mutate the array it was given', () => {
    const original = [...ROWS];
    sortRows(ROWS, columns, { key: 'year', direction: 'desc' });
    expect(ROWS).toEqual(original);
  });

  it('ignores a column that exists but is not sortable', () => {
    const sorted = sortRows(ROWS, columns, { key: 'types', direction: 'asc' });
    expect(sorted).toBe(ROWS);
  });
});

describe('parseSortState', () => {
  const columns: RecordTableColumn<ProjectRow>[] = [
    { key: 'year', header: 'Year', cell: () => null, sortValue: r => r.year },
    { key: 'types', header: 'Types', cell: () => null },
  ];

  it('accepts a real sortable column', () => {
    expect(parseSortState(columns, 'year', 'desc')).toEqual({ key: 'year', direction: 'desc' });
  });

  it('falls back to the natural order for a column that is unknown or not sortable', () => {
    // Search parameters are attacker-controlled and, more usually, just stale — a bookmark
    // naming a column that has since been renamed. The answer is the natural order, not a
    // crash and not an empty table.
    expect(parseSortState(columns, 'nonsense', 'asc').key).toBeNull();
    expect(parseSortState(columns, 'types', 'asc').key).toBeNull();
    expect(parseSortState(columns, undefined, undefined).key).toBeNull();
  });

  it('treats any direction other than desc as ascending', () => {
    expect(parseSortState(columns, 'year', 'sideways').direction).toBe('asc');
  });
});
