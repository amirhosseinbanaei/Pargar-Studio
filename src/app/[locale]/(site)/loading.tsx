// src/app/[locale]/(site)/loading.tsx
/**
 * The group-level fallback: the chrome is already on screen (the layout does not remount),
 * so this stands in only for the content region while a segment resolves.
 *
 * It is the ANNOUNCED shared state rather than a bare spinner — `role="status"` plus
 * `aria-live="polite"` is what turns a silent screen change into "loading" for a
 * non-visual reader. Segments with a real shape to mimic override it with their own
 * shape-accurate skeleton; `projects/loading.tsx` is the one that does today.
 */
import { LoadingState } from '@/common/components/feedback';

export default function Loading() {
  return (
    <div className="route route--solo">
      <div className="route__main">
        <LoadingState />
      </div>
    </div>
  );
}
