// src/common/components/feedback/ErrorState.tsx
/**
 * The one error surface, rendering the one normalized error shape.
 *
 * It takes a `NormalizedError` — `{ status, code, message, fieldErrors }` from
 * `@/common/errors` — rather than a loose `title`/`description` pair, so no
 * screen re-implements its own guess at the backend's error union. `mapError`
 * has already turned whatever was thrown into this shape; this component's only
 * job is to show it.
 *
 * 'use client' because it takes an `onRetry` callback: an `error.tsx` boundary
 * is a Client Component and hands it `reset`.
 */
'use client';
import { Button } from '@/common/components/ds/Button';
import { GENERIC_MESSAGE, type NormalizedError } from '@/common/errors';
import { cn } from '@/common/lib/utils';

export interface ErrorStateProps {
  /** The normalized error. Omit only when there is genuinely nothing to show. */
  error?: NormalizedError | null;
  /** Names WHAT failed — "Projects could not be loaded" beats "Error". */
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  error,
  title = 'Something went wrong',
  onRetry,
  retryLabel = 'Try again',
  className,
}: ErrorStateProps) {
  // `message` is guaranteed non-empty by `mapError`, but this component is also
  // reachable with no error at all (a boundary that caught a non-Error throw).
  const message = error?.message?.trim() || GENERIC_MESSAGE;
  const fields = Object.entries(error?.fieldErrors ?? {});

  return (
    // `role="alert"` is what makes a failure ANNOUNCE itself. Without it the
    // screen silently changes and a non-visual user is told nothing.
    <div role="alert" className={cn('flex w-full flex-col items-start gap-4 py-12', className)}>
      <h2 className="text-fs-lg tracking-tight-kavan text-t-hi uppercase">{title}</h2>
      <p className="max-w-[46ch] font-serif text-fs-md leading-relaxed text-t-md">{message}</p>

      {fields.length > 0 && (
        <ul className="flex max-w-[46ch] flex-col gap-1">
          {fields.map(([field, detail]) => (
            <li key={field} className="text-fs-xs text-danger">
              <span className="text-t-lo">{field}: </span>
              {detail}
            </li>
          ))}
        </ul>
      )}

      {/* Status and code are for the person debugging, not the visitor — shown
          quietly and last, never as the headline.

          The condition is `error &&`, NOT `error.status || error.code`: a
          network failure normalizes to `{ status: 0, code: null }`, and both of
          those are falsy, so the truthiness check silently hid this line for the
          exact case it is most useful in. */}
      {error && (
        <p className="text-fs-xs tracking-tight-kavan text-t-xlo uppercase">
          {error.status ? `Error ${error.status}` : 'Network error'}
          {error.code ? ` · ${error.code}` : ''}
        </p>
      )}

      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
