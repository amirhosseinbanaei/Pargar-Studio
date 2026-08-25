// src/common/components/form/FormCheckbox.tsx
'use client';
import type { FieldValues, Path } from 'react-hook-form';
import { useFormContext } from 'react-hook-form';
import { Checkbox } from '@/common/components/ds/Checkbox';
import { FormControl, FormDescription, FormField, FormItem, FormMessage } from './Form';

export interface FormCheckboxProps<TValues extends FieldValues> extends Omit<
  React.ComponentProps<typeof Checkbox>,
  'name' | 'error' | 'checked' | 'onCheckedChange'
> {
  name: Path<TValues>;
  label?: React.ReactNode;
  description?: React.ReactNode;
  formItem?: React.ComponentProps<typeof FormItem>;
}

export function FormCheckbox<TValues extends FieldValues>({
  name,
  label,
  description,
  formItem,
  ...props
}: FormCheckboxProps<TValues>) {
  const form = useFormContext<TValues>();
  return (
    <FormField
      name={name}
      control={form.control}
      render={({ field }) => (
        <FormItem {...formItem}>
          {/* No FormLabel here: the checkbox renders its OWN <label htmlFor>,
              which is what makes clicking the text toggle the box. A second
              label would give the control two accessible names. */}
          <FormControl>
            <Checkbox
              {...props}
              label={label}
              name={field.name}
              checked={field.value ?? false}
              onCheckedChange={field.onChange}
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
