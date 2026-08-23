# Forms: the two-tier model

**Read this when:** you are building any form, a submit button never enables, backend validation
errors are not landing on the right inputs, or you are building a wizard or an upload field.

Every form in the app is one of exactly two shapes. Tier 1 is a native `<form action={…}>` driven by
`useActionState`; tier 2 is react-hook-form + a zod resolver that submits through the same Server
Action. There is no third shape and no per-feature invention. This file defines both, the rule for
picking one, the wizard and upload variants, and the one library interaction that silently breaks
submit buttons.

> **Versions.** Every example leads with the **Next.js 16** form; the 15.x equivalent is given
> inline wherever they differ. Zod examples are **zod 4** (see `references/05-contracts-and-schemas.md`
> for the zod 3 spellings).

## Invariants

- **Pick the tier from a table, not from taste** (§1). A mixed codebase where every form solves
  pending/error/reset differently is the thing this document exists to prevent.
- **The Server Action is the only write path in both tiers.** Client validation is UX; the action
  re-validates with its own schema because an action is a public HTTP endpoint.
- **A form never calls `fetch` and never touches a service module directly.** It calls an action
  (tier 1) or a mutation hook wrapping an action (tier 2).
- **Actions return failures; they never throw them** — see `references/04-actions-and-mutations.md`.
  A thrown error loses its status and body across the RPC boundary, so field errors cannot be bound.
- **`defaultValues` names every field the form owns, with a non-`undefined` value.** A field that
  starts `undefined` mounts uncontrolled and flips controlled on the first `reset()`, which React
  warns about and which leaves selects stuck on their placeholder.
- **Backend field errors go back onto the fields** via `applyFieldErrors`; only the form-level
  message becomes a toast. A toast cannot tell the user *which* input to fix. That helper has no
  template — create it at `src/common/hooks/applyFieldErrors.ts` from
  `references/06-error-system.md` §4.1 before writing your first form; every example below imports
  it from there.
- **Wire schemas and form schemas are separate** (`references/05-contracts-and-schemas.md`). Form
  schemas carry user-facing copy; wire schemas must not.
- **Every control renders through the `Form*` wrappers** so label/`aria-describedby`/`aria-invalid`
  wiring exists on every field without a per-form checklist.
- **Submit is disabled while pending and guarded against re-entry.** Two clicks must not create two
  invoices.
- **Multi-step wizards keep one form instance and one value object; the store holds only the
  cursor** — and never persists secrets.
- **Uploads are validated client-side for type and size *before* the request**, and again on the
  server. The client check is for feedback, the server check is the rule.
- **Keep the React Compiler off until form components are compiler-safe** (§9), and record why in
  the config so nobody re-enables it blindly.

---

## 1. Choosing a tier

| Requirement                                                             | Tier |
| ----------------------------------------------------------------------- | ---- |
| ≤ ~5 flat fields, no cross-field logic (settings toggle, single-field rename, subscribe box) | 1 |
| Must work before hydration / with JS disabled                           | 1    |
| The result is a redirect or a full server re-render, not client state    | 1    |
| Per-keystroke validation, live enable/disable of submit                  | 2    |
| Fields depending on other fields (end date required unless "current")    | 2    |
| Arrays / repeaters / drag-reorder                                        | 2    |
| Multi-step wizard                                                        | 2    |
| File picker with preview, crop, or progress                             | 2    |
| Values seeded from a query and needing `reset()` when it lands           | 2    |
| Unsaved-changes guard, autosave, or optimistic list updates              | 2    |

Two tie-breakers:

- **When in doubt, start at tier 1.** It is ~15 lines and has no client-state machine. Promoting a
  tier-1 form to tier 2 later is mechanical; the reverse rarely happens.
- **Never run both at once on the same form.** `useActionState` + `handleSubmit` fight over the
  submit event: RHF calls `preventDefault`, so the action fires only through the button's
  `formAction`, and pending state comes from two sources that disagree.

---

## 2. Tier 1 — progressive enhancement

### 2.1 The `ActionState` shape

