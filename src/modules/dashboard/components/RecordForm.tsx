// src/modules/dashboard/components/RecordForm.tsx
/**
 * THE FORM SCAFFOLD every dashboard editor is built on, and the one place an `ActionResult`
 * failure is turned into field errors on inputs.
 *
 * Prompt 7 repeats this pattern for design, media, studio and contact. What it reuses is
 * this component: it owns the submit lifecycle, the 401/422/404/429 branching, the field-
 * error binding, the focus move and the result region, so a new editor is a schema, a set of
 * fields and one `onSave` function.
 *
 * ─── TIER 2, AND WHY ──────────────────────────────────────────────────────────────
 * react-hook-form with `zodResolver`, rendered through the `form/` tier — never a hand-rolled
 * `onSubmit`. `references/07-forms.md` §1 picks the tier from a table, and the project editor
 * hits three of its rows at once: sixteen fields, an array-valued control, and values seeded
 * from a record that must `reset()` when they land. `FormButton` also gates on `isValid`,
 * which needs per-keystroke validation that tier 1 cannot provide.
 *
 * ─── IT BRANCHES ON STATUS, NEVER ON MESSAGE TEXT ─────────────────────────────────
 * Every decision below reads `result.status` or asks WHICH FIELD the server named. Matching
 * on a sentence is how a branch dies silently at the next copy edit — and it is the rule
 * `references/06-error-system.md` §4.3 states outright.
 *
 * ─── FIELD ERRORS GO ON FIELDS ────────────────────────────────────────────────────
 * A 422's body is the canonical `{ field: [message] }` envelope, which `fieldErrors()` from
 * the error system already understands, so nothing here parses a backend shape. What it
 * cannot bind — a key the form does not render — falls through to the form-level region
 * rather than vanishing, which is the case `applyFieldErrors`' fallback argument exists for.
 * Then `setFocus` moves the caret to the first offender, because `setError` deliberately
 * does not move focus and a long form's error can be three screens up.
 */
'use client';
import { useState } from 'react';
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type Resolver,
} from 'react-hook-form';
import { Form, FormButton } from '@/common/components/form';
import { Button } from '@/common/components/ds';
import { applyFieldErrors } from '@/common/hooks/applyFieldErrors';
import { fieldErrors, mapError, type NormalizedError } from '@/common/errors';
import type { ActionResult } from '@/common/services/action-result';
import { ResultRegion } from './ResultRegion';

export interface RecordFormProps<TValues extends FieldValues, TData> {
  /**
   * The resolver, built by the CALLER as `zodResolver(someFormSchema)`.
   *
   * The schema itself is not passed, and that is a typing decision with a practical reason:
   * `zodResolver`'s generics are tied to a concrete zod type and cannot be expressed for an
   * unknown `TValues`, so accepting the schema here would force a cast that hides a genuine
   * mismatch between the schema and the values. Each concrete editor knows its own schema,
   * so it builds the resolver where both types are known and the compiler can check them.
   */
  resolver: Resolver<TValues>;
  defaultValues: DefaultValues<TValues>;
  /** Every field the form renders. The allow-list `applyFieldErrors` binds against. */
  fields: ReadonlyArray<Path<TValues>>;
  /**
   * The write. Returns an `ActionResult` — it does NOT throw, and this component would
   * mishandle it if it did, which is the point: the contract is enforced by the type.
   */
  onSave: (values: TValues) => Promise<ActionResult<TData>>;
  /** Runs after a successful save, with whatever the action returned. Navigation goes here. */
  onSaved?: (data: TData, values: TValues) => void;
  /** What the region says on success. */
  successMessage?: string;
  submitLabel?: string;
  /**
   * `true` on a create form. A create form seeded with valid defaults is never `isDirty`
   * until something is typed, so without this the submit button on a form that is already
   * valid would never enable.
   */
  allowPristine?: boolean;
  /**
   * `true` on an edit form: reset to the SUBMITTED values rather than to the defaults, so
   * the save clears `isDirty` without wiping what was just saved. A create form wants the
   * opposite — an empty form ready for the next record.
   */
  resetToSubmitted?: boolean;
  /** Rendered beside the submit button — a delete control, a cancel link. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function RecordForm<TValues extends FieldValues, TData>({
  resolver,
  defaultValues,
  fields,
  onSave,
  onSaved,
  successMessage = 'Saved.',
  submitLabel = 'Save',
  allowPristine = false,
  resetToSubmitted = false,
  actions,
  children,
}: RecordFormProps<TValues, TData>) {
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<NormalizedError | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const form = useForm<TValues>({
    resolver,
    defaultValues,
    // `onChange`, because `FormButton` gates on `isValid`: with any other mode the button
    // stays disabled until the first failed submit.
    mode: 'onChange',
  });

  const onSubmit = async (values: TValues) => {
    setSuccess(null);
    setError(null);
    setMessage(null);

    const result = await onSave(values);

    if (result.ok) {
      // Reset to the SUBMITTED values on an edit form — it clears `isDirty` without wiping
      // what was just saved — and to the defaults on a create form.
      form.reset(resetToSubmitted ? (values as DefaultValues<TValues>) : defaultValues);
      setSuccess(successMessage);
      onSaved?.(result.data, values);
      return;
    }

    /**
     * 401 — the session died between loading this page and saving it. Say so plainly and
     * name the fix; the proxy will send them to the login page on the next navigation, and
     * telling them to reload is more useful than a generic failure they will retry into.
     */
    if (result.status === 401) {
      setMessage('Your session has expired. Reload the page and sign in again.');
      return;
    }

    // 422 — validation. Bind what the server NAMED back onto the inputs it named.
    if (result.status === 422) {
      const named = fieldErrors({ status: result.status, body: result.body });
      const first = Object.keys(named)[0];
      if (first !== undefined) {
        applyFieldErrors(form.setError, named, fields, setMessage);
        if ((fields as readonly string[]).includes(first)) {
          // `setError` does not move focus — RHF's `shouldFocusError` only covers errors the
          // resolver produced. A server-named field three screens up is invisible without this.
          form.setFocus(first as Path<TValues>);
        }
        return;
      }
    }

    /**
     * Everything else goes through the ONE normalizer, which is what guarantees a non-empty
     * sentence for a status nobody mapped and refuses to show a status-0 body — at status 0
     * the "body" is an internal JS string like `fetch failed`, not something to put in front
     * of a person.
     */
    setError(mapError({ status: result.status, body: result.body }));
  };

  return (
    <Form {...form}>
      <form
        // `noValidate` so the schema's messages are the only ones shown, rather than the
        // browser's own bubbles in whatever language it happens to be set to.
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        aria-busy={form.formState.isSubmitting}
        className="flex flex-col gap-8"
      >
        <ResultRegion success={success} error={error} message={message} />

        {children}

        <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-6">
          <FormButton allowPristine={allowPristine}>{submitLabel}</FormButton>
          {actions}
        </div>
      </form>
    </Form>
  );
}

/**
 * The cancel affordance, beside the submit button.
 *
 * Exported from here rather than assembled per screen so "cancel" is one control with one
 * treatment across every editor prompt 7 adds. It is a `Button asChild` wrapping whatever
 * link the caller passes, so the navigation stays the caller's business.
 */
export function RecordFormCancel({ children }: { children: React.ReactNode }) {
  return (
    <Button variant="ghost" size="sm" asChild>
      {children}
    </Button>
  );
}
