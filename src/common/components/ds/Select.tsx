// src/common/components/ds/Select.tsx
'use client';
import * as React from 'react';
import {
  BaseSelect,
  BaseSelectContent,
  BaseSelectItem,
  BaseSelectTrigger,
  BaseSelectValue,
} from '@/common/components/ui/select';
import {
  selectContentVariants,
  selectItemVariants,
  selectTriggerVariants,
  type SelectTriggerVariantProps,
} from '@/common/components/variants/select';
import { ChevronIcon } from '@/common/icons/outline';
import { cn } from '@/common/lib/utils';

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.ComponentProps<typeof BaseSelect>, 'children'>, SelectTriggerVariantProps {
  options: readonly SelectOption[];
  placeholder?: string;
  error?: React.ReactNode;
  /**
   * These four are hoisted onto the TRIGGER rather than passed to the Radix
   * Root, and that is load-bearing. `form/FormControl` injects `id` and the
   * `aria-*` wiring onto whatever single child it is given; spread onto the
   * Root they would land on a context provider that renders no DOM, so the
   * `<label htmlFor>` would point at nothing and the trigger would be an
   * unnamed combobox. The trigger is the focusable element, so it is the one
   * that has to carry them.
   */
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  /** Escape hatch to the primitive — `aria-label`, `id`, `side`, and so on. */
  triggerProps?: Omit<React.ComponentProps<typeof BaseSelectTrigger>, 'className'>;
  contentProps?: Omit<React.ComponentProps<typeof BaseSelectContent>, 'className'>;
  classNames?: { trigger?: string; content?: string; item?: string };
}

export function Select({
  options,
  placeholder,
  error,
  variant,
  size,
  triggerProps,
  contentProps,
  classNames,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  ...props
}: SelectProps) {
  return (
    <BaseSelect {...props}>
      <BaseSelectTrigger
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={error ? true : undefined}
        className={cn(
          selectTriggerVariants({ variant: error ? 'error' : variant, size }),
          classNames?.trigger,
        )}
        {...triggerProps}
      >
        <BaseSelectValue placeholder={placeholder} />
        {/* Rotates on open. Only `transform` — never a width or a margin. */}
        <ChevronIcon className="size-4 text-t-lo transition-transform duration-[var(--d-xs)] ease-out-kavan group-data-[state=open]:rotate-180" />
      </BaseSelectTrigger>
      <BaseSelectContent
        className={cn(selectContentVariants(), classNames?.content)}
        {...contentProps}
      >
        {options.map(option => (
          <BaseSelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={cn(selectItemVariants(), classNames?.item)}
          >
            {option.label}
          </BaseSelectItem>
        ))}
      </BaseSelectContent>
    </BaseSelect>
  );
}
Select.displayName = 'Select';
