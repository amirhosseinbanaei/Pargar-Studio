// src/common/lib/utils.ts
/**
 * `cn()` — the ONE class-merging helper for the whole app.
 *
 * What it must never do: exist twice. A second merge helper (or a raw
 * `clsx`/template-literal join at a call site) means two different conflict-resolution
 * rules in the same tree, and a component's `className` override silently stops working
 * depending on which one the file happened to import.
 *
 * The failure it prevents: two conflicting utilities of the same group BOTH survive the
 * merge, so the winner is decided by CSS source order — which differs between the dev
 * server and the minified production bundle. The override "works on my machine" and
 * breaks in production.
 *
 * Extra dependencies (not in the base assumption set): `clsx`, `tailwind-merge`.
 * Tailwind-specific. If the project does not use Tailwind, keep the same single-helper
 * rule and make `cn` your own merge function.
 */
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Teach tailwind-merge about custom-token utilities. Without this it cannot know that
 * `h-control` and `h-12` belong to the same group, so both survive and the cascade
 * decides — the production-only override bug described above.
 *
 * Every custom utility that shadows a built-in Tailwind group must be listed here.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      // Without this entry, `text-fs-*` is swallowed by the built-in TEXT-COLOR group,
      // so `cn('text-fs-xl', 'text-a-1')` drops the size and renders body-sized gold
      // text. Verified against tailwind-merge directly: it is wrong by default and
      // correct once the font sizes are their own group.
      'font-size': [{ text: ['fs-xs', 'fs-sm', 'fs-md', 'fs-lg', 'fs-xl', 'fs-2xl', 'fs-3xl'] }],

      // The design's tracking steps carry a `-kavan` suffix (globals.css says why), which
      // makes them unknown classes to the default matcher — so BOTH survived a merge and
      // the winner was decided by CSS source order, which differs between the dev server
      // and the minified production bundle.
      tracking: [{ tracking: ['wide-kavan', 'mid-kavan', 'tight-kavan', 'flat-kavan'] }],

      // Same failure, same fix, for the five motion easings.
      ease: [{ ease: ['expo', 'quint', 'inout-kavan', 'out-kavan', 'in-kavan'] }],

      // The control metrics added in prompt 3. Each SHADOWS a built-in Tailwind
      // group, which is exactly the case the file header describes: without
      // these lines tailwind-merge cannot know `h-control` and `h-12` are the
      // same group, so BOTH survive `cn(inputVariants(), 'h-12')` and the
      // winner is decided by CSS source order — an override that works in dev
      // and breaks in the production bundle.
      h: [{ h: ['control'] }],
      'min-w': [{ 'min-w': ['control'] }],
      rounded: [{ rounded: ['control'] }],
      opacity: [{ opacity: ['disabled'] }],

      // NOT listed, deliberately, because they already resolve correctly on the built-in
      // arbitrary-value matchers: the colour ramps (`bg-s-3`, `text-t-md`, `border-rule`,
      // `text-a-1`). Adding them would be noise that has to be maintained. Re-probe with
      // `twMerge('bg-s-0', 'bg-s-3')` before assuming that of any NEW token.
    },
  },
});
/**
 * Merge conditional class names with Tailwind conflict resolution.
 *
 * Order is load-bearing: variants first, state modifiers second, the caller's
 * `className` LAST — tailwind-merge keeps the last class of a conflicting group, so a
 * caller that is merged early cannot override anything.
 *
 * ```tsx
 * className={cn(inputVariants({ variant }), hasLeftIcon && 'pl-9', classNames?.input)}
 * ```
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
