// src/common/components/layout/MarkStepper.tsx
'use client';
/**
 * The six masthead marks.
 *
 * At rest they sit on the six column rules. On a section route they compress into a
 * centred stepper whose active dot names the section you are in — and under RTL the dot
 * that grows is MIRRORED, because the stepper is laid out left-to-right while the columns
 * run right-to-left, so an unmirrored stepper points at the wrong column for every Persian
 * reader (`legacy/README.md` records this).
 *
 * The geometry is `markTargets` in `common/lib/motion/marks`, shared with the shell
 * transition rather than re-derived — see that file for why there are two drivers.
 *
 * This component owns the RESTING and SETTLED positions. The shell transition owns the
 * animation BETWEEN them while a column is opening; it writes the same values through the
 * same function, so when the route commits and this effect re-runs, it re-asserts the
 * position the transition just animated to. Nothing moves.
 */
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { NAV } from '@/common/constants/site';
import { animate, EASE, markTargets, round } from '@/common/lib/motion';
import { sectionSegment } from './Stage';

const MARK_COUNT = 6;
const SETTLE_MS = 900;

export interface MarkStepperProps {
  isRTL: boolean;
}

export function MarkStepper({ isRTL }: MarkStepperProps) {
  const host = useRef<HTMLDivElement>(null);
  const section = sectionSegment(usePathname());
  const index = NAV.findIndex(item => item.id === section);
  const activeIndex = index < 0 ? null : index;

  useEffect(() => {
    const node = host.current;
    if (!node) return;

    const marks = [...node.querySelectorAll<HTMLElement>('.mark')];

    const place = (duration: number): void => {
      // One measurement, on a discrete event — never per mark, which would force a
      // layout flush between every write.
      const width = node.getBoundingClientRect().width;
      if (width < 1) return;

      markTargets(activeIndex, width, isRTL, marks.length).forEach((target, k) => {
        const mark = marks[k];
        if (!mark) return;
        const to = `translate3d(${round(target.x)}px,0,0) scale(${round(target.s, 100)},1)`;
        const from = getComputedStyle(mark).transform;
        // `fill: 'forwards'` is the deliberate exception to the layer's default: this is
        // a RESTING position CSS cannot express (it depends on a measured width), so the
        // animation has to keep holding it after it ends.
        animate(mark, [{ transform: from === 'none' ? 'none' : from }, { transform: to }], {
          duration,
          easing: EASE.expo,
          delay: duration > 1 ? k * 26 : 0,
          fill: 'forwards',
        });
        mark.style.opacity = activeIndex != null && k === activeIndex + 1 ? '1' : '';
      });
    };

    place(SETTLE_MS);

    // The marks are placed as a fraction of this box, so its width is the only thing a
    // resize can invalidate. Re-place instantly: an animated re-place during a drag
    // queues one animation per resize frame.
    const observer = new ResizeObserver(() => place(1));
    observer.observe(node);
    return () => observer.disconnect();
  }, [activeIndex, isRTL]);

  return (
    <div className="marks" aria-hidden="true" ref={host}>
      {Array.from({ length: MARK_COUNT }, (_, k) => (
        <i key={k} className={k === 0 ? 'mark mark--lead' : 'mark'} />
      ))}
    </div>
  );
}
