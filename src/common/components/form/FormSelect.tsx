// src/common/components/form/FormSelect.tsx
'use client';
import type { FieldValues, Path } from 'react-hook-form';
import { useFormContext } from 'react-hook-form';
import { Select } from '@/common/components/ds/Select';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from './Form';

export interface FormSelectProps<TValues extends FieldValues> extends Omit<
  React.ComponentProps<typeof Select>,
  'name' | 'error' | 'value' | 'onValueChange'
> {
  name: Path<TValues>;
  label?: React.ReactNode;
  description?: React.ReactNode;
  required?: boolean;
  formItem?: React.ComponentProps<typeof FormItem>;
}

export function FormSelect<TValues extends FieldValues>({
  name,
  label,
  description,
  required,
  formItem,
  triggerProps,
  ...props
}: FormSelectProps<TValues>) {
  const form = useFormContext<TValues>();
  return (
    <FormField
      name={name}
      control={form.control}
      render={({ field }) => (
        <FormItem {...formItem}>
          {label && <FormLabel required={required}>{label}</FormLabel>}
          <FormControl>
            {/* An empty string is a CONTROLLED "nothing selected" and still
                shows the placeholder — `undefined` would make the trigger
                uncontrolled and it can stick on the placeholder while form
                state is already correct. */}
            <Select
              {...props}
              name={field.name}
              value={field.value ?? ''}
              onValueChange={field.onChange}
              triggerProps={{ ...triggerProps, onBlur: field.onBlur, ref: field.ref }}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
