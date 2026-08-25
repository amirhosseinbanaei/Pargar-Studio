// src/modules/projects/components/CardReveal.tsx
'use client';
/**
 * The wipe that opens a card's drawing as it scrolls into view.
 *
 * `panel.css` rests `.card__frame` at `clip-path: inset(0 0 100% 0)` and opens it when the
 * card gains `.is-in`. On the legacy site that class was added by the same observer
 * callback that GENERATED the drawing, so the reveal and the drawing arrived together
 * (`legacy/js/ui/panel.js:608`).
 *
 * Half of that is gone: the drawings are server-rendered, so there is nothing to generate
 * and nothing to defer. What remains is the reveal itself, and it is worth keeping — 76
 * drawings appearing at once as the page paints is a wall, and the stagger is what makes a
 * grid this dense read as a sequence.
 *
 * ONE observer for the whole grid, not one per card: 76 IntersectionObservers is 76
 * separate registrations against the same root, and the callback cost is the same either
 * way. It unobserves each card as it lands, so a long scroll does not keep re-firing.
 *
 * Every failure mode degrades to VISIBLE, never to blank: no IntersectionObserver, a
 * hidden document, or scripting off entirely (`route.css` unclips under
 * `@media (scripting: none)`).
 */
import { useEffect } from 'react';

/** From `legacy/js/ui/panel.js:606`: the first screenful is revealed without waiting. */
const EAGER = 12;

export function CardReveal({ gridId }: { gridId: string }) {
  useEffect(() => {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    const cards = [...grid.querySelectorAll<HTMLElement>('.card')];
    const reveal = (card: HTMLElement): void => card.classList.add('is-in');

    cards.slice(0, EAGER).forEach(reveal);
    const rest = cards.slice(EAGER);
    if (rest.length === 0) return;

    if (document.hidden || !('IntersectionObserver' in window)) {
      rest.forEach(reveal);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          reveal(entry.target as HTMLElement);
          observer.unobserve(entry.target);
        }
      },
      // A margin, so a card is open by the time it is actually on screen rather than
      // wiping open under the reader's eye.
      { rootMargin: '200px 0px' },
    );
    rest.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [gridId]);

  return null;
}
