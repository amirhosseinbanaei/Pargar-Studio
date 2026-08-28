// src/modules/dashboard/components/ProjectListScreen.tsx
/**
 * The project list: all 76 rows, searchable, filterable, sortable, reorderable.
 *
 * A SERVER COMPONENT. Search, the four filters and the sort are all `searchParams`, so the
 * only thing that reaches the browser from this screen is `ProjectRowActions` — the three
 * controls per row that call a Server Action. The filtering and sorting happen here, on
 * rows the server already has.
 *
 * ─── THE ORDER OF OPERATIONS MATTERS ──────────────────────────────────────────────
 * Filter, THEN sort, THEN compute the reorder boundaries. Computing "can this row move up"
 * before filtering would answer the question about the unfiltered archive, so the first row
 * of a filtered view would show an enabled up-arrow that moves it past rows nobody can see.
 * Doing it after is what makes the arrows describe what is actually on screen.
 *
 * ─── WHY THE ROW LINKS TO THE SLUG ────────────────────────────────────────────────
 * `/dashboard/projects/<slug>`, not `/dashboard/projects/<id>`. The slug is the same
 * identifier the public detail page uses, so a person comparing the two pages can read the
 * address bar and see they are looking at the same record — and a slug in a bug report is
 * legible in a way a row id is not.
 */
import Link from 'next/link';
import type { ProjectRow } from '@/common/schemas/project';
import type { TaxonomyTermRow } from '@/common/schemas/taxonomy';
import type { TaxonomyUsage } from '@/common/services/taxonomy-service';
import { Button } from '@/common/components/ds';
import {
  filterProjectRows,
  hasAnyProjectFilter,
  parseProjectListQuery,
  projectListFacets,
  projectListHref,
  type RawSearchParams,
} from '../lib/project-list';
import {
  parseSortState,
  sortRows,
  RecordTable,
  type RecordTableColumn,
  type SortState,
} from './RecordTable';
import { ProjectListFilters } from './ProjectListFilters';
import { TaxonomyEditor } from './TaxonomyEditor';
import { ProjectRowActions } from './ProjectRowActions';

const LIST_PATH = '/dashboard/projects';

export interface ProjectListScreenProps {
  rows: readonly ProjectRow[];
  searchParams: RawSearchParams;
  /** Every taxonomy term for this subject, for the editor above the list. */
  terms: readonly TaxonomyTermRow[];
  /** How many records use each value, per axis. */
  usage: TaxonomyUsage;
}

export function ProjectListScreen({ rows, searchParams, terms, usage }: ProjectListScreenProps) {
  const query = parseProjectListQuery(searchParams);
  const filtered = filterProjectRows(rows, query);

  const columns = buildColumns();
  const sort = parseSortState(
    columns,
    typeof searchParams.sort === 'string' ? searchParams.sort : undefined,
    typeof searchParams.dir === 'string' ? searchParams.dir : undefined,
  );
  const ordered = sortRows(filtered, columns, sort);

  /**
   * The arrows are meaningless in a sorted view — "up" is a position in `sort_order`, which
   * a title-sorted table does not display. Saying so is better than either silently moving
   * a row somewhere invisible or hiding the control with no explanation.
   */
  const reorderDisabledReason = sort.key
    ? 'Clear the column sort to reorder. Order is only meaningful in the archive’s own order.'
    : undefined;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-fs-xl tracking-tight-kavan text-t-hi uppercase">Projects</h1>
          <p className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">
            projects · both languages on one form
          </p>
        </div>
        <Button asChild>
          <Link href={`${LIST_PATH}/new`}>New project</Link>
        </Button>
      </header>

      {/*
        THE TERM EDITOR, above the list and collapsed. On this page rather than on a settings
        page because that is what makes the relationship between a term and the records using
        it visible — the count beside each term is counted from the very rows in the table
        below, and "can I delete this?" is answerable without leaving the screen.
      */}
      <TaxonomyEditor subject="project" terms={terms} usage={usage} />

      <ProjectListFilters
        action={LIST_PATH}
        query={query}
        facets={projectListFacets(rows)}
        sort={sort}
        matched={filtered.length}
        total={rows.length}
        clearHref={LIST_PATH}
        showClear={hasAnyProjectFilter(query)}
      />

      <RecordTable
        columns={columns.map(column =>
          column.key === 'actions'
            ? { ...column, cell: rowActionsCell(ordered, reorderDisabledReason) }
            : column,
        )}
        rows={ordered}
        rowKey={row => String(row.id)}
        sort={sort}
        sortHref={(next: SortState) => projectListHref(LIST_PATH, query, next)}
        caption="Projects, with their taxonomy and archive position"
        empty={
          hasAnyProjectFilter(query)
            ? 'No project matches those filters.'
            : 'No projects yet. Seed the database, or create one.'
        }
      />
    </div>
  );
}

