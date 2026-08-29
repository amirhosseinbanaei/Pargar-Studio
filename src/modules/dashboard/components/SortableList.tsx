// src/modules/dashboard/components/SortableList.tsx
/**
 * THE REORDER CONTROL — one drag-and-drop list, mounted on every ordered list in the
 * dashboard: projects, design works, media, the taxonomy terms and a record's image gallery.
 *
 * ═══ THIS REVERSES A DECISION, DELIBERATELY ═══════════════════════════════════════
 * Reordering was a pair of arrow buttons until prompt 11, and that control's own header
 * argued against drag-and-drop on three grounds. This file is that reversal, requested by the person who uses the tool, and the
 * three grounds are answered rather than dropped:
 *
 *  1. **"A new dependency for something the platform already does."** It is a new dependency
 *     — `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — and AGENTS.md's ban was
 *     checked before adding it rather than after. What `common/` and the design system
 *     provide is the arrow control this file deletes; neither provides a sortable list, a
 *     keyboard drag protocol, drag announcements or auto-scroll, and the platform has no
 *     drag primitive that works from a keyboard at all. The reversal is recorded in
 *     AGENTS.md with what was checked.
 *  2. **"A drag handle is a pointer-only affordance that needs a whole parallel keyboard
 *     implementation."** Still true, so it ships here, in the same file and the same commit:
 *     `KeyboardSensor` + `sortableKeyboardCoordinates` make the handle a real control — tab
 *     to it, space to pick the row up, arrow keys to move it, space to drop, escape to
 *     cancel — and `announcements` below narrate every one of those steps into a live region.
 *     A drag that only works with a mouse is not shipped in this codebase.
 *  3. **"Dragging inside a seventy-six-row scrolling table is poor, because the target is
 *     usually off-screen."** Also still true, so `autoScroll` is configured rather than left
 *     to the default: dragging toward the top or bottom of the viewport scrolls it, and a
 *     row can reach a position that was nowhere near the screen when the drag started.
 *
 * ═══ IT SENDS AN INTENT, NOT AN ORDER ═════════════════════════════════════════════
 * Unchanged from the arrows, in the shape a drag needs. A drop posts `{ id, afterId }` — the
 * record that moved and the record it now FOLLOWS, `null` for first — and the SERVER computes
 * every position from the rows it holds. It never posts the ordering it is displaying: those
 * seventy-six ids were assembled from a page that may be five minutes old, and posting them
 * silently reverts every change anyone else made in between. See `../schemas/reorder` and
 * `common/utils/reorder.ts`.
 *
 * ═══ OPTIMISTIC, AND HONEST ABOUT IT ══════════════════════════════════════════════
 * The row moves the moment it is dropped, because a row that visibly snaps back to its old
 * position for half a second before landing reads as a bug. The optimistic order is held
 * until the transition — the action AND the `router.refresh()` behind it — has finished, and
 * is then dropped so the server's answer is the only thing on screen.
 *
 * On failure it goes back AND says why, through `ResultRegion`, branching on status and never
 * on message text. A reorder that quietly does not stick is the failure mode people re-do
 * five times before reporting it.
 *
 * ═══ ONE CONTEXT PER LIST, NOT PER ROW ════════════════════════════════════════════
 * `DndContext` is rendered once here and the items are its children. It emits no DOM of its
 * own, which is what lets it sit inside a `<tbody>` between the table and its rows; its
 * screen-reader markup is portaled to `document.body` for the same reason, because a `<div>`
 * inside a table is not valid HTML.
 *
 * ═══ THE DASHBOARD IS LTR, SO THERE IS NO RTL DRAG CASE ═══════════════════════════
 * `app/(dashboard)/layout.tsx` sets `dir="ltr"` with no `is-fa`: this is a monolingual
 * English admin tool and only the Persian INPUTS carry their own `dir` and `lang`. The
 * transforms are therefore never mirrored and no `dir`-aware modifier is installed. A Persian
 * title inside a dragged row is just an RTL text run inside an LTR box, which is exactly what
 * it already is when the row is sitting still.
 */
