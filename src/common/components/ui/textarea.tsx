// src/common/components/ui/textarea.tsx
/** REGENERABLE — see ui/button.tsx. */
'use client';
import { cn } from '@/common/lib/utils';

export function BaseTextarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(className)} {...props} />;
}
