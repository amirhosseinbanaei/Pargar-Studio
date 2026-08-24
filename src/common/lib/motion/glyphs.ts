// src/common/lib/motion/glyphs.ts
/**
 * Whether a string can be split into per-character boxes for the title FLIP.
 *
 * Arabic-script letters JOIN. Wrapping each one in its own inline-block
 * destroys the shaping and renders the word as a row of disconnected
 * presentation forms — legible to nobody. Persian titles therefore fly as a
 * single unit, and the shell asks this before it splits anything.
 *
 * Ported from `legacy/js/core/i18n.js:190`. It lives beside the shell rather
 * than in a future i18n module because the shell is its only caller and the
 * shell needs it now: the FLIP target is always `.ch`, and this function is
 * the only thing deciding whether `.ch` means one letter or one whole word.
 * Same code path, same animation, either way.
 */
export const canSplitGlyphs = (s = ''): boolean => !/[؀-ۿݐ-ݿ]/.test(s);