'use client';
import { createContext, useContext, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DraggableAttributes,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
} from '@dnd-kit/core';
// The listener map's own type. It is not on the package's public surface, so it is derived
// from the hook that returns it rather than restated — a hand-written shape here would drift
// the first time dnd-kit adds an event to it.
import type { useSortable as useSortableType } from '@dnd-kit/sortable';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { mapError, type NormalizedError } from '@/common/errors';
import type { ActionResult } from '@/common/services/action-result';
import { ResultRegion } from './ResultRegion';

/* ────────────────────────────────────────────────────────────────────────────────
   The contract
   ──────────────────────────────────────────────────────────────────────────────── */

export interface SortableListItem<Id extends UniqueIdentifier> {
  /**
   * The item's identity. For a `commit.to === 'server'` list this MUST be the record's
   * database id — it is what `afterId` carries to the action, so anything else is a 422.
   */
  id: Id;
  /**
   * What this row IS, in words: a project's title, a term's label, "Image 3". It names the
   * drag handle and it is what every announcement says out loud, so "Move up" repeated
   * seventy-six times never happens here — the reason the arrow control gave for naming the
   * row on its buttons, carried forward.
   */
  name: string;
  /** The row's own contents. Server-rendered wherever the caller is a Server Component. */
  children: React.ReactNode;
  /** The class list the surrounding list gives its items. */
  className?: string;
}

/**
 * WHERE A DROP IS WRITTEN, and the two answers are genuinely different things.
 *
 * `'server'` is a list the SERVER owns — rows in a table that exist independently of any
 * form. The drop posts to a Server Action and the router is refreshed so the list re-renders
 * in the order the database now holds.
 *
 * `'form'` is a list that is a FIELD of the record being edited — a gallery. Its order moves
 * with the rest of the unsaved values and is written by the same save, so there is nothing to
 * post and nothing to refresh; reordering and then cancelling must leave the stored order
 * alone, which is what an editor expects of anything inside a form.
 */
export type SortableListCommit<Id extends UniqueIdentifier> =
  | {
      to: 'server';
      /**
       * The Server Action itself, passed as a prop. One action reference per LIST, not per
       * row — which is the whole reason `ProjectRowActions` imports its actions instead of
       * receiving them, and why the same argument does not apply here.
       */
      action: (input: { id: Id; afterId: Id | null }) => Promise<ActionResult>;
    }
  | { to: 'form'; move: (fromIndex: number, toIndex: number) => void };

export interface SortableListProps<Id extends UniqueIdentifier> {
  /** The items, in the order the server (or the form) currently holds them. */
  items: readonly SortableListItem<Id>[];
  commit: SortableListCommit<Id>;
  /**
   * Which element each item is rendered as. `'row'` is a `<tr>` inside a table's `<tbody>`,
   * `'item'` an `<li>`, `'block'` a `<div>`. The list's own container stays with the caller —
   * this renders a fragment of items and nothing around them.
   */
  variant: 'row' | 'item' | 'block';
  /** Required for `variant="row"`: the `colSpan` the status row needs. */
  columnCount?: number;
  /**
   * Set when reordering is impossible in the current view — a table sorted by a column. Every
   * item is then undraggable, the handles render disabled, and the reason is SHOWN rather
   * than left to a tooltip.
   */
  disabledReason?: string;
  /** Singular, lowercase: "project", "term", "image". Used in the keyboard instructions. */
  itemNoun: string;
  /**
   * Distinguishes one list's drag context from another's on the same page — the projects
   * table and the four taxonomy axes above it are five contexts in one document. It is also
   * what makes dnd-kit's `aria-describedby` deterministic instead of a module-level counter,
   * which is a hydration mismatch on a server-rendered list.
   */
  id: string;
}

/* ────────────────────────────────────────────────────────────────────────────────
   The handle's channel to its item
   ──────────────────────────────────────────────────────────────────────────────── */

type SortableListeners = ReturnType<typeof useSortableType>['listeners'];

