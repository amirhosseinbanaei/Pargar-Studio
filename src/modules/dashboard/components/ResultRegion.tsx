// src/modules/dashboard/components/ResultRegion.tsx
/**
 * The inline region every dashboard screen renders a write's outcome into.
 *
 * ─── WHY INLINE AND NOT A TOAST ───────────────────────────────────────────────────
 * A toast is a message that leaves. For a save it is the wrong shape twice over: it is gone
 * by the time an editor looks back at the form to check what happened, and it cannot say
 * WHICH input is wrong — that is `applyFieldErrors`' job, and this region deliberately shows
 * only what is left over after the field-keyed errors have been bound to their inputs.
 *
 * A toast library is also a dependency this project does not have and does not need
 * (AGENTS.md bans adding one for something already solved). One element with `role="alert"`
 * is the whole feature.
 *
 * ─── IT RENDERS THE NORMALIZED SHAPE, NOT A LOOSE STRING ──────────────────────────
 * It takes a `NormalizedError` — `{ status, code, message, fieldErrors }` from
 * `@/common/errors` — so no screen re-implements its own guess at what a failure looks like.
 * `mapError` has already turned a status and a body into that shape; the only job here is to
 * show it, and to show the status quietly beside the sentence because the person reading it
 * is the person who will have to describe the problem to somebody else.
 *
 * ─── BOTH REGIONS RENDER ALWAYS ───────────────────────────────────────────────────
 * Empty, when there is nothing to say. A live region inserted into the DOM at the same
 * moment its text appears is NOT announced, because assistive technology has nothing to
 * compare the new content against — it has to be observing the node before the text lands.
 * That is the single most common reason a form's success message is silent for a screen
 * reader while looking perfectly fine on screen.
 *
 * No directive: it is markup with no state and no handler, so it works in a Server Component
 * and inside a `'use client'` form alike.
 */
import type { NormalizedError } from '@/common/errors';

export interface ResultRegionProps {
  /** Shown in the polite region. A save's confirmation, not a failure. */
  success?: string | null;
  /** Shown in the alert region. Already normalized — never a raw caught value. */
  error?: NormalizedError | null;
  /**
   * A form-level sentence with no status behind it — a rate limit, a locally-decided
   * refusal. Rendered in the same alert region as `error`, because to a reader they are the
   * same thing: something went wrong and here is what.
   */
  message?: string | null;
}

export function ResultRegion({ success, error, message }: ResultRegionProps) {
  const failure = message ?? error?.message ?? null;

  return (
    <div className="flex min-h-[1.5rem] flex-col gap-1">
      <p role="status" aria-live="polite" className="text-fs-sm tracking-flat-kavan text-a-1">
        {success}
      </p>
      <p role="alert" className="text-fs-sm tracking-flat-kavan text-danger">
        {failure}
        {/*
          Status and code are for whoever has to debug this, never the headline. The guard is
          `error &&`, not `error.status || error.code`: a request that never reached the
          server normalizes to `{ status: 0, code: null }`, and both of those are falsy — so
          a truthiness check would hide this line in exactly the case it is most useful.
        */}
        {error && (
          <span className="ms-2 text-fs-xs tracking-tight-kavan text-t-xlo uppercase">
            {error.status ? `· ${error.status}` : '· no response'}
            {error.code ? ` · ${error.code}` : ''}
          </span>
        )}
      </p>
    </div>
  );
}
