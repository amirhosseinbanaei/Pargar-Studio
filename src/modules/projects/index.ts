// src/modules/projects/index.ts
/**
 * THE PROJECTS MODULE — the archive of 76 works, its filtered index, and its detail page.
 *
 * This barrel is the module's ENTIRE public API. `app/` imports from here and never one
 * level deeper; a deep import would make every internal file de-facto public, so renaming
 * a component would become a repo-wide diff. The rule is machine-enforced —
 * `eslint.config.mjs` bans deep module specifiers from `src/app/**`, and `projects` was added to
 * its `MODULES` array before this folder existed.
 *
 * It is also the acceptance test for prompts 1 through 3: the design tokens, the ported
 * stylesheets, the pure art layer, the motion layer, the `db -> repository -> service`
 * rings and the boundary lint all meet here for the first time on a real screen.
 *
 * WHAT IS NOT HERE, deliberately:
 *  - No database access and no query building. Everything comes from
 *    `@/common/services/project-service`, which the ROUTE calls and passes down.
 *  - No routing knowledge beyond a `basePath` string handed in by the page. The module
 *    does not know it lives under a locale segment, which is what lets one screen serve
 *    both locales and makes the filter logic unit-testable with no router.
 *  - No client store. The filters are `searchParams`; see `lib/filters.ts`.
 */
export { ProjectsScreen, type ProjectsScreenProps } from './components/ProjectsScreen';
export { ProjectsScreenSkeleton } from './components/ProjectsScreenSkeleton';
export { ProjectDetail, type ProjectDetailProps } from './components/ProjectDetail';
export { ProjectCard, type ProjectCardProps } from './components/ProjectCard';
export {
  ProjectFilterRail,
  type FilterTaxonomy,
  type ProjectFilterRailProps,
} from './components/ProjectFilterRail';
export {
  FILTER_KEYS,
  filterProjects,
  hasAnyFilter,
  matchesFilters,
  optionCount,
  parseProjectFilters,
  toggleFilterHref,
  type FilterKey,
  type ProjectFilters,
  type RawSearchParams,
} from './lib/filters';
