// src/modules/dashboard/components/IndexCardListScreen.tsx
/**
 * The five index cards, as five links to five editors.
 *
 * NOT a `RecordTable`, and that is the whole shape of this screen. `RecordTable` exists for
 * a collection that grows, is sorted, is filtered and is reordered — 76 projects, 14 media
 * entries. This is a fixed set of five whose ORDER is `NAV` and cannot be changed from here,
 * so a sortable table would offer three controls that all do nothing. Five rows, each naming
 * the column it edits and whether anybody has written anything into it yet.
 *
 * The "using the site's own wording" marker is the point of the screen: an editor has to be
 * able to tell, at a glance, which columns are still showing the built-in copy and which
 * have been written. Without it an empty row and a row saved with the same words look
 * identical.
 */
import Link from 'next/link';
import { areaHref } from '../lib/areas';

export interface IndexCardListRow {
  /** One of the five NAV ids. */
  sectionId: string;
  /** The public path the column leads to. */
  path: string;
  /** The English title as STORED — `''` when nobody has written one. */
  title: string;
  /** The English caption as stored, `''` when empty. */
  caption: string;
  /** `nav.<id>` in English — what the column shows when `title` is empty. */
  fallbackTitle: string;
  /** `cap.<id>` in English. */
  fallbackCaption: string;
  hasImage: boolean;
}

export interface IndexCardListScreenProps {
  rows: readonly IndexCardListRow[];
}

export function IndexCardListScreen({ rows }: IndexCardListScreenProps) {
  return (
    <div className="flex max-w-[64rem] flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-fs-xl tracking-tight-kavan text-t-hi uppercase">Index cards</h1>
        <p className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">
          index_cards · five records, one per column of the front page
        </p>
        <p className="text-fs-xs tracking-flat-kavan text-t-xlo">
          The five columns at <code className="font-mono text-t-md">/en</code> and{' '}
          <code className="font-mono text-t-md">/fa</code>. You can change what each one says in
          both languages and put a photograph behind it. The sections themselves — their ids, their
          URLs and their generated drawings — are fixed in code: the route tree and the shell
          transition are built on them, so a save here can never take a page off the site.
        </p>
      </header>

      <ul className="flex flex-col border-t border-rule">
        {rows.map(row => {
          const written = row.title.trim() !== '';
          return (
            <li key={row.sectionId} className="border-b border-rule">
              <Link
                href={`${areaHref('index-cards')}/${row.sectionId}`}
                className="flex flex-col gap-1 py-4 transition-colors hover:bg-s-1"
              >
                <span className="flex flex-wrap items-baseline gap-3">
                  <span className="text-fs-sm tracking-tight-kavan text-t-hi uppercase">
                    {written ? row.title : row.fallbackTitle}
                  </span>
                  <span className="font-mono text-fs-xs text-t-xlo">{row.path}</span>
                  {/*
                    Never colour alone: both markers are words. A reader who cannot
                    distinguish the two greys still gets the whole state from the text.
                  */}
                  {!written && (
                    <span className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">
                      using the site’s own wording
                    </span>
                  )}
                  {row.hasImage && (
                    <span className="text-fs-xs tracking-mid-kavan text-a-1 uppercase">
                      has a picture
                    </span>
                  )}
                </span>
                <span className="text-fs-xs tracking-flat-kavan text-t-lo">
                  {row.caption.trim() !== '' ? row.caption : row.fallbackCaption}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
