// src/common/hooks/applyFieldErrors.ts
import type { UseFormSetError, FieldValues, Path } from 'react-hook-form';

/**
 * Bind backend field errors onto the matching inputs. Anything the form does
 * not know about falls back to a form-level message — otherwise a backend field
 * the UI does not render (a server-computed column) produces an error nobody
 * can see or clear.
 *
 * A toast cannot tell the user WHICH input to fix, which is the whole reason
 * this exists: only the form-level message becomes a toast, every field-keyed
 * message goes back onto its field.
 */
export function applyFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  errors: Record<string, string>,
  knownFields: ReadonlyArray<Path<T>>,
  fallback: (message: string) => void,
): void {
  for (const [name, message] of Object.entries(errors)) {
    if (knownFields.includes(name as Path<T>)) setError(name as Path<T>, { message });
    else fallback(message);
  }
}