Tier 1 returns `ActionState<T>` — a three-case discriminated union (`idle` / `error` / `success`)
that `useActionState` uses as its reducer state. Copy `templates/src/common/services/action-result.ts`
to `src/common/services/action-result.ts` first (it carries `ActionResult`, `ActionError`, `unwrap`
and `toActionResult`), then **append** the `ActionState` / `zodFieldErrors` / `toActionState` block
printed in `references/04-actions-and-mutations.md` §1 to that same file. Every import below —
`from '@/common/services/action-result'` — assumes both halves are present.

Two properties matter here: the union is discriminated on `status`, so the JSX cannot read
`fieldErrors` off a success state; and its `fieldErrors` is the same `FieldErrors` shape (one
message per field) the error system produces, so tier 1 and tier 2 consume identical data and
promoting a form between tiers does not touch the error-binding code.

### 2.2 The action

```ts
// modules/accounts/actions/settings-actions.ts
'use server';

import { updateTag } from 'next/cache';
import { type ActionState, zodFieldErrors } from '@/common/services/action-result';
import { errorMessage, fieldErrors } from '@/common/errors';
import { saveNotificationSettings } from '@/common/services/account-service';
import { notificationSettingsSchema } from '../schemas/settings';

export async function saveNotificationSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // 1. Validate. An action is a public endpoint — the client schema proves nothing here.
  //    `Object.fromEntries` keeps only the last value of a repeated key; for checkbox
  //    groups use `formData.getAll(name)` explicitly.
  const parsed = notificationSettingsSchema.safeParse({
    ...Object.fromEntries(formData),
    channels: formData.getAll('channels'),
  });
  if (!parsed.success) {
    return { status: 'error', fieldErrors: zodFieldErrors(parsed.error) };
  }

  // 2. Authorize inside the action (`references/04-actions-and-mutations.md` §3 — the session
  //    check runs BEFORE the parse there; this form's schema is public, so order is moot).
  try {
    await saveNotificationSettings(parsed.data);
  } catch (err) {
    // Backend validation (a field the client schema doesn't police) still lands on fields.
    return { status: 'error', message: errorMessage(err), fieldErrors: fieldErrors(err) };
  }

  updateTag('accounts:settings'); // Next 16; Next 15: revalidateTag('accounts:settings')
  return { status: 'success' };
}
```

Rules: expected failures return, never throw. `redirect()` — if the action redirects — is the last
statement and lives outside any `try/catch` that swallows, because it signals by throwing.

### 2.3 The client

```tsx
'use client';
import { useActionState, useEffect, useRef } from 'react';
import { saveNotificationSettingsAction } from '@/modules/accounts';

export function NotificationSettingsForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, formAction, pending] = useActionState(saveNotificationSettingsAction, {
    status: 'idle',
  });
  const formRef = useRef<HTMLFormElement>(null);

  // Native forms keep whatever the user typed; clear it explicitly after a success
  // that should not leave the old values behind (a "create" form, not an "edit" form).
  useEffect(() => {
    if (state.status === 'success') formRef.current?.reset();
  }, [state.status]);

  const errorFor = (name: string) =>
    state.status === 'error' ? state.fieldErrors?.[name] : undefined;

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      {/* Region announced when the form-level message changes. Rendered always, so
          screen readers observe the mutation rather than a node appearing. */}
      <p role="alert" aria-live="polite" className="text-sm text-destructive">
        {state.status === 'error' ? state.message : null}
      </p>

      <div className="grid gap-2">
        <label htmlFor="billing-email">Billing email</label>
        <input
          id="billing-email"
          name="email"
          type="email"
          defaultValue={defaultEmail}
          aria-invalid={!!errorFor('email')}
          aria-describedby={errorFor('email') ? 'billing-email-error' : undefined}
        />
        {errorFor('email') && (
          <p id="billing-email-error" className="text-xs text-destructive">
            {errorFor('email')}
          </p>
        )}
      </div>

      <button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
```

Notes that matter:

- **`defaultValue`, not `value`.** Tier 1 fields are uncontrolled by design — that is what makes the
  form submit before hydration.
- **`pending` from `useActionState` covers this form's own submit only.** A submit button rendered
  in a *child* component reads `const { pending } = useFormStatus()` instead; `useFormStatus` returns
  `false` in the component that renders the `<form>` itself.
