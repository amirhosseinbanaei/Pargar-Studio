// src/modules/design/components/DesignDetail.tsx
/**
 * One design work.
 *
 * Ported field for field from `legacy/js/ui/panel.js:229`, against the record at
 * `legacy/data/works.js:10`: category, year, status, client, scope, materials, team, then
 * the facts table, with the description running beside the specification column.
 *
 * TWO THINGS THAT LOOK LIKE DETAILS AND ARE NOT:
 *
 *  - THE FACTS TABLE RENDERS FROM THE RECORD, not from a label list. `facts` is an array
 *    of `{ k, v }` pairs and BOTH halves are translated — `legacy/data/works.fa.js:28`
 *    carries a Persian `facts` array whose keys are Persian too. So the rows come out of
 *    the locale-resolved record in its own order; a hardcoded list of labels here would
 *    print English keys on the Persian page and silently drop any pair an editor adds.
 *
 *  - THE DESCRIPTION IS SPLIT ON BLANK LINES, exactly as `legacy/js/ui/panel.js:249` did.
 *    Every one of the nine records is two paragraphs separated by `\n\n`; rendered as a
 *    single node those paragraphs run together into one wall of text.
 *
 * `status` is canonical English in the column and is translated by `term()` — it is
 * taxonomy, not content. `legacy/data/works.fa.js` translates it per record and that value
 * is deliberately not stored (AGENTS.md).
 */
import { BackLink, DetailPlates, SpecRow } from '@/common/components/collection';
import type { Dictionary } from '@/common/i18n';
import { localeHref } from '@/common/i18n/navigation';
import type { DesignWork } from '@/common/schemas/design-work';

export interface DesignDetailProps {
  work: DesignWork;
  dictionary: Dictionary;
}

export function DesignDetail({ work, dictionary }: DesignDetailProps) {
  const { t, num, term, list, locale } = dictionary;
  const paragraphs = work.description.split(/\n+/).filter(Boolean);

  return (
    <div className="route route--solo" id="main">
      <div className="route__main">
        <article className="detail">
          <BackLink href={localeHref(locale, '/design')} label={t('ui.allWorks')} />

          <h1 className="detail__title">{work.title}</h1>
          <p className="detail__blurb">{work.blurb}</p>

          <DetailPlates seed={work.slug} types={[work.category]} dictionary={dictionary} />

          <div className="detail__cols">
            <div className="spec">
              <SpecRow label={t('filter.category')} value={term('cat', work.category)} />
              <SpecRow label={t('spec.year')} value={num(work.year)} />
              <SpecRow label={t('spec.status')} value={term('status', work.status)} />
              <SpecRow label={t('spec.client')} value={work.client} />
              <SpecRow label={t('spec.scope')} value={work.scope} />
              <SpecRow label={t('spec.materials')} value={work.materials} />
              <SpecRow label={t('spec.team')} value={list(work.team)} />
              {work.facts.map(fact => (
                <SpecRow key={fact.k} label={fact.k} value={fact.v} />
              ))}
            </div>
            <div className="prose">
              {paragraphs.map(paragraph => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