interface SortableItemHandle {
  attributes: DraggableAttributes;
  listeners: SortableListeners;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
  name: string;
  disabledReason?: string;
  isDragging: boolean;
}

const SortableItemContext = createContext<SortableItemHandle | null>(null);

/**
 * THE HANDLE, rendered by the row itself rather than by this component.
 *
 * It reaches its item through context, which is what lets the handle sit exactly where the
 * arrows sat — inside the row's own actions cell, beside Edit and Delete — instead of forcing
 * every table to grow a handle column. The row's markup is server-rendered; this leaf is the
 * only client thing in it.
 *
 * It is its OWN focusable control, named for the ROW, for the reason the arrow control recorded:
 * seventy-six identically-named controls are seventy-six controls nobody navigating by
 * control can tell apart.
 */
export function SortableDragHandle() {
  const handle = useContext(SortableItemContext);
  if (!handle) {
    throw new Error(
      'SortableDragHandle must be rendered inside a SortableList item. If this row is not reorderable, do not render a handle.',
    );
  }

  const { attributes, listeners, setActivatorNodeRef, name, disabledReason } = handle;
  const disabled = Boolean(disabledReason);

  return (
    <button
      {...attributes}
      {...listeners}
      ref={setActivatorNodeRef}
      type="button"
      disabled={disabled}
      aria-label={`Reorder ${name}`}
      title={disabledReason ?? `Reorder ${name}`}
      className="flex size-7 cursor-grab items-center justify-center border border-rule text-t-lo transition-colors duration-[var(--d-xs)] ease-out-kavan hover:border-rule-md hover:text-t-hi focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-a-1 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-disabled disabled:hover:border-rule disabled:hover:text-t-lo"
    >
      {/* Decoration: the button is already named, and a braille glyph read aloud is noise. */}
      <span aria-hidden>⠿</span>
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────────────────────
   The list
   ──────────────────────────────────────────────────────────────────────────────── */

export function SortableList<Id extends UniqueIdentifier>({
  items,
  commit,
  variant,
  columnCount,
  disabledReason,
  itemNoun,
  id,
}: SortableListProps<Id>) {
  const router = useRouter();
  /**
   * `useTransition` rather than a boolean, exactly as the arrow control used it and for the same
   * reason: `isPending` stays true until the SERVER has re-rendered the list after
   * `router.refresh()`, where a plain flag would clear the moment the action resolved — with
   * the table still showing the old order — and a second drag would then move the row twice.
   * Here it does one more job: it is what says when the optimistic order can be let go.
   */
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<readonly Id[] | null>(null);
  const [failure, setFailure] = useState<NormalizedError | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /**
   * dnd-kit's own screen-reader markup is a `<div>`. Inside a `<tbody>` that is invalid HTML,
   * so it is portaled to the document instead. Read during render rather than resolved in an
   * effect, and that is safe here for a specific reason: `DndContext` renders NOTHING until it
   * has mounted, so the server's `undefined` and the browser's `document.body` never produce
   * different HTML for React to reconcile.
   */
  const announcementContainer = typeof document === 'undefined' ? undefined : document.body;

  const byId = new Map(items.map(item => [item.id, item]));
  /**
   * THE OPTIMISTIC ORDER APPLIES EXACTLY WHILE THE WRITE IS IN FLIGHT, which is what makes it
   * honest without a reconciliation step of its own.
   *
   *  - While `pending`, the row is where the person dropped it. `pending` stays true until the
   *    action has answered AND the `router.refresh()` behind it has re-rendered the list, so
   *    there is no moment where the override is dropped before the truth has arrived — the
   *    half-second snap-back this component exists to avoid.
   *  - The instant it clears, `items` IS the answer. On success that is the new order and
   *    nothing moves; on a failure, or on a stale request the server answered as a no-op,
   *    it is the old order and the row visibly goes back where it came from — beside the
   *    message saying why.
   */
  const order = pending && optimistic ? optimistic : items.map(item => item.id);
  const ordered = order.flatMap(itemId => {
    const item = byId.get(itemId);
    return item ? [item] : [];
  });

  /**
   * The announcements read positions and names, and they must read the CURRENT ones — a
   * closure captured when the sensors were built would narrate the order as it was before the
   * last drag. A ref updated on every render is the cheapest correct answer.
   */
  const orderedRef = useRef(ordered);
  useEffect(() => {
    orderedRef.current = ordered;
  });

  const sensors = useSensors(
    /**
     * THE ACTIVATION CONSTRAINT IS NOT OPTIONAL. Every row here contains an Edit link and a
     * Delete button; without a distance threshold the pointer sensor claims the gesture on
     * `pointerdown` and swallows the click, so the two most common actions on a row stop
     * working and the table reads as broken. Eight pixels is far enough to be a deliberate
     * drag and short enough that a drag never feels like it needs a run-up.
     */
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    /**
     * THE KEYBOARD PATH. `sortableKeyboardCoordinates` is what makes the arrow keys move the
     * row through the list rather than by a fixed number of pixels — it asks the sortable
     * context where the next item actually is, which is what makes a keyboard move land on a
     * position rather than near one.
     */
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const positionOf = (itemId: UniqueIdentifier) =>
    orderedRef.current.findIndex(item => item.id === itemId) + 1;
  const nameOf = (itemId: UniqueIdentifier) =>
    orderedRef.current.find(item => item.id === itemId)?.name ?? `this ${itemNoun}`;

  const screenReaderInstructions: ScreenReaderInstructions = {
    draggable: `To reorder a ${itemNoun}, press space or enter on its reorder button. While moving, use the arrow keys to change its position, space or enter to drop it there, and escape to cancel.`,
  };

  /**
   * Every step of a keyboard move is announced, which is the half of the keyboard path that
   * is easy to leave out: without these, a row moves silently and the only feedback is
   * visual, so the whole interaction is unusable by the person it was built for. The wording
   * lives HERE, once, rather than in five copies across five screens.
   */
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${nameOf(active.id)}. It is at position ${positionOf(active.id)} of ${orderedRef.current.length}. Use the arrow keys to move it, space to drop it, escape to cancel.`,
    /*
     * Silent while the row is over ITSELF, which is the state a keyboard pick-up starts in
     * and the state a pointer passes back through constantly. Announcing it would repeat the
     * position that was just read out, over the top of the instructions.
     */
    onDragOver: ({ active, over }) =>
      over && over.id !== active.id
        ? `${nameOf(active.id)} would move to position ${positionOf(over.id)} of ${orderedRef.current.length}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${nameOf(active.id)} dropped at position ${positionOf(over.id)} of ${orderedRef.current.length}. Saving the new order.`
        : `${nameOf(active.id)} was returned to position ${positionOf(active.id)}.`,
    onDragCancel: ({ active }) =>
      `Reordering cancelled. ${nameOf(active.id)} is back at position ${positionOf(active.id)}.`,
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    const current = order;
    const from = current.indexOf(active.id as Id);
    const to = current.indexOf(over.id as Id);
    if (from === -1 || to === -1) return;

    const next = arrayMove([...current], from, to);

    if (commit.to === 'form') {
      // No optimistic copy: the field array re-renders in the new order in the same tick, so
      // an override here would be a second source of truth for one list.
      commit.move(from, to);
      return;
    }

    setFailure(null);
    setMessage(null);
    setOptimistic(next);

    // The row it now FOLLOWS. `next[to]` is the moved row itself, so its predecessor is the
    // anchor — and at position 0 there is none, which is what `null` means.
    const afterId = to === 0 ? null : (next[to - 1] ?? null);

    startTransition(async () => {
      const result = await commit.action({ id: active.id as Id, afterId });
      if (result.ok) {
        // Only on success. Re-rendering after a failed write costs a round trip to display
        // exactly what is already on screen.
        router.refresh();
        return;
      }

      // The override lapses with `pending`, so the row goes back on its own. What is left is
      // to say why — branching on status, never on message text.
      setOptimistic(null);
      if (result.status === 401) {
        setMessage('Your session has expired. Reload the page and sign in again.');
        return;
      }
      setFailure(mapError({ status: result.status, body: result.body }));
    });
  };

  const status =
    disabledReason || failure || message ? (
      <StatusSlot variant={variant} columnCount={columnCount}>
        {disabledReason && (
          <p className="text-fs-xs tracking-flat-kavan text-t-lo">{disabledReason}</p>
        )}
        {/*
          Rendered only when there is something to say, rather than standing by empty as
          `ResultRegion`'s header prefers. Inside a table an always-present region is an
          always-present empty row, and the failure half of it is `role="alert"`, which is
          announced when it is INSERTED — the one live-region role that does not have to be
          observed beforehand.
        */}
        {(failure || message) && <ResultRegion error={failure} message={message} />}
      </StatusSlot>
    ) : null;

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        announcements,
        screenReaderInstructions,
        container: announcementContainer,
      }}
      /**
       * AUTO-SCROLL, configured rather than defaulted, because it is the answer to the
       * seventy-six-row objection: a target that was off-screen when the drag started has to
       * be reachable. `canScroll` is the load-bearing part — `ds/Table` wraps itself in an
       * `overflow-x-auto` element, and CSS makes such a box scrollable on BOTH axes, so
       * without this the scroller would aim at a container that has no vertical overflow and
       * the window would never move.
       */
      autoScroll={{
        threshold: { x: 0, y: 0.2 },
        canScroll: element => element.scrollHeight > element.clientHeight,
      }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={[...order]} strategy={verticalListSortingStrategy}>
        {status}
        {ordered.map(item => (
          <SortableRow
            key={item.id}
            item={item}
            variant={variant}
            disabledReason={disabledReason}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

/* ────────────────────────────────────────────────────────────────────────────────
   One item
   ──────────────────────────────────────────────────────────────────────────────── */

function SortableRow<Id extends UniqueIdentifier>({
  item,
  variant,
  disabledReason,
}: {
  item: SortableListItem<Id>;
  variant: 'row' | 'item' | 'block';
  disabledReason?: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: Boolean(disabledReason) });

  /**
   * `transform` and `opacity` only — never `top`, `height` or a margin. The same rule the
   * motion layer holds itself to, and here it is also what keeps a dragged table row from
   * re-laying out the table under itself.
   */
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Above its siblings while it is moving, or the rows it passes paint over it. The value
    // is a token; `globals.css` says what it sits between.
    zIndex: isDragging ? 'var(--z-drag)' : undefined,
    position: isDragging ? 'relative' : undefined,
  };

  const handle: SortableItemHandle = {
    attributes,
    listeners,
    setActivatorNodeRef,
    name: item.name,
    disabledReason,
    isDragging,
  };

  const content = (
    <SortableItemContext.Provider value={handle}>{item.children}</SortableItemContext.Provider>
  );

  // `opacity-disabled` marks the row as the one in flight. It is the token the design system
  // already uses for "this control is not currently itself", not a new value.
  const className = [item.className, isDragging ? 'opacity-disabled' : null]
    .filter(Boolean)
    .join(' ');

  if (variant === 'row') {
    return (
      <tr ref={setNodeRef} style={style} className={className}>
        {content}
      </tr>
    );
  }
  if (variant === 'item') {
    return (
      <li ref={setNodeRef} style={style} className={className}>
        {content}
      </li>
    );
  }
  return (
    <div ref={setNodeRef} style={style} className={className}>
      {content}
    </div>
  );
}

/**
 * The one slot the status message can occupy in each variant. A table's is a real row
 * spanning every column, because a `<div>` between `<tr>`s is not markup a browser keeps.
 */
function StatusSlot({
  variant,
  columnCount,
  children,
}: {
  variant: 'row' | 'item' | 'block';
  columnCount?: number;
  children: React.ReactNode;
}) {
  if (variant === 'row') {
    return (
      <tr>
        <td colSpan={columnCount} className="px-0 py-2">
          {children}
        </td>
      </tr>
    );
  }
  if (variant === 'item') {
    return <li className="py-2">{children}</li>;
  }
  return <div className="py-2">{children}</div>;
}
