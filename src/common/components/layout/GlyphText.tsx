// src/common/components/layout/GlyphText.tsx
/**
 * A column title, split into the `.ch` boxes the FLIP animates.
 *
 * THE RULE, ported from `legacy/js/core/i18n.js:190` via `canSplitGlyphs`: the FLIP target
 * is always `.ch`, but what `.ch` MEANS depends on the script. In Latin it is one box per
 * letter, which is what lets the tracking collapse ride on per-glyph transforms instead of
 * animating `letter-spacing`. In Arabic script it is ONE box holding the whole word,
 * because Arabic-script letters join and wrapping each in its own inline-block destroys
 * the shaping — the word renders as a row of disconnected presentation forms, legible to
 * nobody.
 *
 * Same animation, same code path, one box instead of eight.
 *
 * Emitted on the SERVER. On the static site `setTitles()` wrote this markup with
 * `innerHTML` after boot, so the titles were the last thing to appear and a reader with
 * JavaScript off got an empty column. Here they are in the HTML.
 */
import { canSplitGlyphs } from '@/common/lib/motion';

export interface GlyphTextProps {
  children: string;
}

export function GlyphText({ children }: GlyphTextProps) {
  if (!canSplitGlyphs(children)) {
    return <span className="ch">{children}</span>;
  }

  return (
    <>
      {[...children].map((char, i) =>
        char === ' ' ? (
          // A zero-width box with explicit width: a `.ch` holding a literal space would
          // collapse, and the FLIP would then have nothing to measure between words.
          <span key={i} className="ch ch--space">
            {' '}
          </span>
        ) : (
          <span key={i} className="ch">
            {char}
          </span>
        ),
      )}
    </>
  );
}
