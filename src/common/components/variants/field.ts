// src/common/components/variants/field.ts
import { cva, type VariantProps } from 'class-variance-authority';
import { eyebrow } from './_shared';

/**
 * Label, description and error message — the three things wrapped around every
 * control. They share one table because they must share one rhythm: a form
 * where the label sits 4px from one input and 8px from the next reads as
 * broken even when nobody can say why.
 */
export const fieldVariants = cva('flex w-full flex-col gap-2');

export const labelVariants = cva([eyebrow, 'select-none'], {
  variants: {
    invalid: {
      true: 'text-danger',
      false: '',
    },
    disabled: {
      true: 'opacity-disabled',
      false: '',
    },
  },
  defaultVariants: { invalid: false, disabled: false },
});

export const fieldDescriptionVariants = cva('text-fs-xs leading-relaxed text-t-lo');

export const fieldMessageVariants = cva('text-fs-xs text-danger');

export type LabelVariantProps = VariantProps<typeof labelVariants>;
