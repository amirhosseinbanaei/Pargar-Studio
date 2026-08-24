// src/common/components/form/Form.tsx
/**
 * Context plumbing for the form tier.
 *
 * This layer knows about field names, RHF context and error rendering. It knows
 * NOTHING about HTTP, Server Actions or schemas — a feature component owns
 * submit. Keeping the form library quarantined here means swapping it, or
 * changing how errors render, touches ~10 small files instead of every page.
 */
'use client';
import * as React from 'react';
import { Slot } from 'radix-ui';
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { Label } from '@/common/components/ds/Label';
import {
  fieldDescriptionVariants,
  fieldMessageVariants,
  fieldVariants,
} from '@/common/components/variants/field';
import { cn } from '@/common/lib/utils';

const Form = FormProvider;

const FormFieldContext = React.createContext<{ name: string }>({ name: '' });
const FormItemContext = React.createContext<{ id: string }>({ id: '' });

const FormField = <TValues extends FieldValues, TName extends FieldPath<TValues>>(
  props: ControllerProps<TValues, TName>,
) => (
  <FormFieldContext.Provider value={{ name: props.name }}>
    <Controller {...props} />
  </FormFieldContext.Provider>
);

function useFormField() {
  const field = React.useContext(FormFieldContext);
  const item = React.useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  if (!field.name) throw new Error('useFormField must be used within <FormField>');
  // Subscribe BY NAME: this field re-renders only when its own state changes,
  // not on every keystroke anywhere in the form.
  const fieldState = getFieldState(field.name, useFormState({ name: field.name }));
  return {
    name: field.name,
    formItemId: `${item.id}-item`,
    formDescriptionId: `${item.id}-description`,
    formMessageId: `${item.id}-message`,
    ...fieldState,
  };
}

function FormItem({ className, ...props }: React.ComponentProps<'div'>) {
  // `useId` is SSR-stable; a hand-rolled counter mismatches server vs client.
  const id = React.useId();
  return (
    <FormItemContext.Provider value={{ id }}>
      <div data-slot="form-item" className={cn(fieldVariants(), className)} {...props} />
    </FormItemContext.Provider>
  );
}

/** Injects id + aria wiring onto whichever `ds/` control is its single child. */
function FormControl(props: React.ComponentProps<typeof Slot.Root>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();
  return (
    <Slot.Root
      id={formItemId}
      aria-invalid={!!error}
      {...props}
      aria-describedby={error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId}
    />
  );
}

/** Reads `error` and `formItemId` so label, control and message share one id. */
function FormLabel({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Label>, 'htmlFor' | 'invalid'>) {
  const { error, formItemId } = useFormField();
  return (
    <Label
      data-slot="form-label"
      data-error={!!error}
      htmlFor={formItemId}
      invalid={!!error}
      className={className}
      {...props}
    />
  );
}

function FormDescription({ className, ...props }: React.ComponentProps<'p'>) {
  const { formDescriptionId } = useFormField();
  return (
    <p
      data-slot="form-description"
      id={formDescriptionId}
      className={cn(fieldDescriptionVariants(), className)}
      {...props}
    />
  );
}

function FormMessage({ className, ...props }: React.ComponentProps<'p'>) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error.message ?? '') : props.children;
  // Render NOTHING, not an empty box that reserves height — otherwise every
  // form shifts by a line the first time a message appears.
  if (!body) return null;
  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn(fieldMessageVariants(), className)}
      {...props}
    >
      {body}
    </p>
  );
}

export {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormLabel,
  FormDescription,
  FormMessage,
  useFormField,
};
