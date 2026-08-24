// src/common/components/variants/_shared.ts
/**
 * Cross-control tokens.
 *
 * Controls must agree on height, radius, border, disabled opacity and popover
 * motion, or the app looks assembled from three kits. Everything here composes
 * the custom properties declared in `src/app/globals.css` — no control names a
 * colour, only a role, so a rebrand is one file and not a repo-wide search.
 *
 * The palette in use, and why: the shell is a dark, hairline-drawn archive, so a
 * control is a WELL cut into the canvas (`bg-s-4`) with a hairline edge
 * (`border-rule`), not a raised chip. Focus brightens the edge to champagne
 * (`--a-1`) rather than adding a glow ring, which is the same affordance the
 * ported `base.css` gives every `:focus-visible`.
 */

export const base =
  'relative flex w-full items-center gap-2 h-control min-w-control rounded-control ' +
  'border border-rule bg-s-4 px-3 py-2 text-fs-sm text-t-hi outline-none';

/**
 * State token LISTS, unprefixed — each control applies its own prefix.
 * See `prefix.ts` for why they are stored this way.
 */
export const placeholderTokens = ['text-t-xlo', 'tracking-tight-kavan'] as const;
export const focusTokens = ['border-a-1', 'ring-0', 'outline-none'] as const;

export const disabled =
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-disabled';

/** Same look for controls that cannot use `:disabled` (a div/button trigger). */
export const disabledClass = 'pointer-events-none cursor-not-allowed opacity-disabled';

export const aria = 'aria-expanded:border-rule-md aria-invalid:border-danger';

/**
 * Every floating surface (select, dialog, menu) shares one look and one motion.
 * `--s-3` is the card/well surface the ported `panel.css` already uses for a
 * raised plate, so a popover reads as the same material as a card.
 */
export const popoverContent =
  'relative z-50 min-w-control overflow-y-auto rounded-control border border-rule bg-s-3 ' +
  'shadow-lg shadow-black/40 data-[state=open]:motion-slide-in data-[side=bottom]:motion-slide-in';

export const popoverItem =
  'flex w-full cursor-pointer items-center gap-2 rounded-control px-3 py-2 text-fs-sm ' +
  'text-t-md outline-none select-none hover:bg-s-4 hover:text-t-hi ' +
  'focus:bg-s-4 focus:text-t-hi data-[highlighted]:bg-s-4 data-[highlighted]:text-t-hi ' +
  'data-[state=checked]:text-a-1';

/**
 * The eyebrow treatment `base.css` calls `.label` — uppercase, tracked, small.
 * Repeated here as utilities because `ds/` controls are Tailwind-styled while
 * the shell is ported CSS; the two must LOOK identical, so the values are the
 * same tokens rather than the same class.
 */
export const eyebrow = 'text-fs-xs tracking-mid-kavan text-t-lo uppercase';
