// src/common/components/layout/ColumnShell.tsx
/**
 * The five-column index — the site's front door, rendered on the server.
 *
 * Ported from `legacy/index.html:112`. Structurally it is the same markup, and it has to
 * be: `shell.css` and the shell transition both address `.col[data-id]`, `.col__art`,
 * `.col__title .ch`, `.col__idx` and `.col__rule` by name.
 *
 * THREE THINGS ARE DIFFERENT, and each of them is the point of the migration:
 *
 *  1. `.col__art` arrives FULL. The generators are pure and server-safe, so the SVG is in
 *     the HTML — no lazy draw on idle, no generator JavaScript in the browser, no layout
 *     shift when a drawing appears. `shell.ts`'s `ensureArt` sees a populated host and
 *     does nothing, which is why it no longer imports `draw`.
 *  2. The titles are `<Link>`s to REAL ROUTES, not `href="#projects"` plus a hash handler.
 *     Middle-click, open-in-new-tab, prefetch and a crawler all work, and with JavaScript
 *     disabled the whole index is navigable.
 *  3. The `.panel` div is gone. A section is a route now, not a state of this page.
 *
 * The `.ch` spans, the `data-cursor` labels and the per-column index numerals are all
 * emitted here rather than written in by a script after boot.
 */
import Link from 'next/link';
import { draw } from '@/common/lib/art';
import { COLUMN_ART_RATIO, NAV } from '@/common/constants/site';
import { localeHref } from '@/common/i18n/navigation';
import type { Dictionary } from '@/common/i18n';
import { GlyphText } from './GlyphText';

export interface ColumnShellProps {
  dictionary: Dictionary;
}

export function ColumnShell({ dictionary }: ColumnShellProps) {
  const { t, num, locale } = dictionary;

  return (
    <nav className="cols" id="cols" aria-label={t('ui.sections')}>
      {NAV.map((section, i) => (
        <section className="col" key={section.id} data-id={section.id} data-i={i}>
          <i className="col__rule" />

          {/*
            `dangerouslySetInnerHTML` is correct and safe here, and it is the ONLY way to
            put a generated SVG into the tree without parsing it into React elements: the
            string comes from `common/lib/art`, which is a pure function of a hardcoded
            seed and emits no attribute that is not its own. Nothing user-supplied reaches
            it. Parsing it instead would ship a parser and re-serialize identical markup.

            `data-art` / `data-seed` are kept for one reason: they are `ensureArt`'s
            fallback contract for a surface with no server render, and dropping them here
            would leave that path silently unreachable.
          */}
          <div
            className="col__art"
            data-art={section.art}
            data-seed={section.seed}
            dangerouslySetInnerHTML={{ __html: draw(section.art, section.seed, COLUMN_ART_RATIO) }}
          />

          <span className="col__idx">{num(String(i + 1).padStart(2, '0'))}</span>

          <h2 className="col__title">
            <Link
              className="col__hit"
              href={localeHref(locale, section.path)}
              data-open={section.id}
              data-cursor={t('ui.open')}
            >
              <GlyphText>{t(section.labelKey)}</GlyphText>
            </Link>
          </h2>

          <p className="col__caption">{t(section.captionKey)}</p>
        </section>
      ))}
    </nav>
  );
}
