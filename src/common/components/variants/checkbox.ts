// src/common/components/variants/checkbox.ts
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * A square hairline box that fills with champagne when checked — the same
 * `--a-1` the shell uses for its marks, so a checked box reads as the same
 * "this one" signal as an active column.
 *
 * The disabled classes are spelled out literally rather than composed from the
 * shared `disabled` string: Radix renders a `<button>` and signals with
 * `data-disabled`, not `:disabled`, and Tailwind v4's scanner reads source TEXT
 * — a prefix built at runtime is never seen, so the utility is never generated
 * and the control simply does not dim, in the production build only.
 */
export const checkboxVariants = cva(
  [
    'peer inline-flex shrink-0 items-center justify-center rounded-control',
    'border border-rule-md bg-s-4 text-s-0',
    'transition-colors duration-[var(--d-xs)] ease-out-kavan',
    'outline-none focus-visible:outline-1 focus-visible:outline-offset-[3px] focus-visible:outline-a-1',
    'data-[state=checked]:border-a-1 data-[state=checked]:bg-a-1',
    'data-[state=indeterminate]:border-a-1 data-[state=indeterminate]:bg-a-1',
    'aria-invalid:border-danger',
    'data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-disabled',
  ],
  {
    variants: {
      size: {
        sm: 'size-4',
        md: 'size-5',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export type CheckboxVariantProps = VariantProps<typeof checkboxVariants>;
