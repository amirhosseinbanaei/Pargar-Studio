import { cn } from '@/common/lib/utils';
import type { SvgIcon } from '@/common/types/svg';

export function Close({ className, ...props }: SvgIcon) {
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
      <path strokeLinecap="round" strokeWidth="1.5" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
