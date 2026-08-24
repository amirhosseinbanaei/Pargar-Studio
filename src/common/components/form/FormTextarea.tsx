// src/common/components/form/FormTextarea.tsx
'use client';
import type { FieldValues, Path } from 'react-hook-form';
import { useFormContext } from 'react-hook-form';
import { Textarea } from '@/common/components/ds/Textarea';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from './Form';

export interface FormTextareaProps<TValues extends FieldValues> extends Omit<
  React.ComponentProps<typeof Textarea>,
  'name' | 'error'
> {
  name: Path<TValues>;
  label?: React.ReactNode;
  description?: React.ReactNode;
  required?: boolean;
  formItem?: React.ComponentProps<typeof FormItem>;
}

export function FormTextarea<TValues extends FieldValues>({
  name,
  label,
  description,
  required,
  formItem,
  ...props
}: FormTextareaProps<TValues>) {
  const form = useFormContext<TValues>();
  return (
    <FormField
      name={name}
      control={form.control}
      render={({ field }) => (
        <FormItem {...formItem}>
          {label && <FormLabel required={required}>{label}</FormLabel>}
          <FormControl>
            <Textarea
              {...props}
              name={field.name}
              value={field.value ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
