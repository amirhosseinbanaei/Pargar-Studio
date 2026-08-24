// src/common/components/form/FormInput.tsx
'use client';
import type { FieldValues, Path } from 'react-hook-form';
import { useFormContext } from 'react-hook-form';
import { Input } from '@/common/components/ds/Input';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from './Form';

export interface FormInputProps<TValues extends FieldValues> extends Omit<
  React.ComponentProps<typeof Input>,
  'name' | 'error'
> {
  name: Path<TValues>;
  label?: React.ReactNode;
  description?: React.ReactNode;
  required?: boolean;
  formItem?: React.ComponentProps<typeof FormItem>;
}

export function FormInput<TValues extends FieldValues>({
  name,
  label,
  description,
  required,
  formItem,
  type = 'text',
  ...props
}: FormInputProps<TValues>) {
  const form = useFormContext<TValues>();
  return (
    <FormField
      name={name}
      control={form.control}
      render={({ field }) => (
        <FormItem {...formItem}>
          {label && <FormLabel required={required}>{label}</FormLabel>}
          <FormControl>
            {/* `?? ''` — never hand a controlled input `undefined`. It would
                mount uncontrolled and flip to controlled on the first reset,
                which React warns about and which can strand the control. */}
            <Input
              {...props}
              type={type}
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
