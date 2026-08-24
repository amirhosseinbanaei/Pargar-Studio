// src/common/components/ds/Dialog.tsx
'use client';
import * as React from 'react';
import {
  BaseDialog,
  BaseDialogClose,
  BaseDialogContent,
  BaseDialogDescription,
  BaseDialogOverlay,
  BaseDialogPortal,
  BaseDialogTitle,
  BaseDialogTrigger,
} from '@/common/components/ui/dialog';
import {
  dialogContentVariants,
  dialogDescriptionVariants,
  dialogOverlayVariants,
  dialogTitleVariants,
  type DialogContentVariantProps,
} from '@/common/components/variants/dialog';
import { CloseIcon } from '@/common/icons/outline';
import { cn } from '@/common/lib/utils';

export interface DialogProps
  extends Omit<React.ComponentProps<typeof BaseDialog>, 'children'>, DialogContentVariantProps {
  /**
   * REQUIRED, not optional. Radix warns at runtime without one and a dialog
   * with no accessible name is an axe violation — making it a type error is
   * cheaper than finding out in CI. Pass `titleVisible={false}` for a dialog
   * whose heading is visually redundant; the title still reaches assistive tech.
   */
  title: React.ReactNode;
  titleVisible?: boolean;
  description?: React.ReactNode;
  trigger?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  /** Label for the corner close button — it has no text of its own. */
  closeLabel?: string;
  classNames?: { overlay?: string; content?: string; title?: string; description?: string };
}

export function Dialog({
  title,
  titleVisible = true,
  description,
  trigger,
  footer,
  children,
  size,
  closeLabel = 'Close',
  classNames,
  ...props
}: DialogProps) {
  return (
    <BaseDialog {...props}>
      {trigger && <BaseDialogTrigger asChild>{trigger}</BaseDialogTrigger>}
      <BaseDialogPortal>
        <BaseDialogOverlay className={cn(dialogOverlayVariants(), classNames?.overlay)} />
        <BaseDialogContent className={cn(dialogContentVariants({ size }), classNames?.content)}>
          <div className="flex flex-col gap-2 pe-8">
            <BaseDialogTitle
              className={cn(
                titleVisible ? dialogTitleVariants() : 'sr-only',
                titleVisible && classNames?.title,
              )}
            >
              {title}
            </BaseDialogTitle>
            {description && (
              <BaseDialogDescription
                className={cn(dialogDescriptionVariants(), classNames?.description)}
              >
                {description}
              </BaseDialogDescription>
            )}
          </div>
          {children}
          {footer && <div className="flex items-center justify-end gap-3">{footer}</div>}
          <BaseDialogClose
            // Icon-only, so the accessible name comes from aria-label. Without
            // it this is an axe violation and a voice-control dead end.
            aria-label={closeLabel}
            className="absolute end-5 top-5 text-t-lo transition-colors duration-[var(--d-xs)] ease-out-kavan outline-none hover:text-t-hi focus-visible:outline-1 focus-visible:outline-offset-[3px] focus-visible:outline-a-1"
          >
            <CloseIcon className="size-4" />
          </BaseDialogClose>
        </BaseDialogContent>
      </BaseDialogPortal>
    </BaseDialog>
  );
}
Dialog.displayName = 'Dialog';

export { BaseDialogClose as DialogClose, BaseDialogTrigger as DialogTrigger };
