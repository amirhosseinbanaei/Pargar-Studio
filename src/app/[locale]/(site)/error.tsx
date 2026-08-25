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
 * The locale comes from the pathname because an `error.tsx` receives no params. That is
 * also why the dictionary is read on the client here: it is the only place in the site
 * that cannot be handed its strings by a Server Component.
 */
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ErrorState } from '@/common/components/feedback';
import { mapError } from '@/common/errors';
import { devError } from '@/common/observability/dev-log';
import { getDictionary } from '@/common/i18n';
import { DEFAULT_LOCALE, isLocale } from '@/common/i18n/routing';

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const first = usePathname().split('/')[1];
  const { t } = getDictionary(isLocale(first) ? first : DEFAULT_LOCALE);

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
