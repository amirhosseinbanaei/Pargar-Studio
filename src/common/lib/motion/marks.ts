// src/common/lib/motion/marks.ts
/**
 * Where the six masthead marks sit — pure geometry, no DOM.
 *
 * At rest the marks land exactly on the six column rules (0%, 20% … 100%, placed by
 * `--x` in `shell.css`). While a section is open they compress into a centred stepper and
 * the dot for the current section grows, so the masthead stops being decoration and starts
 * being a position indicator.
 *
 * EXTRACTED IN PROMPT 4, and this is the only reason: on the static site the stepper had
 * exactly one driver — the shell's open/close transition, which owned the whole document.
 * With real routes there are two. The shell drives it during the transition off the home
 * page, and the site layout drives it on every section route, where no shell exists at all
 * (a reader who deep-links to `/en/projects` never plays a transition and must still see
 * the first dot grown). Two drivers computing the same geometry from two copies of the
 * numbers is how the stepper ends up mirrored in one place and not the other.
 *
 * The numbers and the mirroring are unchanged from `legacy/js/ui/shell.js`.
 */

/** Pixel gap between adjacent dots once compressed. */
export const MARK_GAP = 18;

/** How much the active dot grows. Horizontal only — a taller dot reads as a different mark. */
export const MARK_ACTIVE_SCALE = 2.6;

/** Sections the stepper indexes: the five columns. The sixth mark is the lead bar. */
export const MARK_SECTIONS = 5;

export interface MarkTarget {
  /** Translation from the mark's CSS resting position, in px. */
  x: number;
  /** Horizontal scale. */
  s: number;
}

/**
 * @param activeIndex column index 0–4, or `null` for the resting distribution
 * @param width       measured width of the `.marks` box; the marks are placed as a
 *                    percentage of it, so it is the only measurement the stepper needs
 * @param isRTL       Persian. The stepper is laid out left-to-right, but the columns run
 *                    right-to-left, so the dot that grows is mirrored to match what the
 *                    reader actually sees.
 * @param count       number of marks, including the lead bar at index 0
 */
export function markTargets(
  activeIndex: number | null,
  width: number,
  isRTL: boolean,
  count: number,
): MarkTarget[] {
  const rest = Array.from({ length: count }, (_, k) => (k / MARK_SECTIONS) * width);

  if (activeIndex == null) return Array.from({ length: count }, () => ({ x: 0, s: 1 }));

  const start = (width - MARK_GAP * (MARK_SECTIONS - 1)) / 2;
  const active = isRTL ? MARK_SECTIONS - 1 - activeIndex : activeIndex;

  return Array.from({ length: count }, (_, k) => {
    if (k === 0) return { x: 0, s: 1 }; // the lead mark holds its position
    const idx = k - 1; // 0..4
    return { x: start + idx * MARK_GAP - rest[k], s: idx === active ? MARK_ACTIVE_SCALE : 1 };
  });
}
