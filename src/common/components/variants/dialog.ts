// src/common/components/variants/dialog.ts
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * The dialog.
 *
 * Only `opacity` and `transform` are animated, the same rule the shell follows:
 * the overlay fades, the panel fades and lifts. Nothing animates `top`, `left`,
 * `width` or `height`, so the whole thing stays on the compositor.
 */
export const dialogOverlayVariants = cva([
  'fixed inset-0 z-50 bg-s-0/80 backdrop-blur-[2px]',
  'data-[state=open]:motion-fade-in',
  'data-[state=closed]:motion-fade-out',
]);

export const dialogContentVariants = cva(
  [
    'fixed start-1/2 top-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-5',
    'border border-rule bg-s-2 p-6 shadow-2xl shadow-black/60',
    'data-[state=open]:motion-pop-in',
    'data-[state=closed]:motion-pop-out',
    'rtl:translate-x-1/2',
  ],
  {
    variants: {
      size: {
        sm: 'max-w-sm',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export const dialogTitleVariants = cva('text-fs-lg tracking-tight-kavan text-t-hi uppercase');
export const dialogDescriptionVariants = cva('text-fs-sm leading-relaxed text-t-md');

export type DialogContentVariantProps = VariantProps<typeof dialogContentVariants>;
