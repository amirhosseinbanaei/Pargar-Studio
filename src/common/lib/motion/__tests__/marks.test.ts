// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MARK_ACTIVE_SCALE, MARK_GAP, markTargets } from '../marks';

const COUNT = 6;
const WIDTH = 1000;

describe('markTargets', () => {
  it('leaves every mark on its CSS resting position when nothing is open', () => {
    const targets = markTargets(null, WIDTH, false, COUNT);
    expect(targets).toHaveLength(COUNT);
    expect(targets.every(t => t.x === 0 && t.s === 1)).toBe(true);
  });

  it('holds the lead mark and compresses the other five', () => {
    const targets = markTargets(0, WIDTH, false, COUNT);
    expect(targets[0]).toEqual({ x: 0, s: 1 });
    // The five section dots sit MARK_GAP apart, centred.
    const xs = targets.slice(1).map((t, i) => t.x + ((i + 1) / 5) * WIDTH);
    for (let i = 1; i < xs.length; i += 1) expect(xs[i] - xs[i - 1]).toBeCloseTo(MARK_GAP);
  });

  it('grows exactly one dot, and it is the active one', () => {
    const grown = markTargets(2, WIDTH, false, COUNT).filter(t => t.s === MARK_ACTIVE_SCALE);
    expect(grown).toHaveLength(1);
    expect(markTargets(2, WIDTH, false, COUNT)[3].s).toBe(MARK_ACTIVE_SCALE);
  });

  it('MIRRORS the active dot under RTL', () => {
    // The stepper is laid out left-to-right while the columns run right-to-left. Without
    // the mirror, every Persian reader sees the indicator point at the wrong column — and
    // it is correct for the middle column, which is why it survives casual checking.
    const ltr = markTargets(0, WIDTH, false, COUNT).findIndex(t => t.s === MARK_ACTIVE_SCALE);
    const rtl = markTargets(0, WIDTH, true, COUNT).findIndex(t => t.s === MARK_ACTIVE_SCALE);
    expect(ltr).toBe(1);
    expect(rtl).toBe(5);

    // The centre column is its own mirror — the case that hides the bug.
    expect(markTargets(2, WIDTH, false, COUNT).findIndex(t => t.s === MARK_ACTIVE_SCALE)).toBe(
      markTargets(2, WIDTH, true, COUNT).findIndex(t => t.s === MARK_ACTIVE_SCALE),
    );
  });
});
