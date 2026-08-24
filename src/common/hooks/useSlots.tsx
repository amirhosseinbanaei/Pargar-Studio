// src/common/hooks/useSlots.tsx
/**
 * One decoration API for every control, instead of `leftIcon` / `rightIcon` /
 * `tooltipText` / `tooltipSide` props re-invented per component.
 *
 * Slot icons are `aria-hidden` — they are decoration. A control whose ONLY
 * label is an icon still needs its own `aria-label`.
 *
 * SCOPE NOTE: the architecture guide's `SlotOptions` also carries a `tooltip`
 * and a `withTooltip` wrapper. That half is deliberately absent here because
 * there is no `ds/Tooltip` yet — prompts 6 and 7 do not ask for one, and a
 * wrapper around a component that does not exist is not a shim, it is a
 * compile error waiting. Add `tooltip` here at the same time as `ds/Tooltip`,
 * not before.
 */
import * as React from 'react';
import { cn } from '@/common/lib/utils';

export interface SlotOptions {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function useSlots(slots?: SlotOptions, config?: { iconClass?: string }) {
  const cls = cn('shrink-0', config?.iconClass);

  // Read the two nodes into plain locals BEFORE the memos. With `slots?.leftIcon`
  // written inline in the dependency array, the React Compiler's lint infers the
  // dependency as the whole `slots` object, disagrees with the hand-written one,
  // and refuses to optimize the component — `react-hooks/preserve-manual-memoization`.
  // Destructuring first makes the inferred and declared dependencies the same thing.
  const left = slots?.leftIcon;
  const right = slots?.rightIcon;

  const leftIcon = React.useMemo(
    () =>
      left ? (
        <span className={cls} aria-hidden="true">
          {left}
        </span>
      ) : null,
    [left, cls],
  );

  const rightIcon = React.useMemo(
    () =>
      right ? (
        <span className={cls} aria-hidden="true">
          {right}
        </span>
      ) : null,
    [right, cls],
  );

  return {
    leftIcon,
    rightIcon,
    hasLeftIcon: !!left,
    hasRightIcon: !!right,
  } as const;
}
