// src/common/components/variants/button.ts
import { cva, type VariantProps } from 'class-variance-authority';
import { disabled } from './_shared';

/**
 * The button table. No JSX and no hooks live here on purpose: a restyle becomes
 * a diff in a file with nothing else in it, and `VariantProps` below types the
 * component's `variant`/`size` props so the type and the CSS cannot drift.
 */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-control',
    'text-fs-xs tracking-mid-kavan whitespace-nowrap uppercase',
    'transition-colors duration-[var(--d-xs)] ease-out-kavan',
    'outline-none focus-visible:outline-1 focus-visible:outline-offset-[3px] focus-visible:outline-a-1',
    disabled,
  ],
  {
    variants: {
      variant: {
        primary: 'bg-a-1 text-s-0 hover:bg-a-1/90',
        secondary: 'bg-s-3 text-t-hi hover:bg-s-4',
        outline: 'border border-rule bg-transparent text-t-md hover:border-rule-md hover:text-t-hi',
        ghost: 'bg-transparent text-t-lo hover:text-t-hi',
        danger: 'bg-danger text-s-0 hover:bg-danger/90',
      },
      size: {
        sm: 'h-9 px-3',
        md: 'h-control px-5',
        lg: 'h-12 px-7 text-fs-sm',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
