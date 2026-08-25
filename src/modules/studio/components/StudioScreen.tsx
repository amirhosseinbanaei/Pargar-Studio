// src/modules/studio/components/StudioScreen.tsx
/**
 * The studio page — one document with an index rail beside it.
 *
 * Ported section for section from `legacy/js/ui/panel.js:350`: the hero band, the
 * manifesto with its margin column, the founders, the numbers, the history, the awards,
 * the twenty-two current people, and the forty who were here before.
 *
 * THE ALUMNI RENDER. That was an open assumption in the brief and it is settled by the
 * source: `legacy/js/ui/panel.js:438` prints `S.alumni` into a `.names` list under the
 * "Previously" heading, and `STUDIO_SECTIONS` gives it a rail entry. Forty names is a
 * short list in three columns, and leaving people who built the archive off the page
 * would be an editorial decision this port has no standing to make.
 *
 * THE RAIL IS ANCHOR LINKS, not buttons. The legacy rail smooth-scrolled with JavaScript
 * and moved `aria-current` as the reader passed each heading. Anchors reach every section
 * with no script at all and survive with JavaScript off; what is NOT reproduced is the
 * scroll-spy, so no entry claims to be current. Asserting the reader is in the first
 * section when they may be anywhere is a worse answer than not asserting one.
 *
 * Persian copy — the manifesto, the biographies, the chapters, every name — comes out of
 * the database verbatim. The NUMBERS are shaped at render by `num()`, because the columns
 * store Latin digits on purpose (AGENTS.md).
 */
import { draw, portrait } from '@/common/lib/art';
import type { Dictionary } from '@/common/i18n';
import type { MessageKey } from '@/common/i18n';
import type { Studio } from '@/common/schemas/studio';
import { seedOf, type StudioSeeds } from '../lib/seeds';

/**
 * The rail, and the section order — `legacy/js/ui/panel.js:340` exactly. The id is the
 * anchor target, so renaming one breaks a link somebody may have sent.
 */
const SECTIONS: ReadonlyArray<{ id: string; key: MessageKey }> = [
  { id: 'practice', key: 'studio.practice' },
  { id: 'founders', key: 'studio.founders' },
  { id: 'numbers', key: 'studio.numbers' },
  { id: 'history', key: 'studio.history' },
  { id: 'awards', key: 'studio.awards' },
  { id: 'people', key: 'studio.people' },
  { id: 'previously', key: 'studio.previously' },
];

/** The band drawing and the two portrait ratios — `legacy/js/ui/panel.js:367`, `:396`, `:432`. */
const BAND_RATIO = 0.42;
const FOUNDER_RATIO = 0.82;
const TEAM_RATIO = 1.12;
/**
 * The band is an ELEVATION at a fixed seed — `legacy/js/ui/panel.js:367` — not a portrait
 * and not derived from any record. It is the studio's own house, so nothing an editor
 * saves should redraw it.
 */
const BAND_KIND = 'elevation';
const BAND_SEED = 'kavan-studio-house';

export interface StudioScreenProps {
  studio: Studio;
  /** English-derived portrait seeds, index-aligned with `studio.founders` / `studio.team`. */
  seeds: StudioSeeds;
  dictionary: Dictionary;
}

export function StudioScreen({ studio, seeds, dictionary }: StudioScreenProps) {
  const { t, num } = dictionary;

  return (
    <div className="route" id="main">
      <div className="route__rail">
        <nav className="jump" aria-label={t('studio.practice')}>
          {SECTIONS.map((section, i) => (
            <a className="jump__b magnet" key={section.id} href={`#s-${section.id}`}>
              <span className="jump__n">{num(String(i + 1).padStart(2, '0'))}</span>
              <span className="jump__t">{t(section.key)}</span>
            </a>
          ))}
        </nav>
      </div>

      <div className="route__main">
        <div className="sheet">
          <section className="band" id="s-practice">
            <div
              className="band__art"
              dangerouslySetInnerHTML={{ __html: draw(BAND_KIND, BAND_SEED, BAND_RATIO) }}
            />
            <div className="band__cap">
              <span className="band__k">{t('ui.tehran')}</span>
              <span className="band__v">{t('brand.name')}</span>
            </div>
          </section>

          <div className="split">
            <p className="sheet__lead">{studio.manifesto}</p>
            <aside className="side">
              <h2 className="side__h">{t('studio.name')}</h2>
              <p className="side__p">{t('brand.meaning')}</p>
              <h2 className="side__h">{t('studio.numbers')}</h2>
              <dl className="side__stats">
                {studio.stats.map(stat => (
                  <div key={stat.label}>
                    <dt>{stat.label}</dt>
                    <dd>{num(stat.value)}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>

          <h2 className="sheet__h" id="s-founders">
            {t('studio.founders')}
          </h2>
          <div className="duo">
            {studio.founders.map((founder, i) => (
              <div className="person" key={founder.name}>
                <span
                  className="person__plate"
                  dangerouslySetInnerHTML={{
                    __html: portrait(seeds.founders[i] ?? seedOf(founder.name), FOUNDER_RATIO),
                  }}
                />
                <p className="person__name">{founder.name}</p>
                <p className="person__role">{founder.role}</p>
                <p className="person__born">{founder.born}</p>
                <p className="person__bio">{founder.bio}</p>
              </div>
            ))}
          </div>

          <h2 className="sheet__h" id="s-numbers">
            {t('studio.numbers')}
          </h2>
          <div className="stats">
            {studio.stats.map(stat => (
              <div className="stat" key={stat.label}>
                <p className="stat__v">{num(stat.value)}</p>
                <p className="stat__k">{stat.label}</p>
              </div>
            ))}
          </div>

          <h2 className="sheet__h" id="s-history">
            {t('studio.history')}
          </h2>
          <div className="timeline">
            {studio.chapters.map(chapter => (
              <div className="tl__row" key={chapter.year}>
                <span className="tl__y">{num(chapter.year)}</span>
                <span className="tl__t">{chapter.text}</span>
              </div>
            ))}
          </div>

          <h2 className="sheet__h" id="s-awards">
            {t('studio.awards')}
          </h2>
          <div className="rows">
            {studio.awards.map(award => (
              <div className="row" key={`${award.year}-${award.title}`}>
                <span className="row__y">{num(award.year)}</span>
                <span>
                  <span className="row__t">{award.title}</span>
                  <br />
                  <span className="row__b">{award.project}</span>
                </span>
                <span className="row__o">{award.body}</span>
                <span className="row__k">{dictionary.term('kind', 'Award')}</span>
              </div>
            ))}
          </div>

          <h2 className="sheet__h" id="s-people">
            {`${t('studio.people')} — ${num(studio.team.length)}`}
          </h2>
          <div className="folk">
            {studio.team.map((person, i) => (
              <figure className="folk__x" key={person}>
                <span
                  className="folk__plate"
                  dangerouslySetInnerHTML={{
                    __html: portrait(seeds.team[i] ?? seedOf(person), TEAM_RATIO),
                  }}
                />
                <figcaption className="folk__n">{person}</figcaption>
              </figure>
            ))}
          </div>

          <h2 className="sheet__h" id="s-previously">
            {`${t('studio.previously')} — ${num(studio.alumni.length)}`}
          </h2>
          <ul className="names">
            {studio.alumni.map(name => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
