// src/common/components/ui/label.tsx
/** REGENERABLE — see ui/button.tsx. */
'use client';
import { Label as LabelPrimitive } from 'radix-ui';
import { cn } from '@/common/lib/utils';

export function BaseLabel({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root data-slot="label" className={cn(className)} {...props} />;
}
