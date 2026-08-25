/**
 * THE DESIGN MODULE — nine objects, marks and details, their index and their pages.
 *
 * This barrel is the module's ENTIRE public API: `app/` imports from here and never one
 * level deeper, and no other module imports it at all. Both rules are machine-enforced
 * (`eslint.config.mjs`), and `design` went into that file's `MODULES` array before this
 * folder existed.
 *
 * WHAT IS NOT HERE, deliberately:
 *  - No database access. The records arrive from `@/common/services/design-work-service`,
 *    which the ROUTE calls and passes down.
 *  - No routing knowledge beyond the `basePath` string the page hands in, which is what
 *    lets one screen serve both locales.
 *  - No card shell, plate set, spec row or reveal observer of its own. Those are shared
 *    with `projects` and `media` through `@/common/components/collection` — promoted
 *    there rather than borrowed sideways, which lint bans.
 */
export { DesignScreen, DESIGN_FACET, type DesignScreenProps } from './components/DesignScreen';
export { DesignDetail, type DesignDetailProps } from './components/DesignDetail';
export { DesignCard, type DesignCardProps } from './components/DesignCard';