- **Never `disabled` a field you still need in the payload** — disabled inputs are not serialized
  into `FormData`. Use `readOnly` while pending, or re-send the value from a hidden input.
- Additional arguments bind with `action={saveAction.bind(null, invoiceId)}`; the bound value is
  serialized to the client, so bind ids, never secrets.

---

## 3. Tier 2 — the canonical rich form

Five parts, always in this order: **schema → inferred type → `useForm` → `Form` provider →
`Form*` controls → submit handler that maps failure back onto the form.**

```ts
// modules/billing/schemas/invoice-form.ts
import { z } from 'zod';

/**
 * CLIENT form schema. Separate from the wire schema in common/schemas: this one
 * carries user-facing copy and human rules, the wire schema carries the API contract.
 * Messages here are the localized strings your app ships; keep them out of wire schemas.
 */
export const invoiceFormSchema = z
  .object({
    account_id: z.string().min(1, 'Choose an account'),
    reference: z.string().min(3, 'Reference must be at least 3 characters'),
    amount: z.coerce.number().positive('Amount must be greater than zero'),
    issued_at: z.date(),
    due_at: z.date().nullable(),
    is_recurring: z.boolean(),
    note: z.string().max(280, 'Maximum 280 characters'),
  })
  // Cross-field rules live in `.refine` with an explicit `path`, so the message lands
  // on the field the user must fix rather than at the form level where it reads as noise.
  .refine(v => v.is_recurring || v.due_at !== null, {
    path: ['due_at'],
    message: 'A due date is required unless the invoice recurs',
  })
  .refine(v => !v.due_at || v.due_at >= v.issued_at, {
    path: ['due_at'],
    message: 'Due date cannot precede the issue date',
  });

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

/** The fields this form renders — the allow-list `applyFieldErrors` binds against. */
export const INVOICE_FORM_FIELDS = [
  'account_id', 'reference', 'amount', 'issued_at', 'due_at', 'is_recurring', 'note',
] as const satisfies ReadonlyArray<keyof InvoiceFormValues>;
```

```tsx
// modules/billing/components/InvoiceForm.tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';

import { Form } from '@/common/components/form/Form';
import { FormInput } from '@/common/components/form/FormInput';
import { FormSelect } from '@/common/components/form/FormSelect';
import { FormDatePicker } from '@/common/components/form/FormDatePicker';
import { FormTextarea } from '@/common/components/form/FormTextarea';
import FormButton from '@/common/components/form/FormButton';
import { applyFieldErrors } from '@/common/hooks/applyFieldErrors';
import { errorMessage, fieldErrors } from '@/common/errors';
import { ActionError } from '@/common/services/action-result';
import { useCreateInvoice } from '../hooks/useInvoices';
import {
  invoiceFormSchema, INVOICE_FORM_FIELDS, type InvoiceFormValues,
} from '../schemas/invoice-form';

const EMPTY: InvoiceFormValues = {
  account_id: '', reference: '', amount: 0,
  issued_at: new Date(), due_at: null, is_recurring: false, note: '',
};

export function InvoiceForm({ onDone }: { onDone?: () => void }) {
  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    // Every field present and non-undefined: inputs stay controlled from mount to unmount.
    defaultValues: EMPTY,
    // 'onChange' when the submit button is gated on `isValid` (it must be recomputed as
    // the user types, or the button never enables). 'onTouched' otherwise — it does not
    // shout at a field the user has not finished.
    mode: 'onChange',
  });

  const createInvoice = useCreateInvoice(); // useMutation wrapping createInvoiceAction

  const onSubmit = async (values: InvoiceFormValues) => {
    try {
      await createInvoice.mutateAsync(values);
      // Reset to the *submitted* values, not to EMPTY, when the form stays open for
      // editing: it clears `isDirty` without wiping what the user just saved.
      form.reset(values);
      toast.success('Invoice created');
      onDone?.();
    } catch (err) {
      // The mutation re-threw via `unwrap`, so status and body survived the RPC boundary;
      // `fieldErrors` parses the backend envelope into Record<field, message>.
      const binding = err instanceof ActionError ? fieldErrors(err) : {};
      if (Object.keys(binding).length > 0) {
        applyFieldErrors(form.setError, binding, INVOICE_FORM_FIELDS, toast.error);
        form.setFocus(Object.keys(binding)[0] as keyof InvoiceFormValues);
      } else {
        toast.error(errorMessage(err));
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <FormSelect<InvoiceFormValues> name="account_id" label="Account" placeholder="Select…"
          options={accountOptions} />
        <FormInput<InvoiceFormValues> name="reference" label="Reference" />
        <FormInput<InvoiceFormValues> name="amount" label="Amount" type="number" inputMode="decimal" />
        <FormDatePicker<InvoiceFormValues> name="issued_at" label="Issued" />
        <FormDatePicker<InvoiceFormValues> name="due_at" label="Due"
          disabled={form.watch('is_recurring')} />
        <FormTextarea<InvoiceFormValues> name="note" label="Note" maxLength={280} />
        <FormButton>Create invoice</FormButton>
      </form>
    </Form>
  );
}
```

