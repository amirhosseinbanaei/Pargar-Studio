// src/common/components/ds/Label.tsx
'use client';
import * as React from 'react';
import { BaseLabel } from '@/common/components/ui/label';
import { labelVariants, type LabelVariantProps } from '@/common/components/variants/field';
import { cn } from '@/common/lib/utils';

export interface LabelProps
  extends Omit<React.ComponentProps<typeof BaseLabel>, 'className'>, LabelVariantProps {
  className?: string;
  /** Appends the conventional asterisk AND an accessible "required" hint. */
  required?: boolean;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, invalid, disabled, required, children, ...props }, ref) => (
    <BaseLabel ref={ref} className={cn(labelVariants({ invalid, disabled }), className)} {...props}>
      {children}
      {required && (
        <>
          {/* The glyph is decoration; the word is what a screen reader gets. */}
          <span aria-hidden="true" className="ms-1 text-danger">
            *
          </span>
          <span className="sr-only"> (required)</span>
        </>
      )}
    </BaseLabel>
  ),
);
Label.displayName = 'Label';
