// src/common/components/variants/select.ts
import { cva, type VariantProps } from 'class-variance-authority';
import {
  aria,
  base,
  disabled,
  focusTokens,
  placeholderTokens,
  popoverContent,
  popoverItem,
} from './_shared';
import { prefix } from './prefix';

/**
 * The trigger deliberately composes the SAME `base` as `inputVariants`: a
 * select sitting next to a text input must be the same height and share an
 * edge, and one shared constant is the only way to guarantee that.
 *
 * The prefixes differ because the states arrive differently — a listbox trigger
 * has no `::placeholder`, it gets `data-placeholder` from Radix, and it has no
 * `:focus` ring of its own because the popover owns the open state.
 */
export const selectTriggerVariants = cva(
  [
    base,
    // `group` is load-bearing, not decoration: the chevron in `ds/Select`
    // rotates with `group-data-[state=open]:rotate-180`, and without this class
    // that selector matches nothing and the arrow never turns.
    'group justify-between transition-colors duration-[var(--d-xs)] ease-out-kavan',
    prefix('data-[placeholder]:', placeholderTokens),
    prefix('focus:', focusTokens),
    'data-[state=open]:border-rule-md',
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
      size: {
        sm: 'h-9 text-fs-xs',
        md: 'h-control text-fs-sm',
        lg: 'h-12 text-fs-md',
      },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
);

export const selectContentVariants = cva([popoverContent, 'max-h-72 p-1']);
export const selectItemVariants = cva([popoverItem]);

export type SelectTriggerVariantProps = VariantProps<typeof selectTriggerVariants>;
