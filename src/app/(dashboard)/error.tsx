// src/app/(dashboard)/error.tsx
/**
 * The dashboard's failure boundary — one per route group, which is what a group is FOR.
 *
 * It is a SEPARATE boundary from the public site's for a reason prompt 4 already anticipated
 * when it created the `(site)` group: "your data didn't load" is not the same sentence as
 * "this section is unavailable", and one boundary cannot say both. The audience differs too.
 * A visitor to the public site wants a way out; the person here is the one who can actually
 * fix the problem, so this screen shows the status and the digest rather than hiding them.
 *
 * WHAT IT CANNOT CATCH: an error thrown by `(dashboard)/layout.tsx` itself. A boundary sits
 * INSIDE the subtree it guards, so a failing root layout takes its own boundary down with it
 * — that is `global-error.tsx`'s job, and it is the single most common reason a boundary
 * "isn't firing".
 *
 * It renders in ENGLISH with no dictionary lookup, unlike `(site)/error.tsx` which has to
 * read the locale out of the pathname. That is the interface-language decision paying off in
 * the smallest possible way: there is one language here, so there is nothing to resolve.
 */
'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { ErrorState } from '@/common/components/feedback';
import { Button } from '@/common/components/ds';
import { mapError } from '@/common/errors';
import { devError } from '@/common/observability/dev-log';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Dev-only today; `dev-log.ts` records why there is no production tracker yet.
    devError('dashboard:error-boundary', error, { digest: error.digest });
  }, [error]);

  return (
    <main id="main" className="flex min-h-screen flex-col items-start gap-6 px-6 py-16 md:px-10">
      <ErrorState
        error={mapError(error)}
        title="This screen could not be loaded"
        onRetry={reset}
        retryLabel="Try again"
      />

      {/*
        The digest is the ONLY handle that correlates a scrubbed production error with the
        server log line that has the real stack. Rendering it is the difference between a bug
        report that can be traced and one that says "it broke". It is shown quietly, and the
        message above it is already the normalized one — never a raw `error.message`, which
        in production is scrubbed and in development is a stack trace.
      */}
      {error.digest && (
        <p className="font-mono text-fs-xs tracking-flat-kavan text-t-xlo">digest {error.digest}</p>
      )}

      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard">Back to the dashboard</Link>
      </Button>
    </main>
  );
}
