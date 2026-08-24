// src/common/components/ui/select.tsx
/** REGENERABLE — see ui/button.tsx. */
'use client';
import { Select as SelectPrimitive } from 'radix-ui';
import { cn } from '@/common/lib/utils';

export const BaseSelect = SelectPrimitive.Root;
export const BaseSelectGroup = SelectPrimitive.Group;
export const BaseSelectValue = SelectPrimitive.Value;

export function BaseSelectTrigger({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger data-slot="select-trigger" className={cn(className)} {...props} />
  );
}

export function BaseSelectIcon(props: React.ComponentProps<typeof SelectPrimitive.Icon>) {
  return <SelectPrimitive.Icon data-slot="select-icon" {...props} />;
}

export function BaseSelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  // Portalled: a popover rendered inside an `overflow: hidden` inertia pane is
  // clipped by it, which is how a select in the panel loses its own list.
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        className={cn(className)}
        {...props}
      >
        <SelectPrimitive.Viewport data-slot="select-viewport">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function BaseSelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item data-slot="select-item" className={cn(className)} {...props}>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export function BaseSelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return <SelectPrimitive.Label data-slot="select-label" className={cn(className)} {...props} />;
}