- Never re-implement the envelope parsing per form: `fieldErrors` and `errorMessage` from
  `@/common/errors` own the mapping from a backend body to `Record<string, string>` and to one
  user-facing sentence (`references/06-error-system.md`).
- `noValidate` disables the browser's own bubbles so zod's messages are the only ones shown, in the
  app's locale and styling.
- `FormButton` reads `isValid`/`isDirty`/`isSubmitting` from context — no page wires `disabled` by
  hand. See `references/02-design-system.md` for the `Form*` layer itself.
- The mutation, its optimistic update and cache invalidation belong to the hook, not the component:
  `references/04-actions-and-mutations.md`.

### 3.1 Seeding values from a query

```tsx
const { data } = useQuery(invoiceOptions(id));
const form = useForm<InvoiceFormValues>({ resolver: zodResolver(invoiceFormSchema),
  defaultValues: EMPTY });

// `defaultValues` is read once at mount. Data arriving later must be pushed in with reset(),
// which also re-baselines `isDirty` so the freshly loaded record is not "unsaved changes".
useEffect(() => {
  if (data) form.reset(toFormValues(data), { keepDirtyValues: true });
}, [data, form]);
```

`keepDirtyValues: true` protects a user who started typing while the request was in flight; drop it
only if stale-vs-typed conflicts are impossible.

---

## 4. Lifecycle: pending, double submit, dirty, reset

| Concern | Rule |
| --- | --- |
| Disable during submit | `FormButton` uses `isSubmitting`; never a local `useState` that can desync |
| Double submit | `handleSubmit` ignores re-entry while `isSubmitting`, **but only for the same handler** — also disable the button and make the action idempotent (`references/04-actions-and-mutations.md`) for the click that beats the re-render |
| Dirty tracking | `formState.isDirty` compares against `defaultValues`; it is meaningless if defaults were never set, which is the real reason §3's `EMPTY` is mandatory |
| Reset after create | `form.reset(EMPTY)` — clears values and dirty state |
| Reset after edit | `form.reset(submittedValues)` — keeps the new baseline |
| Reset a subtree | `form.resetField('note')` rather than rebuilding the whole form |
| Dependent field | Write with `setValue(name, v, { shouldValidate: true, shouldDirty: true })` — omit these and the cross-field `refine` never re-runs and the submit button stays disabled |
| Reading one field for render | `useWatch({ control, name })` — subscribes only that subtree; `form.watch()` with no argument re-renders the whole form on every keystroke |

Unsaved-changes guard:

```tsx
useEffect(() => {
  if (!form.formState.isDirty) return;
  const warn = (e: BeforeUnloadEvent) => e.preventDefault();
  window.addEventListener('beforeunload', warn);
  return () => window.removeEventListener('beforeunload', warn);
}, [form.formState.isDirty]);
```

`beforeunload` covers reload and tab close only. The App Router has **no supported client
navigation blocker**, so in-app protection means gating the exit affordances you own — a confirm
dialog on the cancel button and on the links inside the form's shell. Do not ship a monkey-patched
`router.push`; it breaks on back/forward and on prefetch.

---

## 5. Multi-step wizards

A wizard is one tier-2 form with a *moving resolver*. Do not mount one `useForm` per step: values
from earlier steps then live in an unmounted component, and a back-button visit renders empty
inputs.

