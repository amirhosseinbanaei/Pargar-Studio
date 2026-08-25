/**
 * THE STUDIO MODULE — one editorial page about the practice.
 *
 * A SINGLE PAGE, not a collection, because the record is a singleton: one row, id pinned
 * to 1 by a database CHECK (`common/schemas/studio.ts`). There is no list route, no
 * `[slug]`, and no `generateStaticParams` beyond the two locales the layout already
 * declares.
 *
 * This barrel is the module's ENTIRE public API. `app/` imports from here and never one
 * level deeper; no other module imports it at all.
 *
 * `studioSeeds` is exported because only the ROUTE can build it: it needs the ENGLISH
 * record alongside the localized one, and a component may not call a service. See
 * `lib/seeds.ts` for why the English name is the only correct portrait seed.
 */
export { StudioScreen, type StudioScreenProps } from './components/StudioScreen';
export { studioSeeds, seedOf, type StudioSeeds } from './lib/seeds';
