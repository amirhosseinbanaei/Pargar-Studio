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
// TODO(project): replace these token names with the custom utilities your theme defines.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      h: ['h-control'],
      w: ['w-control'],
      'min-h': ['min-h-control'],
      'min-w': ['min-w-control'],
      rounded: ['rounded-control'],
      opacity: ['opacity-disabled'],
      'border-color': ['border-control'],
      'text-color': ['text-control', 'text-control-placeholder'],
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
