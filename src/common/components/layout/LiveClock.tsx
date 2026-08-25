// src/common/components/layout/LiveClock.tsx
'use client';
/**
 * The ticking half of the Tehran clock — and ONLY that half.
 *
 * It receives a server-computed `initial` string, so the correct time is in the HTML
 * before any JavaScript runs and hydration has nothing to correct. The legacy markup
 * shipped a literal `—` (`legacy/index.html:172`) and filled it in on boot, which is a
 * visible rewrite on every single page load.
 *
 * `useState(initial)` rather than computing on first render: computing here would produce
 * a different string on the server than in the browser (they run milliseconds apart, and
 * across a minute boundary that is a different value), which React reports as a hydration
 * mismatch and repairs by throwing the server HTML away.
 *
 * 30 seconds, from `legacy/js/main.js:165`. The display has minute resolution, so a
 * shorter interval spends wake-ups to render the same string; a longer one shows a minute
 * that is up to a minute stale.
 */
import { useEffect, useState } from 'react';
import type { Locale } from '@/common/schemas/locale';
import { formatTehranTime } from '@/common/i18n/tehran-time';

const TICK_MS = 30_000;

export interface LiveClockProps {
  locale: Locale;
  /** Already formatted by the server with the same function this component calls. */
  initial: string;
  /** `t('ui.irst')`. Passed in rather than looked up, so no dictionary reaches the client. */
  suffix: string;
}

export function LiveClock({ locale, initial, suffix }: LiveClockProps) {
  const [label, setLabel] = useState(initial);

  useEffect(() => {
    const tick = (): void => setLabel(formatTehranTime(new Date(), locale, suffix));
    // Once immediately: the server value can be seconds or minutes old by the time the
    // bundle has parsed, and on a statically prerendered page it is as old as the build.
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, [locale, suffix]);

  return (
    <span className="footbar__clock" id="clock">
      {label}
    </span>
  );
}
