// src/common/components/layout/Footbar.tsx
/**
 * The footer bar: city and clock, the two standing figures, the language switch and the
 * hint.
 *
 * Ported from `legacy/index.html:167`, where `applyChrome()` in `legacy/js/main.js:35`
 * built the middle group at runtime because the strings and the digits were both
 * locale-dependent. Both are settled on the server here, which is the whole difference:
 * `num()` shapes `2007` and `76` into Persian numerals in the HTML, so a Persian reader
 * with JavaScript disabled still sees `۲۰۰۷` and `۷۶`.
 *
 * Everything is prerendered except the clock, which sits behind its own `<Suspense>` — see
 * `TehranClock`.
 */
import { Suspense } from 'react';
import type { Locale } from '@/common/schemas/locale';
import { getDictionary } from '@/common/i18n';
import { BRAND } from '@/common/constants/site';
import { LanguageSwitch } from './LanguageSwitch';
import { SectionHint } from './SectionHint';
import { TehranClock } from './TehranClock';

export interface FootbarProps {
  locale: Locale;
  /**
   * The size of the archive, READ FROM THE SERVICE by the layout rather than written here
   * as `76`. `BRAND.founded` is a constant because 2007 will not change; the project count
   * changes the first time the prompt-6 dashboard saves a new record, and a literal would
   * then be wrong in the footer of every page with nothing to catch it.
   */
  projectCount: number;
}

export function Footbar({ locale, projectCount }: FootbarProps) {
  const { t, num } = getDictionary(locale);

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

      <div className="footbar__set footbar__set--wide">
        <span>{`${t('ui.est')} ${num(BRAND.founded)}`}</span>
        <span>{`${num(projectCount)} ${t('ui.projectsCount')}`}</span>
      </div>

      <div className="footbar__set">
        <LanguageSwitch current={locale} label={t('ui.language')} />
        <SectionHint index={t('ui.selectSection')} section={t('ui.escToClose')} />
      </div>
    </div>
  );
}
