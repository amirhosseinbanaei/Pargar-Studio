// src/common/components/layout/TehranClock.tsx
/**
 * The Tehran clock, server half.
 *
 * `await connection()` is what makes this correct under Cache Components. Every other part
 * of the footer bar is prerendered — it is the same bytes for every visitor — and a clock
 * prerendered alongside it would bake the BUILD time into the static shell and serve it
 * for as long as the page stays cached. `connection()` marks this subtree as depending on
 * the request, so Partial Prerendering streams it into a hole in an otherwise static page
 * instead of giving up on the page.
 *
 * It must therefore be rendered inside a `<Suspense>` — `Footbar` supplies one, with the
 * legacy placeholder as the fallback.
 */
import { connection } from 'next/server';
import type { Locale } from '@/common/schemas/locale';
import { getIntl } from '@/common/i18n';
import { formatTehranTime } from '@/common/i18n/tehran-time';
import { LiveClock } from './LiveClock';

export interface TehranClockProps {
  locale: Locale;
}

export async function TehranClock({ locale }: TehranClockProps) {
  await connection();

  const { t } = getIntl(locale);
  const suffix = t('ui.irst');

  return (
    <LiveClock
      locale={locale}
      initial={formatTehranTime(new Date(), locale, suffix)}
      suffix={suffix}
    />
  );
}
