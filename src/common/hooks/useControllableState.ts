// src/common/hooks/useControllableState.ts
import { useCallback, useState } from 'react';

/**
 * Bridges controlled and uncontrolled state for one value. When `value !==
 * undefined` the hook is controlled: it echoes the prop and keeps no internal
 * state. Otherwise it seeds from `defaultValue`, tracks its own state, and
 * still fires `onChange`. One API, both modes.
 *
 * A component must not change controlled-ness during its life. The classic
 * production failure: a field renders before its data arrives so `value` is
 * `undefined` (uncontrolled), then a `reset()` supplies the real value and it
 * flips to controlled. React warns, and a headless primitive keeping internal
 * state can leave the trigger stuck on its placeholder while form state is
 * already correct. Coalesce at the BINDING site — `value={field.value ?? ''}`.
 */
export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: {
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const isControlled = value !== undefined;
  const state = isControlled ? value : uncontrolled;
  const setState = useCallback(
    (next: T) => {
      if (!isControlled) setUncontrolled(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );
  return [state, setState] as const;
}
