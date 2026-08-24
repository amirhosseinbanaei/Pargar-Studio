// src/common/components/variants/table.ts
import { cva, type VariantProps } from 'class-variance-authority';

/**
 * The dashboard table.
 *
 * It reproduces the `.rows` / `.row` treatment the ported `panel.css` already
 * uses for the media and design lists — hairline rules top and bottom, no
 * vertical borders, uppercase tracked headers, a barely-there hover wash. The
 * public archive and the dashboard that edits it should look like one thing.
 */
export const tableVariants = cva('w-full border-collapse text-start', {
  variants: {
    density: {
      comfortable: '[&_td]:py-4 [&_th]:py-3',
      compact: '[&_td]:py-2 [&_th]:py-2',
    },
  },
  defaultVariants: { density: 'comfortable' },
});

export const tableHeadVariants = cva(
  'border-b border-rule text-fs-xs tracking-mid-kavan text-t-lo uppercase',
);

export const tableRowVariants = cva(
  'border-b border-rule transition-colors duration-[var(--d-xs)] ease-out-kavan',
  {
    variants: {
      interactive: {
        // rgba(244,239,231,0.022) is what `.row:hover` uses in panel.css; the
        // token ramp has no step that faint, and inventing one for a single
        // hover wash would add a token nothing else could use.
        true: 'cursor-pointer hover:bg-t-hi/[0.022]',
        false: '',
      },
      selected: {
        true: 'bg-s-3',
        false: '',
      },
    },
    defaultVariants: { interactive: false, selected: false },
  },
);

export const tableCellVariants = cva(
  'px-3 align-baseline text-fs-sm text-t-md first:ps-0 last:pe-0',
);

export type TableVariantProps = VariantProps<typeof tableVariants>;
export type TableRowVariantProps = VariantProps<typeof tableRowVariants>;
