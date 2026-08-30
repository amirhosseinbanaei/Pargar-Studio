// src/common/components/layout/Footbar.tsx
/**
 * The footer bar: the city and the clock, centred, and nothing else.
 *
 * Ported from `legacy/index.html:167`, where `applyChrome()` in `legacy/js/main.js:35`
 * built the middle group at runtime because the strings and the digits were both
 * locale-dependent.
 *
 * TWO OF THE THREE GROUPS ARE GONE (prompt 12), and what went with them is worth stating
 * because none of it moved anywhere else:
 *
 *   - `Est. 2007` and the project count are DELETED. They were the only render of either
 *     figure in the app, so both are off the site entirely — a copy change, recorded in
 *     AGENTS.md rather than made quietly. `projectCount` went with them, and with it the
 *     `listProjects()` read the site layout was doing purely to feed this file.
 *   - `LanguageSwitch` MOVED to the masthead, which now carries it at every width and at
 *     every stage state. `i18n.css` used to hide the masthead's copy on the wide index
 *     precisely because the footer carried it there; with the footer empty that rule would
 *     have left the index with no language switch at all.
 *   - `SectionHint` is DELETED outright, along with the `id="hint"` element the shell
 *     transition wrote into. `motion/shell.ts` looks it up with `getElementById` and both
 *     of its writes are already guarded by `if (hint)`, so the element's absence is a
 *     no-op there — the guards stay.
 *
 * `.footbar` is `justify-content: space-between` in the ported `shell.css`, which puts a
 * lone child at the start of the row rather than in the middle. `route.css` centres it,
 * beside the rest of this prompt's geometry, so the port stays a port.
 *
 * Everything is prerendered except the clock, which sits behind its own `<Suspense>` — see
 * `TehranClock`. It is the one request-dependent value on the page and moving it out of
 * that boundary would make every route dynamic.
 */
import { Suspense } from 'react';
import type { Locale } from '@/common/schemas/locale';
import { getIntl } from '@/common/i18n';
import { TehranClock } from './TehranClock';

export interface FootbarProps {
  locale: Locale;
}

export function Footbar({ locale }: FootbarProps) {
  const { t } = getIntl(locale);

  return (
    <div className="footbar">
      <div className="footbar__set">
        <span>{t('ui.tehran')}</span>
        {/* The legacy fallback, verbatim: a dash is what the box holds until the
            request-dependent value streams in. */}
        <Suspense fallback={<span className="footbar__clock">—</span>}>
          <TehranClock locale={locale} />
        </Suspense>
      </div>
    </div>
  );
}
