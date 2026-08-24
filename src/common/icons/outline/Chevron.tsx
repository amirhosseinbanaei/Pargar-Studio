import { cn } from '@/common/lib/utils';
import type { SvgIcon } from '@/common/types/svg';

/**
 * Drawn with `currentColor` and sized by `className`, so it inherits the colour
 * of whatever control hosts it and needs no colour prop.
 *
 * `aria-hidden` by default: an icon inside a labelled control is decoration.
 * When an icon is a button's ONLY content, the button carries the `aria-label`.
 */
export function Chevron({ className, ...props }: SvgIcon) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      className={cn('size-4 text-current', className)}
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m6 9 6 6 6-6" />
    </svg>
  );
}
