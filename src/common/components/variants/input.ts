// src/common/components/variants/input.ts
import { cva, type VariantProps } from 'class-variance-authority';
import { aria, base, disabled, focusTokens, placeholderTokens } from './_shared';
import { prefix } from './prefix';

export const inputVariants = cva(
  [
    base,
    'w-full transition-colors duration-[var(--d-xs)] ease-out-kavan',
    prefix('placeholder:', placeholderTokens),
    prefix('focus:', focusTokens),
    disabled,
    aria,
  ],
  {
    variants: {
      variant: {
        outline: 'bg-s-4',
        fill: 'border-0 bg-s-3',
        ghost: 'border-0 bg-transparent px-0',
        error: 'border-danger',
      },
      size: {
        sm: 'h-9 text-fs-xs',
        md: 'h-control text-fs-sm',
        lg: 'h-12 text-fs-md',
      },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
);

export type InputVariantProps = VariantProps<typeof inputVariants>;