/**
 * Built by a function rather than declared as a module constant because `sortHref` and the
 * row actions both need the request's own query — and a module-level array would be shared
 * across requests, which is the shape of bug that only appears under concurrency.
 */
function buildColumns(): RecordTableColumn<ProjectRow>[] {
  return [
    {
      key: 'title',
      header: 'Title',
      sortValue: row => row.titleEn,
      cell: row => (
        <div className="flex flex-col gap-0.5">
          <Link
            href={`${LIST_PATH}/${row.slug}`}
            className="text-fs-sm tracking-flat-kavan text-t-hi transition-colors duration-[var(--d-xs)] ease-out-kavan hover:text-a-1"
          >
            {row.titleEn || row.slug}
          </Link>
          {/*
            The Persian title beside the English one, in its own direction and language.
            `dir="rtl"` and `lang="fa"` on the element rather than a wrapper class: this is a
            left-to-right document, so the browser needs to be told this run is not, and told
            which language it is so a screen reader switches voice.
          */}
          <span dir="rtl" lang="fa" className="text-fs-xs text-t-lo">
            {row.titleFa}
          </span>
        </div>
      ),
    },
    {
      key: 'slug',
      header: 'Slug',
      sortValue: row => row.slug,
      cell: row => (
        <span className="font-mono text-fs-xs tracking-flat-kavan text-t-lo">{row.slug}</span>
      ),
    },
    {
      key: 'year',
      header: 'Year',
      align: 'end',
      sortValue: row => row.year,
      cell: row => <span className="text-fs-xs text-t-md">{row.year}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: row => row.status,
      cell: row => (
        <span className="text-fs-xs tracking-tight-kavan text-t-md uppercase">{row.status}</span>
      ),
    },
    {
      key: 'types',
      header: 'Types',
      // Not sortable: a project carries several types, so there is no single value to order
      // by, and joining them into a string would sort by whichever happened to be first.
      cell: row => <span className="text-fs-xs text-t-lo">{row.types.join(', ')}</span>,
    },
    {
      key: 'order',
      header: 'Order',
      align: 'end',
      sortValue: row => row.sortOrder,
      cell: row => <span className="font-mono text-fs-xs text-t-xlo">{row.sortOrder}</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'end',
      // Replaced in the render with a cell that knows the row's position. This placeholder
      // keeps the column list — and therefore `parseSortState` — in one place.
      cell: () => null,
    },
  ];
}

function rowActionsCell(ordered: readonly ProjectRow[], reorderDisabledReason?: string) {
  return function ActionsCell(row: ProjectRow) {
    const index = ordered.indexOf(row);
    return (
      <ProjectRowActions
        id={row.id}
        slug={row.slug}
        title={row.titleEn}
        editHref={`${LIST_PATH}/${row.slug}`}
        canMoveUp={index > 0}
        canMoveDown={index < ordered.length - 1}
        reorderDisabledReason={reorderDisabledReason}
      />
    );
  };
}
