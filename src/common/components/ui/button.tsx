// src/common/components/ui/button.tsx
/**
 * REGENERABLE. Structure and a `data-slot` marker, nothing else: no colours, no
 * sizes, no product decisions. Anything you add here is lost the next time this
 * directory is regenerated — put it in `ds/Button.tsx`.
 */
'use client';
import { Slot } from 'radix-ui';
import { cn } from '@/common/lib/utils';

export function BaseButton({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<'button'> & { asChild?: boolean }) {
  // `asChild` renders the single child element instead of a <button> and merges
  // props onto it. That is what lets a Link look exactly like a button without
  // nesting <a> inside <button> — invalid HTML that breaks keyboard semantics
  // and that axe flags.
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp data-slot="button" className={cn(className)} {...props} />;
}