### 5.1 Per-step schema slices

```ts
// modules/accounts/schemas/onboarding.ts
export const step1Schema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'At least 8 characters'),
  password_confirm: z.string(),
}).refine(v => v.password === v.password_confirm, {
  path: ['password_confirm'], message: 'Passwords do not match',
});

export const step2Schema = z.object({
  company_name: z.string().min(2, 'At least 2 characters'),
  registration_id: z.string().refine(isValidRegistrationId, 'Not a valid registration id'),
  employee_count: z.string().min(1, 'Required'),
});

export const step3Schema = z.object({
  contact_first_name: z.string().min(1, 'Required'),
  contact_last_name: z.string().min(1, 'Required'),
  contact_phone: z.string().min(1, 'Required'),
});

/** What the final submit — and the action — validate. */
export const onboardingSchema = step1Schema.and(step2Schema).and(step3Schema);
export type OnboardingValues = z.infer<typeof onboardingSchema>;

export const STEP_SCHEMAS = [step1Schema, step2Schema, step3Schema] as const;
/** Field names per step: drives step-scoped `trigger()` and the error summary. */
export const STEP_FIELDS = [
  ['email', 'password', 'password_confirm'],
  ['company_name', 'registration_id', 'employee_count'],
  ['contact_first_name', 'contact_last_name', 'contact_phone'],
] as const satisfies ReadonlyArray<ReadonlyArray<keyof OnboardingValues>>;
```

### 5.2 The cursor store — and why a store

```ts
// modules/accounts/stores/onboarding-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OnboardingStore {
  step: number;          // 1-based
  maxSteps: number;
  next: () => void;
  previous: () => void;
  /** Jump to an explicit position — used to restore a server-recorded cursor. */
  goTo: (step: number, maxSteps: number) => void;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    set => ({
      step: 1,
      maxSteps: 3,
      next: () => set(s => ({ step: Math.min(s.step + 1, s.maxSteps) })),
      previous: () => set(s => ({ step: Math.max(s.step - 1, 1) })),
      goTo: (step, maxSteps) => set({ step, maxSteps }),
    }),
    {
      name: 'onboarding-cursor',
      // Persist the CURSOR ONLY. Never persist credentials, tokens, or personal data to
      // localStorage: it is readable by any script on the origin and survives sign-out.
      partialize: s => ({ step: s.step, maxSteps: s.maxSteps }),
    },
  ),
);
```

Why a store rather than `useState` lifted into the wizard component:

1. **Refresh and back-button survival.** The step header, the progress rail, the footer buttons and
   the form all read the cursor; with `persist`, a reload continues where the user was instead of
   dumping them on step 1 with a full form behind them.
2. **No prop drilling through the form.** Sibling chrome (header, buttons) reads the cursor
   directly, so the `<form>` subtree does not have to thread `step`/`setStep` through every step
   component.
3. **The store is the only piece of wizard state outside RHF**, which keeps the split obvious:
   *values* live in the form, *position* lives in the store.

Where the server records progress, treat the server as the source of truth on mount:
`goTo(min(serverStep + 1, maxSteps), maxSteps)` — clamped, so a completed onboarding never lands on
a step that does not exist.

### 5.3 The wizard component

```tsx
'use client';
import { useForm, type FieldValues, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

/**
 * A step validates only the fields it renders, so its resolver comes from a subset
 * schema. RHF always calls the resolver with the whole value object and merges the
 * partial result back, so presenting each step resolver as `Resolver<OnboardingValues>`
 * is sound; the cast exists only because a subset's inferred type does not structurally
 * overlap the whole-form type.
 */
const asFormResolver = <T extends FieldValues>(r: Resolver<T>): Resolver<OnboardingValues> =>
  r as unknown as Resolver<OnboardingValues>;

export function OnboardingWizard() {
  const { step, maxSteps, next } = useOnboardingStore();

  const form = useForm<OnboardingValues>({
    resolver: asFormResolver(zodResolver(STEP_SCHEMAS[step - 1])),
    defaultValues: ONBOARDING_DEFAULTS, // every field of every step, non-undefined
    mode: 'onChange',
  });

  // One handler for all steps: the resolver already gated this call to the current
  // step's fields, so reaching here means "this step is valid".
  const onSubmit = async (values: OnboardingValues) => {
    // Returns ActionState (`references/04-actions-and-mutations.md` §1) — the per-step
    // action shapes its own message and field errors on the server, so this handler
    // never parses a backend envelope.
    const result = await saveOnboardingStepAction(step, values);
    if (result.status === 'error') {
      applyFieldErrors(form.setError, result.fieldErrors ?? {}, STEP_FIELDS[step - 1], toast.error);
      return;
    }
    if (step < maxSteps) return next();
    await finishOnboardingAction(values); // final submit validates `onboardingSchema` server-side
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        {step === 1 && <Step1Fields />}
        {step === 2 && <Step2Fields />}
        {step === 3 && <Step3Fields />}
        <WizardFooter />   {/* reads the store; submit button is a FormButton */}
      </form>
    </Form>
  );
}
```

