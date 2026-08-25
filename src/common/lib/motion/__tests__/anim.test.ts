/**
 * The four invariants `legacy/README.md` states, as tests.
 *
 * Each exists because of a real failure, so each gets an assertion rather than
 * only a comment: a comment does not fail the build when someone "simplifies"
 * `fill: 'backwards'` to `'forwards'` or swaps `done` back to `finished`.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { EASE, animate, clamp, damp, flip, lerp, onTick, round, spring, wait } from '../anim';
import { canSplitGlyphs } from '../glyphs';

/** jsdom has no WAAPI. This is the smallest stand-in that records the call. */
interface FakeAnimation {
  finished: Promise<void>;
  done?: Promise<void>;
}
let calls: { keyframes: unknown; options: KeyframeAnimationOptions }[] = [];

function makeEl(settle: 'resolve' | 'never' = 'resolve'): HTMLElement {
  const el = document.createElement('div');
  el.animate = ((keyframes: unknown, options: KeyframeAnimationOptions): FakeAnimation => {
    calls.push({ keyframes, options });
    return {
      finished: settle === 'resolve' ? Promise.resolve() : new Promise<void>(() => {}),
    };
  }) as unknown as HTMLElement['animate'];
  return el;
}

beforeEach(() => {
  calls = [];
});

describe('invariant 1 — CSS owns every resting state', () => {
  it('defaults to fill "backwards", never "forwards"', () => {
    animate(makeEl(), [{ opacity: 0 }, { opacity: 1 }]);
    expect(calls[0].options.fill).toBe('backwards');
  });

  it('still lets a caller ask for "forwards" deliberately', () => {
    animate(makeEl(), [{ opacity: 1 }, { opacity: 0 }], { fill: 'forwards' });
    expect(calls[0].options.fill).toBe('forwards');
  });

  it('FLIP never fills at all — the destination is already the CSS state', async () => {
    const a = makeEl();
    // jsdom reports a zero rect for everything, so drive the delta by stubbing.
    let phase = 0;
    a.getBoundingClientRect = (() =>
      ({ left: phase === 0 ? 100 : 0, top: 0, width: 10, height: 10 }) as DOMRect) as never;
    await flip([a], () => {
      phase = 1;
    });
    expect(calls[0].options.fill).toBe('none');
  });
});

describe('invariant 2 — await done, never finished', () => {
  it('exposes `done` on every animation it returns', () => {
    const anim = animate(makeEl(), [{ opacity: 0 }, { opacity: 1 }]);
    expect(anim?.done).toBeInstanceOf(Promise);
  });

  it('resolves `done` even when `finished` never settles, so a state machine cannot strand', async () => {
    vi.useFakeTimers();
    const anim = animate(makeEl('never'), [{ opacity: 0 }, { opacity: 1 }], {
      duration: 100,
      delay: 0,
    });
    let settled = false;
    void anim?.done.then(() => {
      settled = true;
    });
    // The worst-case timer is duration + delay + 150.
    await vi.advanceTimersByTimeAsync(260);
    vi.useRealTimers();
    await Promise.resolve();
    expect(settled).toBe(true);
  });

  it('clears the will-change hint once done, so no layer is held forever', async () => {
    const el = makeEl();
    const anim = animate(el, [{ transform: 'none' }, { transform: 'scale(2)' }]);
    expect(el.style.willChange).toBe('transform');
    await anim?.done;
    expect(el.style.willChange).toBe('');
  });

  it('returns null rather than throwing when the element is absent', () => {
    expect(animate(null, [{ opacity: 0 }])).toBeNull();
  });
});

describe('invariant 3 — one requestAnimationFrame', () => {
  const raf = vi.fn((cb: FrameRequestCallback) => {
    setTimeout(() => cb(performance.now()), 0);
    return 1;
  });

  beforeEach(() => {
    raf.mockClear();
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('three subscribers share ONE loop, not three', async () => {
    const stops = [onTick(() => {}), onTick(() => {}), onTick(() => {})];
    // One request to start the loop; the loop re-requests itself per frame.
    // What must never happen is one request PER SUBSCRIBER at subscribe time.
    expect(raf).toHaveBeenCalledTimes(1);
    stops.forEach(s => s());
  });

  it('unsubscribing the last subscriber stops the loop', () => {
    const stop = onTick(() => {});
    stop();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});

describe('invariant 4 — damping is frame-rate independent', () => {
  it('lands in the same place after one second at 60Hz and at 120Hz', () => {
    const run = (fps: number): number => {
      const dt = 1 / fps;
      let v = 0;
      for (let i = 0; i < fps; i++) v = damp(v, 100, 0.0006, dt);
      return v;
    };
    expect(run(60)).toBeCloseTo(run(120), 6);
    expect(run(60)).toBeCloseTo(run(144), 6);
  });

  it('`smoothing` is literally the fraction remaining after one second', () => {
    expect(damp(0, 100, 0.25, 1)).toBeCloseTo(75, 6);
  });

  it('a naive lerp would NOT be frame-rate independent — this is the bug damp avoids', () => {
    // Measured over a TENTH of a second: given a full second both refresh rates
    // have converged on the target and the defect hides. It shows during the
    // move, which is the only time anyone sees it.
    const frames = (fps: number): number => Math.round(fps * 0.1);
    const naive = (fps: number): number => {
      let v = 0;
      for (let i = 0; i < frames(fps); i++) v = lerp(v, 100, 0.1);
      return v;
    };
    const damped = (fps: number): number => {
      let v = 0;
      for (let i = 0; i < frames(fps); i++) v = damp(v, 100, 0.0006, 1 / fps);
      return v;
    };
    // The naive version is ~25 percentage points further along at 120Hz…
    expect(Math.abs(naive(60) - naive(120))).toBeGreaterThan(20);
    // …while `damp` puts both displays in the same place.
    expect(damped(60)).toBeCloseTo(damped(120), 3);
  });
});

describe('maths helpers', () => {
  it('clamps', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it('rounds to the given precision', () => {
    expect(round(1.23456)).toBe(1.235);
    expect(round(1.23456, 100)).toBe(1.23);
  });

  it('spring converges on its target and jump is instantaneous', () => {
    const s = spring(0, { stiffness: 210, damping: 24 });
    s.target = 100;
    for (let i = 0; i < 400; i++) s.step(1 / 60);
    expect(s.value).toBeCloseTo(100, 1);
    s.jump(7);
    expect(s.value).toBe(7);
  });

  it('EASE.expo is the house curve, unchanged from the reference', () => {
    expect(EASE.expo).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
  });

  it('wait resolves', async () => {
    await expect(wait(1)).resolves.toBeUndefined();
  });
});

describe('canSplitGlyphs — the Persian FLIP guard', () => {
  it('splits Latin titles into one box per letter', () => {
    expect(canSplitGlyphs('PROJECTS')).toBe(true);
    expect(canSplitGlyphs('STUDIO 01')).toBe(true);
  });

  it('refuses to split Arabic-script titles, whose letters join', () => {
    expect(canSplitGlyphs('پروژه‌ها')).toBe(false);
    expect(canSplitGlyphs('استودیو')).toBe(false);
    expect(canSplitGlyphs('تماس')).toBe(false);
  });

  it('treats a mixed string as unsplittable — one joined letter is enough to break it', () => {
    expect(canSplitGlyphs('KAVAN کاوان')).toBe(false);
  });

  it('defaults to splittable for an empty string', () => {
    expect(canSplitGlyphs()).toBe(true);
  });
});
