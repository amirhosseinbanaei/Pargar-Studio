// src/common/components/ds/Checkbox.tsx
'use client';
import * as React from 'react';
import { BaseCheckbox, BaseCheckboxIndicator } from '@/common/components/ui/checkbox';
import { checkboxVariants, type CheckboxVariantProps } from '@/common/components/variants/checkbox';
import { labelVariants } from '@/common/components/variants/field';
import { CheckIcon, MinusIcon } from '@/common/icons/outline';
import { cn } from '@/common/lib/utils';

export interface CheckboxProps
  extends Omit<React.ComponentProps<typeof BaseCheckbox>, 'className'>, CheckboxVariantProps {
  label?: React.ReactNode;
  error?: React.ReactNode;
  classNames?: { container?: string; box?: string; label?: string };
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ label, error, classNames, size, id, checked, ...props }, ref) => {
    // `useId` only when the caller gave no id, so a `form/` wrapper's generated
    // id still wins and label/control stay bound to the same one.
    const generated = React.useId();
    const inputId = id ?? generated;

    const box = (
      <BaseCheckbox
        ref={ref}
        id={inputId}
        checked={checked}
        aria-invalid={error ? true : undefined}
        className={cn(checkboxVariants({ size }), classNames?.box)}
        {...props}
      >
        <BaseCheckboxIndicator className="flex items-center justify-center text-current">
          {checked === 'indeterminate' ? (
            <MinusIcon className="size-3.5" />
          ) : (
            <CheckIcon className="size-3.5" />
          )}
        </BaseCheckboxIndicator>
      </BaseCheckbox>
    );

    if (!label) return box;

    return (
      <div className={cn('flex items-center gap-3', classNames?.container)}>
        {box}
        {/* A plain <label>, not ds/Label: Radix renders a <button>, and the
            native label/for association is what makes clicking the text toggle
            the box without a click handler. */}
        <label
          htmlFor={inputId}
          className={cn(
            labelVariants({ invalid: !!error, disabled: props.disabled }),
            'cursor-pointer',
            classNames?.label,
          )}
        >
          {label}
        </label>
      </div>
    );
  },
);
Checkbox.displayName = 'Checkbox';
