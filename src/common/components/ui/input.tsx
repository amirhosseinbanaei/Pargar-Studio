// src/common/components/ui/input.tsx
/** REGENERABLE — see ui/button.tsx. */
'use client';
import { cn } from '@/common/lib/utils';

export function BaseInput({ className, type, ...props }: React.ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn(className)} {...props} />;
}
