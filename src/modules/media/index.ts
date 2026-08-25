/**
 * THE MEDIA MODULE — fourteen publications, awards, lectures and exhibitions.
 *
 * This barrel is the module's ENTIRE public API. `app/` imports from here and never one
 * level deeper; no other module imports it at all. Both rules are machine-enforced, and
 * `media` went into `eslint.config.mjs`'s `MODULES` array before this folder existed.
 *
 * ITS ONE STRUCTURAL DEPENDENCY IS A TYPE, NOT A MODULE. Every media record points at a
 * project, and both screens need that project — for the drawing seed on the list, and for
 * the related link on the detail page. It reads `Project` from `@/common/schemas/project`
 * and receives the records from the ROUTE; importing `@/modules/projects` for the same
 * thing would create the cycle the boundary rule exists to prevent, and would make either
 * module undeletable.
 */
export { MediaScreen, MEDIA_FACET, type MediaScreenProps } from './components/MediaScreen';
export { MediaDetail, type MediaDetailProps } from './components/MediaDetail';
export { MediaCard, type MediaCardProps } from './components/MediaCard';
