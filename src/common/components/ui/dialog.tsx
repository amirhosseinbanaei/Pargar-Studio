// src/common/components/ui/dialog.tsx
/** REGENERABLE — see ui/button.tsx. */
'use client';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { cn } from '@/common/lib/utils';

export const BaseDialog = DialogPrimitive.Root;
export const BaseDialogTrigger = DialogPrimitive.Trigger;
export const BaseDialogClose = DialogPrimitive.Close;
export const BaseDialogPortal = DialogPrimitive.Portal;

export function BaseDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay data-slot="dialog-overlay" className={cn(className)} {...props} />
  );
}

export function BaseDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Content data-slot="dialog-content" className={cn(className)} {...props} />
  );
}

export function BaseDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title data-slot="dialog-title" className={cn(className)} {...props} />;
}

export function BaseDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(className)}
      {...props}
    />
  );
}
