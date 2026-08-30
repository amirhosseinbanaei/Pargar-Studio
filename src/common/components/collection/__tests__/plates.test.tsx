/**
 * A RECORD WITH NO PHOTOGRAPH SHOWS NO PHOTOGRAPH — and nothing else either.
 *
 * ═══ THIS FILE REPLACES `drawing-identity.test.ts` ════════════════════════════════
 * That test lived in `modules/projects/components/__tests__/` and pinned the seed contract
 * the art layer made: `drawingSet(slug, types)[0]` drawn at the bare slug IS
 * `kindFor(slug, types)`, so the card in the grid and the first plate on the page were the
 * same picture. It was a real contract and it was easy to break by accident.
 *
 * Prompt 14 reversed the decision underneath it. There are no generated drawings on a card
 * or a detail page any more, so nothing in the application performs that arithmetic and a
 * test asserting it would pin a promise nobody makes. It was REPLACED rather than deleted —
 * a behaviour that loses its test loses the only thing that would notice it coming back —
 * and it moved here, beside the two components that own the rule, rather than staying in
 * `projects`: the rule is `common/`'s, and all three sections depend on it.
 *
 * (`drawingSet` and `kindFor` themselves are untouched in `common/lib/art/`, which keeps its
 * own unit tests. The five index columns still draw, through `draw()` and the constants in
 * `site.ts` — a different call path, and prompt 13's decision, not this one's.)
 *
 * ═══ WHAT IS PINNED HERE ══════════════════════════════════════════════════════════
 * The two halves that were argued over, so that reversing either is a failing test rather
 * than a silent change:
 *
 *  - An empty CARD keeps its frame. The frame holds the grid's proportions, so dropping it
 *    would reflow all 76 cards the first time somebody uploaded one photograph.
 *  - An empty DETAIL HEAD renders NOTHING. Three empty boxes at the top of every project
 *    page is the "grey rectangles" failure `CardPlate`'s header warns about, arriving by a
 *    different door — and it is the opposite call from the card's, deliberately.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CardPlate } from '../CardPlate';
import { DetailPlates, HEAD_PLATE_COUNT } from '../DetailPlates';
import { GalleryBand } from '../GalleryBand';
import type { LocaleImage } from '@/common/schemas/image';

/** Stored paths are `YYYY/MM/<32 hex>.<ext>`; these are shaped like the real thing. */
const image = (n: number): LocaleImage => ({
  path: `2026/08/${String(n).repeat(32).slice(0, 32)}.jpg`,
  alt: `Photograph ${n}`,
});

describe('CardPlate', () => {
  it('renders the frame and NOTHING inside it when there is no photograph', () => {
    const { container } = render(<CardPlate image={null} />);
    const frame = container.querySelector('.card__frame');

    // The frame survives — it is what holds the card's 4:3 box and the reveal's clip-path,
    // so the grid's rhythm is identical with and without a picture.
    expect(frame).not.toBeNull();
    // And it is empty: no `<img>`, and no generated `<svg>` either. The second half is the
    // reversal — before prompt 14 this frame always held a drawing.
    expect(frame?.querySelector('img')).toBeNull();
    expect(frame?.querySelector('svg')).toBeNull();
  });

  it('renders the photograph, described, when there is one', () => {
    const { container } = render(<CardPlate image={image(1)} />);
    const img = container.querySelector('img');

    expect(img).not.toBeNull();
    // Never empty: a path with no alt text for this locale is treated as "no image"
    // upstream, so this component never receives an undescribed one.
    expect(img?.getAttribute('alt')).toBe('Photograph 1');
  });
});

describe('DetailPlates', () => {
  it('renders NOTHING AT ALL for a record with no photographs', () => {
    // The opposite call from the card's, and deliberately: there is no grid rhythm to hold
    // at the head of a page, only a hole. The page starts at its title instead.
    const { container } = render(<DetailPlates images={[]} />);
    expect(container.querySelector('.detail__plates')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('renders as many plates as there are photographs, up to three', () => {
    for (const count of [1, 2, 3]) {
      const images = Array.from({ length: count }, (_, i) => image(i + 1));
      const { container } = render(<DetailPlates images={images} />);
      expect(container.querySelectorAll('.detail__plate')).toHaveLength(count);
    }
  });

  it('states the count on the container, which is what `route.css` styles one and two on', () => {
    // The rules for a one- and two-plate head key off this attribute. Without it the ported
    // `2fr 1fr` grid — drawn for exactly three boxes — leaves a hole where the third was.
    const { container } = render(<DetailPlates images={[image(1), image(2)]} />);
    expect(container.querySelector('.detail__plates')?.getAttribute('data-count')).toBe('2');
  });

  it('takes at most HEAD_PLATE_COUNT and leaves the rest to the band', () => {
    const images = Array.from({ length: 8 }, (_, i) => image(i + 1));
    const { container } = render(<DetailPlates images={images} />);
    expect(container.querySelectorAll('.detail__plate')).toHaveLength(HEAD_PLATE_COUNT);
  });

  it('never captions a plate — the caption named a GENERATOR, and there are none', () => {
    const { container } = render(<DetailPlates images={[image(1)]} />);
    expect(container.querySelector('figcaption')).toBeNull();
  });
});

describe('GalleryBand — the truncation prompt 14 lifted', () => {
  it('renders every photograph past the head, in stored order', () => {
    // The defect: a gallery longer than two was silently dropped. An editor could upload
    // eight photographs, watch the save succeed, and find five of them on no page at all.
    const images = Array.from({ length: 8 }, (_, i) => image(i + 1));
    const { container } = render(
      <GalleryBand images={images.slice(HEAD_PLATE_COUNT)} heading="Photographs" />,
    );

    const rendered = [...container.querySelectorAll('img')].map(img => img.getAttribute('alt'));
    expect(rendered).toEqual([
      'Photograph 4',
      'Photograph 5',
      'Photograph 6',
      'Photograph 7',
      'Photograph 8',
    ]);
  });

  it('renders nothing when there is nothing left over', () => {
    // Which is every record today, and must not leave an empty heading on the page.
    const { container } = render(<GalleryBand images={[]} heading="Photographs" />);
    expect(container.firstChild).toBeNull();
  });

  it('names the section with its own heading, so it is a real landmark', () => {
    const { container } = render(<GalleryBand images={[image(4)]} heading="Photographs" />);
    const section = container.querySelector('section');
    const headingId = section?.getAttribute('aria-labelledby');

    expect(headingId).not.toBeNull();
    expect(container.querySelector(`#${headingId}`)?.textContent).toBe('Photographs');
  });
});
