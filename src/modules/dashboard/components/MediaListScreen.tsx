// src/modules/dashboard/components/MediaListScreen.tsx
/**
 * The media list: fourteen rows, sortable, reorderable. See `DesignWorkListScreen` for why
 * there is no search or filter rail at this size.
 */
import Link from 'next/link';
import type { MediaRow } from '@/common/schemas/media';
import { Button } from '@/common/components/ds';
import {
  parseSortState,
  sortRows,
  RecordTable,
  type RecordTableColumn,
  type SortState,
} from './RecordTable';
import { MediaRowActions } from './MediaRowActions';

const LIST_PATH = '/dashboard/media';

export interface MediaListScreenProps {
  rows: readonly MediaRow[];
  searchParams: Record<string, string | string[] | undefined>;
}

export function MediaListScreen({ rows, searchParams }: MediaListScreenProps) {
  const columns = buildColumns();
  const sort = parseSortState(
    columns,
    typeof searchParams.sort === 'string' ? searchParams.sort : undefined,
    typeof searchParams.dir === 'string' ? searchParams.dir : undefined,
  );
  const ordered = sortRows(rows, columns, sort);

  const reorderDisabledReason = sort.key
    ? 'Clear the column sort to reorder. Order is only meaningful in the collection’s own order.'
    : undefined;

  const sortHref = (next: SortState) => {
    const params = new URLSearchParams();
    if (next.key) {
      params.set('sort', next.key);
      if (next.direction === 'desc') params.set('dir', 'desc');
    }
    const search = params.toString();
    return search === '' ? LIST_PATH : `${LIST_PATH}?${search}`;
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-fs-xl tracking-tight-kavan text-t-hi uppercase">Media</h1>
          <p className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">
            media · publications, awards, lectures and exhibitions
          </p>
        </div>
        <Button asChild>
          <Link href={`${LIST_PATH}/new`}>New media entry</Link>
        </Button>
      </header>

      <RecordTable
        columns={columns.map(column =>
          column.key === 'actions'
            ? { ...column, cell: rowActionsCell(ordered, reorderDisabledReason) }
            : column,
        )}
        rows={ordered}
        rowKey={row => String(row.id)}
        sort={sort}
        sortHref={sortHref}
        caption="Media entries, with their taxonomy and collection position"
        empty="No media entries yet. Seed the database, or create one."
      />
    </div>
  );
}

function buildColumns(): RecordTableColumn<MediaRow>[] {
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
      key: 'type',
      header: 'Type',
      sortValue: row => row.type,
      cell: row => (
        <span className="text-fs-xs tracking-tight-kavan text-t-md uppercase">{row.type}</span>
      ),
    },
    {
      key: 'project',
      header: 'Project',
      cell: row => <span className="font-mono text-fs-xs text-t-lo">{row.projectSlug ?? '—'}</span>,
    },
    {
      key: 'year',
      header: 'Year',
      align: 'end',
      sortValue: row => row.year,
      cell: row => <span className="text-fs-xs text-t-md">{row.year}</span>,
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
      cell: () => null,
    },
  ];
}

function rowActionsCell(ordered: readonly MediaRow[], reorderDisabledReason?: string) {
  return function ActionsCell(row: MediaRow) {
    const index = ordered.indexOf(row);
    return (
      <MediaRowActions
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