- **Gate "next" on the resolver, not on a hand-rolled error check.** The step button is
  `type="submit"`; a step is advanced only from inside `handleSubmit`, so an invalid step cannot be
  skipped by clicking fast.
- If you prefer one whole-form schema over slices, gate with
  `await form.trigger(STEP_FIELDS[step - 1])` instead. The slice approach is preferred: the schema
  then also documents what each step owns, and the per-step action can import that exact slice.
- **Each step persists as it passes** when the backend supports it. Losing step 2 because the user
  closed the tab on step 4 is the failure this prevents.
- The final action validates the **composed** schema. Per-step server validation is not a substitute:
  a client can call the final action directly.

---

## 6. File uploads

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';

const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPT = { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] };

export function AttachmentField({ onUploaded }: { onUploaded: (url: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Object URLs are leaked memory until revoked, and a stale one renders the previous file.
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPT,
    maxFiles: 1,
    maxSize: MAX_BYTES,
    // Client-side rejection is feedback, not enforcement: it saves a 4MB round trip
    // that would end in a 413 the user cannot interpret.
    onDropRejected: rejections => toast.error(rejections[0]?.errors[0]?.message ?? 'File rejected'),
    onDropAccepted: async ([accepted]) => {
      setFile(accepted);
      setBusy(true);
      try {
        const body = new FormData();
        body.append('attachment', accepted, accepted.name);
        const result = await uploadAttachmentAction(body);
        if (!result.ok) return toast.error(errorMessage(new ActionError(result.status, result.body)));
        onUploaded(result.data.url);
      } finally {
        setBusy(false);
      }
    },
  });

  return (
    <div {...getRootProps()} data-active={isDragActive}
         className="rounded-md border border-dashed p-6 text-center">
      <input {...getInputProps()} aria-label="Upload attachment" />
      {preview && <img src={preview} alt="" className="mx-auto max-h-40 object-contain" />}
      <p aria-live="polite">{busy ? 'Uploading…' : 'Drop a file or click to choose'}</p>
    </div>
  );
}
```

Server side:

```ts
'use server';
export async function uploadAttachmentAction(body: FormData) {
  return toActionResult(() => uploadAttachment(body));
}

