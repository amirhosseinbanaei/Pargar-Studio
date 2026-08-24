// src/common/components/ds/Field.tsx
/**
 * The label + control + description + message wrapper.
 *
 * It generates ONE id and wires `htmlFor`, `aria-describedby` and
 * `aria-invalid` from it, so a control can never end up labelled by an id that
 * does not exist. `form/` builds on this rather than re-deriving the wiring per
 * control.
 */
'use client';
import * as React from 'react';
import { Label } from './Label';
import {
  fieldDescriptionVariants,
  fieldMessageVariants,
  fieldVariants,
} from '@/common/components/variants/field';
import { cn } from '@/common/lib/utils';

export interface FieldProps extends Omit<React.ComponentProps<'div'>, 'children'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  /** A message here also flips the control to `aria-invalid`. */
  error?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  /**
   * Receives the wiring to spread onto whichever control it renders. A render
   * prop rather than `children` + `cloneElement`: cloning silently drops props
   * on any control that does not forward them, and nothing reports it.
   */
  children: (aria: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': true | undefined;
    disabled: boolean | undefined;
  }) => React.ReactNode;
  /** This renders four elements, so one `className` would be ambiguous. */
  classNames?: {
    container?: string;
    label?: string;
    description?: string;
    error?: string;
  };
}

export function Field({
  label,
  description,
  error,
  required,
  disabled,
  children,
  classNames,
  ...props
}: FieldProps) {
  // `useId` is SSR-stable; a hand-rolled counter mismatches server and client.
  const id = React.useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-message` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn(fieldVariants(), classNames?.container)} {...props}>
      {label && (
        <Label
          htmlFor={id}
          invalid={!!error}
          disabled={disabled}
          required={required}
          className={classNames?.label}
        >
          {label}
        </Label>
      )}
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        disabled,
      })}
      {description && (
        <p id={descriptionId} className={cn(fieldDescriptionVariants(), classNames?.description)}>
          {description}
        </p>
      )}
      {/* Rendered only when there IS an error: an empty box that reserves
          height makes every form jump by a line the first time one appears. */}
      {error && (
        <p id={errorId} className={cn(fieldMessageVariants(), classNames?.error)}>
          {error}
        </p>
      )}
    </div>
  );
}
Field.displayName = 'Field';
