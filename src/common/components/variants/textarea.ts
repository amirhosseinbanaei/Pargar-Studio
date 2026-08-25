// src/common/components/variants/textarea.ts
import { cva, type VariantProps } from 'class-variance-authority';
import { aria, base, disabled, focusTokens, placeholderTokens } from './_shared';
import { prefix } from './prefix';

/**
 * A textarea is an input that grows, so it composes the same `base` — then
 * undoes the two things a single-line control assumes: the fixed `h-control`
 * and the vertical centring.
 */
export const textareaVariants = cva(
  [
    base,
    'h-auto min-h-[6.5rem] items-start py-3 leading-relaxed',
    'transition-colors duration-[var(--d-xs)] ease-out-kavan',
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
        error: 'border-danger',
      },
      resize: {
        none: 'resize-none',
        vertical: 'resize-y',
      },
    },
    defaultVariants: { variant: 'outline', resize: 'vertical' },
  },
);

export type TextareaVariantProps = VariantProps<typeof textareaVariants>;