// common/services/attachment-service.ts — an ordinary ring-3 service
// (`references/03-server-data-layer.md` §4). One detail is upload-specific:
export function uploadAttachment(body: FormData) {
  // Pass the FormData straight through and DO NOT set Content-Type: the runtime must
  // generate the multipart boundary. A hand-set 'multipart/form-data' header omits it
  // and the backend parses zero fields — the classic "empty request" upload bug.
  return apiFetch('/billing/attachments/', attachmentSchema, { method: 'POST', body });
}
```

Rules:

- **Validate MIME type and size on both sides.** The client check is UX; a crafted request skips it
  entirely. Extension checks are not type checks.
- **Server Action bodies are size-capped** (~1MB by default). Raise it deliberately in the Next
  config (`experimental.serverActions.bodySizeLimit`) for the largest file you accept, or route
  uploads to object storage with a signed URL and send only the resulting key through the action.
- **There is no upload progress through a Server Action or `fetch`.** If you need a real percentage,
  POST to a Route Handler with `XMLHttpRequest` and its `upload.onprogress`; otherwise show an
  indeterminate state and say "Uploading…", not a fake bar.
- **Keep `File` objects out of RHF values** unless the schema models them. Hold the file in local
  state and store the returned URL/key in the form value — that is what the write schema expects, and
  it survives a step change without re-uploading.
- **Show the local preview optimistically** and keep showing it after success: the round-trip URL may
  point at a host that is slow or unreachable, and the user should still see what they just uploaded.
- Reset `input.value = ''` after reading a file from a plain `<input type="file">`, or picking the
  same file twice fires no `change` event.

---

## 7. Accessibility requirements

These are non-negotiable and mostly free because the `Form*` layer implements them once:

| Requirement | Mechanism |
| --- | --- |
| Label bound to control | `FormItem` generates one id; `FormLabel` renders `htmlFor`, `FormControl` renders `id` |
| Invalid state exposed | `FormControl` sets `aria-invalid={!!error}` |
| Error text announced | `FormControl` sets `aria-describedby` to the message id (plus the description id) |
| Error text is not colour-only | Message renders as text; colour is redundant reinforcement |
| Focus the first invalid field | RHF's `shouldFocusError` (default `true`) — **it only works if the control forwards its `ref` to the DOM node**. A wrapper that drops `ref` silently disables focus management; verify per control |
| After async/server errors | Call `form.setFocus(firstErroredName)` explicitly — `setError` does not move focus |
| Long forms | Render an error summary above the form |
| Required fields | Mark in the label text, not by `aria-required` alone |
| Submit feedback | `aria-live="polite"` region for the form-level message; `aria-busy` on the form while submitting |

Error summary for long or multi-step forms:

```tsx
function ErrorSummary({ fields }: { fields: ReadonlyArray<keyof InvoiceFormValues> }) {
  const { formState: { errors, submitCount } } = useFormContext<InvoiceFormValues>();
  const listed = fields.filter(f => errors[f]);
  if (submitCount === 0 || listed.length === 0) return null;
  return (
    <div role="alert" tabIndex={-1} className="rounded-md border border-destructive p-3">
      <p className="font-medium">Fix {listed.length} field(s) before continuing:</p>
      <ul>
        {listed.map(f => (
          <li key={String(f)}>
            {/* Anchors, not plain text: a keyboard user jumps straight to the field. */}
            <a href={`#${String(f)}`}>{errors[f]?.message as string}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Locale note: everything user-facing here (messages, summary copy, `aria-label`s) is app copy. In a
multi-locale app the form schema's messages become keys resolved by your i18n runtime; do not
localize inside components. Right-to-left locales need no form-specific handling beyond `dir` on the
document — but check that any custom control positions its icons logically, not with hard `left`.

---

## 8. Autosave

Only for forms whose canonical state is remote and continuously edited (a document editor, a
long profile). Otherwise it multiplies write traffic and makes failures invisible.

```tsx
const values = useWatch({ control: form.control });   // subtree subscription, not form.watch()
const debounced = useDebouncedValue(values, 800);

useEffect(() => {
  if (!form.formState.isDirty || !form.formState.isValid) return;
  save.mutate(debounced);
}, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps -- fire on debounced value only
```

Autosave must still surface failure (a persistent "Not saved" badge, not a toast that vanishes), and
must never autosave an invalid draft: a half-typed email overwriting a good one is data loss.

---

## 9. The React Compiler × react-hook-form trap

**Rule: in a form-heavy app, keep the React Compiler off until the form components are proven
compiler-safe, and write the reason into the config comment.**

Why: RHF's `formState` is a **Proxy** that records which properties you read and re-renders only for
those. The compiler memoizes the read as if it were an ordinary property access, so the subscription
is never registered — `isValid` and `isDirty` freeze at their initial values.

Symptoms, in the order you will meet them:

- A submit button gated on `!isValid || !isDirty` **never enables**, though the fields are visibly
  valid and `form.getValues()` is correct.
- `isSubmitting` never flips, so spinners never appear.
- The bug is invisible in dev-mode double-render for some components and present in others, which
  makes it read like a flaky styling issue.
- Disabling memoization for one component makes it work — the tell that this is compiler-related.

Record it in `next.config.ts` in the three-part shape `templates/config/next.config.ts` prescribes —
*what* is off, the *symptom*, the *re-enable condition* — because a bare omission reads as ignorance
and the next agent flips it back:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  // NOTE: `reactCompiler: true` is intentionally OFF.
  // SYMPTOM: the compiler memoizes reads of react-hook-form's `formState` Proxy, so
  //   `isValid`/`isDirty` stop updating and submit buttons never enable. This app is
  //   form-heavy, so the breakage is broad and silent — the form simply never submits.
  // RE-ENABLE WHEN: the form components subscribe to `formState` fields explicitly and
  //   one representative form flow is covered by a test.
};
```

If you must enable it, the fix per component is to destructure the specific flags at the top of the
component body (`const { isValid, isDirty } = useFormState({ control })`) — `useFormState` subscribes
through a hook the compiler treats as an opaque call — and to keep the compiler's advisory ESLint
rules on so unsafe patterns surface before the runtime does.

---

## 10. Version notes

| Concern | Next.js 16 / React 19 | Next.js 15 equivalent |
| --- | --- | --- |
| Form action state | `useActionState(action, initial)` from `react` | same (React 19); `useFormState` from `react-dom` on React 18 |
| Submit pending in a child | `useFormStatus()` from `react-dom` | same |
| Cache invalidation after a write | `updateTag('billing:invoices')` | `revalidateTag('billing:invoices')` |
| Route params in a form page | `const { id } = await params` | `params.id` (sync) |
| Zod error flattening | `z.flattenError(err)` (zod 4) | `err.flatten()` (zod 3) |
| Resolver | `standardSchemaResolver` (any Standard Schema library) or `zodResolver` | `zodResolver` |

`standardSchemaResolver` from `@hookform/resolvers/standard-schema` is preferred where available: it
binds the form to the Standard Schema interface rather than to zod specifically, so swapping
validation libraries does not touch a single component.

---

## Anti-patterns

| Never | Because | Instead |
| --- | --- | --- |
| `useActionState` and `handleSubmit` on the same `<form>` | Two submit owners; RHF's `preventDefault` stops the action, and two pending flags disagree | Pick one tier |
| Client validation without server validation | An action is a public endpoint; anyone can POST to it | `safeParse` inside the action, always |
| `defaultValues` missing fields | Inputs mount uncontrolled and flip controlled on `reset()`; selects stick on the placeholder and React warns | One `EMPTY` object naming every field |
| `value={field.value}` with a possibly-undefined value | Same uncontrolled→controlled flip, one field at a time | `value={field.value ?? ''}` (or `?? []`, `?? false`) in the wrapper |
| Throwing inside a write action to signal validation failure | Status and body are stripped in production; field binding and rollback break | `return { ok: false, … }` / `ActionState` |
| Showing backend field errors as a toast | The user cannot tell which input is wrong, and the message does not clear on edit | `applyFieldErrors` + a fallback toast for unknown fields |
| `form.watch()` with no argument in the render body | Re-renders the entire form on every keystroke | `useWatch({ control, name })` |
| `setValue` without `{ shouldValidate: true, shouldDirty: true }` for dependent fields | Cross-field `refine`s do not re-run; the submit button stays disabled with no visible error | Pass both flags |
| One `useForm` per wizard step | Earlier steps unmount and lose their values; back-button shows empty inputs | One form, a moving resolver |
| Persisting draft values containing credentials or personal data | `localStorage` is readable by any script on the origin and survives sign-out | Persist the cursor only; keep values in memory or on the server |
| `disabled` on a field you still need submitted (tier 1) | Disabled inputs are omitted from `FormData` | `readOnly`, or a hidden input |
| Setting `Content-Type: multipart/form-data` by hand | The boundary parameter is missing, so the server parses zero fields | Pass the `FormData` and let the runtime set the header |
| A fake progress bar for a Server Action upload | There is no progress signal to read; the bar lies | Indeterminate state, or a Route Handler + `XMLHttpRequest` |
| Enabling the React Compiler in a form-heavy app "because it's stable" | `formState` Proxy reads get memoized; submit buttons never enable | Off until components are compiler-safe, with the reason in the config |
| Re-implementing field-error parsing per form | Backend envelope knowledge leaks into components and drifts | `fieldErrors` / `errorMessage` from `@/common/errors` |
