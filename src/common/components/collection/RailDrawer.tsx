// src/common/components/collection/RailDrawer.tsx
'use client';
/**
 * The filter rail's narrow-screen form: a bar with a count and a Filter button, and a
 * drawer holding the rail itself.
 *
 * WHY IT EXISTS. Below 900px `route.css` stacks `.route__rail` above the grid, which on
 * `/en/projects` means a count plus four accordions — one of them open — before the reader
 * reaches the first card. On a 375px phone the whole first screen is chrome. The rail is
 * unchanged; only where it lives on a narrow viewport is.
 *
 * ONE COMPONENT FOR BOTH RAILS. `FacetRail` (design, media) and `ProjectFilterRail`
 * (projects) both wrap their contents in this, because the focus return, the Escape
 * binding and the `inert` toggle are the kind of thing that is subtly wrong in the second
 * copy and nobody notices for a year. It WRAPS the two rails rather than replacing them:
 * neither is forked and neither knows what a drawer is.
 *
 * THE WIDTH SWITCH IS CSS, NOT `matchMedia`. Both structures are rendered — the wide rail
 * and the bar-plus-drawer — and `route.css` displays exactly one of them. A JavaScript
 * width branch renders the wrong one on the server (which has no viewport) and swaps it
 * after hydration, which is a visible flash on precisely the slow devices this change
 * exists for. The cost is that `children` appears twice in the DOM; `display: none` keeps
 * the unused copy out of the tab order and off the accessibility tree, and the duplicated
 * markup is a few dozen links.
 *
 * ESCAPE IS BOUND IN THE CAPTURE PHASE, and that is load-bearing rather than a habit.
 * `SectionEscape` binds Escape on `window` in the bubble phase to leave the section
 * entirely, and it is mounted in the site layout — so it is registered BEFORE this
 * listener, which only attaches when the drawer opens. A bubble-phase listener here would
 * therefore run second, after the navigation had already started. Capturing on `window`
 * runs before anything else in the document and `stopPropagation()` keeps the event from
 * ever reaching the bubble phase, so Escape closes the drawer and stays on the page.
 *
 * ANY FILTER LINK CLOSES IT. A filter is a navigation; a drawer left standing over the
 * newly filtered grid hides the result of the tap that opened it. One delegated click
 * handler on the panel — `closest('a')` — covers every link inside, including the
 * "Clear all" both rails render conditionally.
 *
 * NO SCROLL LOCK. `base.css:41` already gives `body { overflow: hidden }` — the shell
 * never scrolls, `.route__main` does — so there is nothing to lock and adding one would
 * fight the layout.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface RailDrawerProps {
  /** The `.fcount` line the rail already renders. Shown in the bar AND in the drawer. */
  countLabel: string;
  /** `t('ui.filter')` — the bar button's label, resolved on the server. */
  filterLabel: string;
  /** `t('ui.close')` — the drawer's own dismiss control. */
  closeLabel: string;
  /** Whether anything is currently applied, so the button can say so without opening. */
  hasActiveFilter: boolean;
  /** The rail's existing contents: the `<details>` groups and the clear link. */
  children: ReactNode;
}

export function RailDrawer({
  countLabel,
  filterLabel,
  closeLabel,
  hasActiveFilter,
  children,
}: RailDrawerProps) {
  const [open, setOpen] = useState(false);
  // `useId`, not a module counter: a counter advances differently on a server that has
  // rendered other requests than in a browser that just started, which is a hydration
  // mismatch on every page carrying a rail.
  const panelId = useId();
  const countId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Nothing should take focus on the first render — only on an actual open or close.
  const opened = useRef(false);

  useEffect(() => {
    if (open) panelRef.current?.focus();
    else if (opened.current) buttonRef.current?.focus();
    opened.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      // See the file header: `SectionEscape` is listening on `window` in the bubble phase
      // and would navigate out of the section. Stopping here keeps Escape meaning "close
      // the thing that is open" rather than "leave the page".
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };

    addEventListener('keydown', onKeydown, true);
    return () => removeEventListener('keydown', onKeydown, true);
  }, [open]);

  return (
    <div className="route__rail route__rail--drawer">
      {/* Above 900px this is the whole rail, and it is the same markup as before: the
          count, then whatever the caller passed. */}
      <div className="rail__wide">
        <p className="fcount">{countLabel}</p>
        {children}
      </div>

      {/* At 900px and under, the rail collapses to this row. It is a normal grid row of
          `.route`, above `.route__main` — the element that actually scrolls — so it holds
          its place at the top of the content region while the grid moves under it, with
          nothing overlapping the first row of cards. */}
      <div className="railbar">
        <p className="fcount" id={countId}>
          {countLabel}
        </p>
        <button
          type="button"
          className="railbar__b magnet"
          ref={buttonRef}
          aria-expanded={open}
          aria-controls={panelId}
          // The count is the honest description of an active filter: "Filter, 12 Projects"
          // says what the dot says, to a reader who cannot see the dot.
          aria-describedby={countId}
          data-active={hasActiveFilter ? 'true' : undefined}
          onClick={() => setOpen(value => !value)}
        >
          <span>{filterLabel}</span>
          {hasActiveFilter && <span className="railbar__dot" aria-hidden="true" />}
        </button>
      </div>

      {/* A backdrop, not a `<dialog>`: the drawer is a region of this page rather than a
          modal over the whole document, and the masthead above it stays usable. */}
      <div
        className="railscrim"
        data-open={open ? 'true' : undefined}
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />

      <div
        className="raildrawer"
        id={panelId}
        ref={panelRef}
        data-open={open ? 'true' : undefined}
        // `inert` while closed, so nothing inside is tabbable and nothing is announced.
        // The shell already relies on the attribute for the collapsed columns
        // (`common/lib/motion/shell.ts:416`), so this is an established pattern here. The
        // display rule in `route.css` is the second half — `inert` alone leaves a closed
        // panel painted over the grid.
        inert={!open}
        role="group"
        aria-label={filterLabel}
        tabIndex={-1}
        onClick={event => {
          if (event.target instanceof Element && event.target.closest('a')) setOpen(false);
        }}
      >
        <div className="raildrawer__head">
          <p className="fcount">{countLabel}</p>
          <button type="button" className="raildrawer__x magnet" onClick={() => setOpen(false)}>
            {closeLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
