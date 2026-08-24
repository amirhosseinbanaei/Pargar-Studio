// src/common/components/ds/Button.tsx
/** THE public API. Product code imports this; never `ui/button`. */
'use client';
import * as React from 'react';
import { BaseButton } from '@/common/components/ui/button';
import { buttonVariants, type ButtonVariantProps } from '@/common/components/variants/button';
import { cn } from '@/common/lib/utils';

export interface ButtonProps
  extends Omit<React.ComponentProps<typeof BaseButton>, 'className'>, ButtonVariantProps {
  /**
   * Shows a spinner AND sets `disabled` — the two must never be settable
   * apart, or a double-submit slips through while the spinner is up.
   */
  loading?: boolean;
  /** Single-element component, so a bare `className` is unambiguous here. */
  className?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, loading = false, disabled, className, children, asChild, ...props }, ref) => (
    <BaseButton
      ref={ref}
      asChild={asChild}
      // `type` defaults to "submit" inside a <form>. An unstyled action button
      // in a form then submits it on click — the single most common "why did my
      // form post?" bug.
      type={asChild ? undefined : (props.type ?? 'button')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)} // caller merged last
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && (
            <span
              aria-hidden
              className="size-3.5 animate-spin rounded-full border border-current border-t-transparent"
            />
          )}
          {children}
        </>
      )}
    </BaseButton>
  ),
);
Button.displayName = 'Button';
