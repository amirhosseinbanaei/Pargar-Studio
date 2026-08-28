// src/app/[locale]/(site)/error.tsx
'use client';
/**
 * The public site's failure boundary — one per route group, which is what a group is FOR.
 *
 * It renders `ErrorState` against the one normalized error shape (`mapError`), never raw
 * JSON and never a blank page. A boundary that prints the caught object is a boundary that
 * shows a stack trace to a visitor and tells them nothing.
 *
 * WHAT IT CANNOT CATCH: an error thrown by `(site)/layout.tsx` itself, or by the root
 * layout. A boundary sits INSIDE the subtree it guards, so a failing layout takes its own
 * boundary down with it — those are `global-error.tsx`'s.
 *
 * An `error.tsx` receives no params, so until prompt 8 this file recovered the locale
 * from the pathname and built its own dictionary. It reads both from context now:
 * `NextIntlClientProvider` sits in the root layout, ABOVE this boundary, so the locale and
 * the messages survive whatever threw below it — and the catalogs no longer have to be
 * imported into the browser bundle to get at four strings.
 */
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorState } from '@/common/components/feedback';
import { mapError } from '@/common/errors';
import { devError } from '@/common/observability/dev-log';

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();

  useEffect(() => {
    // Dev-only today; `dev-log.ts` records why there is no production tracker yet.
    devError('site:error-boundary', error, { digest: error.digest });
  }, [error]);

  return (
    <div className="route route--solo" id="main">
      <div className="route__main">
        <ErrorState
          error={mapError(error)}
          title={t('error.title')}
          onRetry={reset}
          retryLabel={t('ui.retry')}
        />
      </div>
    </div>
  );
}
