// src/common/components/ui/checkbox.tsx
/** REGENERABLE — see ui/button.tsx. */
'use client';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { cn } from '@/common/lib/utils';

export function BaseCheckbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return <CheckboxPrimitive.Root data-slot="checkbox" className={cn(className)} {...props} />;
}

export function BaseCheckboxIndicator({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Indicator>) {
  return (
    <CheckboxPrimitive.Indicator
      data-slot="checkbox-indicator"
      className={cn(className)}
      {...props}
    />
  );
}
