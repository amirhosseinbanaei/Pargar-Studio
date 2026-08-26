// src/modules/dashboard/lib/areas.ts
/**
 * The six content areas the dashboard manages, in the order they appear in the navigation.
 *
 * ─── FIVE OF THEM ARE DELIBERATELY DISABLED ───────────────────────────────────────
 * Prompt 6 builds the projects CRUD; prompt 7 repeats the pattern for the other five. Until
 * then their routes do not exist, and this file is the reason that is VISIBLE rather than
 * broken: a disabled entry renders as inert text with a "soon" marker, so a person can see
 * the whole shape of the tool and knows the gap is planned.
 *
 * The alternative — omitting them until they exist — hides the plan, and the alternative to
 * THAT is linking them anyway, which gives a 404 to someone who has no way to know the page
 * was never built. A dead link inside an admin tool reads as a bug in the tool.
 *
 * `available: true` is the single edit that turns one on. Prompt 7 flips five booleans and
 * adds five route folders; nothing else in the shell changes.
 *
 * ─── WHY `table` IS HERE ──────────────────────────────────────────────────────────
 * Each area names the database table it edits, and the navigation shows it. This is an
 * admin tool with one interface language chosen precisely so that every label maps onto a
 * column name (AGENTS.md) — surfacing the table alongside the label is the same decision
 * carried one step further, and it is what makes a bug report from the studio legible.
 */

export interface DashboardArea {
  /** URL segment under `/dashboard`. */
  segment: string;
  label: string;
  /** The table it edits, shown in the navigation and named in AGENTS.md. */
  table: string;
  /** One line describing what lives there, for the overview screen. */
  summary: string;
  /** False until the prompt that builds it has landed. */
  available: boolean;
}

export const DASHBOARD_AREAS = [
  {
    segment: 'projects',
    label: 'Projects',
    table: 'projects',
    summary:
      'The archive, 2013–2025. Title, blurb, description, location and client in both languages.',
    available: true,
  },
  {
    segment: 'design',
    label: 'Design',
    table: 'design_works',
    summary: 'Objects, marks and details — the design works shown at /design.',
    available: true,
  },
  {
    segment: 'media',
    label: 'Media',
    table: 'media',
    summary: 'Publications, awards, lectures and exhibitions.',
    available: true,
  },
  {
    segment: 'studio',
    label: 'Studio',
    table: 'studio',
    summary: 'The editorial block: manifesto, founders, team, alumni and awards. One record.',
    available: true,
  },
  {
    segment: 'contact',
    label: 'Contact',
    table: 'contact',
    summary: 'The contact page’s own content — address, hours, careers, socials. One record.',
    available: true,
  },
  {
    segment: 'messages',
    label: 'Messages',
    table: 'contact_messages',
    summary: 'The inbox. Everything a stranger has sent through the public form.',
    available: false,
  },
] as const satisfies readonly DashboardArea[];

/** `/dashboard/projects` — one place the prefix is spelled, so a rename is one edit. */
export const areaHref = (segment: string) => `/dashboard/${segment}`;

/**
 * Which area a pathname is inside, or `null` on the overview.
 *
 * Prefix-aware on purpose: `/dashboard/projects/qeytarieh-08-residence` must mark Projects
 * as current, not fall through to nothing. The exact-match version of this is the reason a
 * nav highlight disappears the moment you open a detail page.
 */
export function currentArea(pathname: string): DashboardArea | null {
  return (
    DASHBOARD_AREAS.find(
      area =>
        pathname === areaHref(area.segment) || pathname.startsWith(`${areaHref(area.segment)}/`),
    ) ?? null
  );
}
