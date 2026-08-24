// src/common/components/form/FormButton.tsx
'use client';
import { useFormContext } from 'react-hook-form';
import { Button } from '@/common/components/ds/Button';

export interface FormButtonProps extends React.ComponentProps<typeof Button> {
  /**
   * Submit on a pristine form. Default false — a form the user has not touched
   * has nothing to save. Set true for a create form seeded with valid defaults,
   * where `isDirty` would never become true and the button would never enable.
   */
  allowPristine?: boolean;
}

/**
 * Reads form state from context so no page wires `disabled` by hand, and so
 * "disabled while submitting" cannot be forgotten on one form out of twelve.
 */
export function FormButton({
  children,
  type = 'submit',
  allowPristine = false,
  disabled,
  ...props
}: FormButtonProps) {
  const {
    formState: { isValid, isDirty, isSubmitting },
  } = useFormContext();
  return (
    <Button
      type={type}
      // `loading` also disables, so a double-submit is impossible while the
      // request is in flight.
      loading={isSubmitting}
      disabled={disabled || !isValid || (!allowPristine && !isDirty)}
      {...props}
    >
      {children}
    </Button>
  );
}
