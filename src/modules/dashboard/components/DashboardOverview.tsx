// src/modules/dashboard/components/DashboardOverview.tsx
/**
 * What `/dashboard` shows: the six areas, what each one holds, and which are built.
 *
 * ─── IT IS A MAP, NOT A METRICS PAGE ──────────────────────────────────────────────
 * No charts, no counters beyond the one that is genuinely useful. A dashboard for a
 * two-person studio editing its own website does not have questions a metrics page answers —
 * what it has is "where is the thing I came here to change", and the honest answer to that
 * is a legible index.
 *
 * The one number it does show is the project count, because it is the figure the public
 * footer prints and a mismatch between the two is worth noticing.
 *
 * A Server Component with no interactivity at all.
 */
import Link from 'next/link';
import { DASHBOARD_AREAS, areaHref } from '../lib/areas';

export interface DashboardOverviewProps {
  projectCount: number;
}

export function DashboardOverview({ projectCount }: DashboardOverviewProps) {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-fs-xl tracking-tight-kavan text-t-hi uppercase">Dashboard</h1>
        <p className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">
          {projectCount} projects in the archive
        </p>
      </header>

      <ul className="grid gap-px border border-rule bg-rule sm:grid-cols-2">
        {DASHBOARD_AREAS.map(area => (
          <li key={area.segment} className="bg-s-1">
            {area.available ? (
              <Link
                href={areaHref(area.segment)}
                className="flex h-full flex-col gap-2 p-5 transition-colors duration-[var(--d-xs)] ease-out-kavan hover:bg-s-2"
              >
                <AreaHeading area={area} tone="available" />
                <p className="text-fs-sm leading-relaxed text-t-md">{area.summary}</p>
              </Link>
            ) : (
              /*
                A `<div>`, not a link. An area prompt 7 has not built yet must not be
                focusable and must not navigate — see `DashboardShell` for the same rule in
                the navigation, and the same reason: a dead link inside an admin tool reads
                as a bug in the tool rather than as work in progress.
              */
              <div className="flex h-full flex-col gap-2 p-5">
                <AreaHeading area={area} tone="soon" />
                <p className="text-fs-sm leading-relaxed text-t-xlo">{area.summary}</p>
              </div>
            )}
          </li>
        ))}
      </ul>

      <p className="max-w-[52ch] text-fs-xs leading-relaxed tracking-flat-kavan text-t-xlo">
        Saving here purges the public site’s cache for exactly the records that changed, so a change
        is visible at its public URL immediately — no rebuild, no deploy.
      </p>
    </div>
  );
}

function AreaHeading({
  area,
  tone,
}: {
  area: (typeof DASHBOARD_AREAS)[number];
  tone: 'available' | 'soon';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2
        className={`text-fs-md tracking-tight-kavan uppercase ${
          tone === 'available' ? 'text-t-hi' : 'text-t-xlo'
        }`}
      >
        {area.label}
      </h2>
      <span className="font-mono text-fs-xs tracking-flat-kavan text-t-xlo lowercase">
        {tone === 'available' ? area.table : 'soon'}
      </span>
    </div>
  );
}
