// src/modules/studio/lib/seeds.ts
/**
 * Portrait seeds for the people on the studio page.
 *
 * Ported from `legacy/js/ui/panel.js:44`, and the comment there is the whole reason this
 * file exists: A PORTRAIT IS ALWAYS SEEDED FROM THE ENGLISH NAME, never the displayed one.
 * `seedOf` strips everything that is not `[a-z0-9]`, so a Persian name reduces to an empty
 * string — and every member of the studio would be handed the same portrait on the Persian
 * page, while the English page showed twenty-two different ones. The bug is invisible in
 * the language most people testing it read.
 *
 * The English record is therefore read alongside the localized one and the two are zipped
 * by INDEX, exactly as `legacy/js/ui/panel.js:396` did (`STUDIO.founders[i].name` beside
 * the localized `f.name`). The per-locale columns are written from the same array in the
 * same order by the seed, so the index is the identity.
 */
import type { Studio } from '@/common/schemas/studio';

/** `'Farhad Rastgar'` -> `'farhad-rastgar'`. */
export function seedOf(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export interface StudioSeeds {
  founders: readonly string[];
  team: readonly string[];
}

/** Index-aligned seeds, derived from the ENGLISH record. */
export function studioSeeds(english: Studio): StudioSeeds {
  return {
    founders: english.founders.map(founder => seedOf(founder.name)),
    team: english.team.map(seedOf),
  };
}
