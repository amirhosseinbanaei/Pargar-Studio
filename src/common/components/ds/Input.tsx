// src/common/components/ds/Input.tsx
'use client';
import * as React from 'react';
import { BaseInput } from '@/common/components/ui/input';
import { inputVariants, type InputVariantProps } from '@/common/components/variants/input';
import { useSlots, type SlotOptions } from '@/common/hooks/useSlots';
import { cn } from '@/common/lib/utils';

export interface InputProps
  extends Omit<React.ComponentProps<typeof BaseInput>, 'className' | 'size'>, InputVariantProps {
  error?: React.ReactNode;
  slots?: SlotOptions;
  /**
   * Per-region overrides. This renders up to three elements, so ONE
   * `className` would be ambiguous — it is deliberately omitted from the props.
   */
  classNames?: { container?: string; input?: string };
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error, slots, classNames, variant, size, ...props }, ref) => {
    const { leftIcon, rightIcon } = useSlots(slots, { iconClass: 'size-4 text-t-lo' });
    return (
      <div className={cn('relative flex w-full items-center', classNames?.container)}>
        {leftIcon && (
          <span className="pointer-events-none absolute start-3 z-10 flex items-center">
            {leftIcon}
          </span>
        )}
        <BaseInput
          ref={ref}
          // Styling and a11y state can never drift apart: the same `error`
          // drives both.
          aria-invalid={error ? true : (props['aria-invalid'] ?? undefined)}
          className={cn(
            inputVariants({ variant: error ? 'error' : variant, size }),
            leftIcon && 'ps-9',
            rightIcon && 'pe-9',
            classNames?.input, // caller wins: merged last
          )}
          {...props}
        />
        {rightIcon && (
          <span className="pointer-events-none absolute end-3 z-10 flex items-center">
            {rightIcon}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';
