// src/modules/dashboard/components/ImageUploadField.tsx
/**
 * THE UPLOADER. One control, used everywhere a record takes a picture — a project's cover,
 * a design work's cover, a media entry's cover, each gallery row, each founder's portrait.
 *
 * ═══ IT IS A `form/` TIER FIELD, NOT A WIDGET BESIDE THE FORM ═════════════════════
 * It renders through `FormField` / `FormItem` / `FormMessage` and its value is owned by
 * react-hook-form like any other field. That is the requirement, not a stylistic choice:
 * `FormButton` gates the submit on `isValid`, which is computed from the form's own values,
 * so an uploader holding its path in `useState` beside the form would leave the button
 * disabled on a valid record — the exact symptom `references/07-forms.md` §9 describes for
 * a different cause, with no error to point at.
 *
 * The VALUE is the stored path as a plain string, `''` for none. `references/07-forms.md`
 * §6's rule — keep `File` objects out of form values, store the returned key — is what makes
 * that work: the file is uploaded immediately, RHF only ever holds text, and the value
 * survives a `reset()` without re-uploading anything.
 *
 * ═══ TWO WAYS IN, AND THE KEYBOARD ONE IS THE REAL CONTROL ════════════════════════
 * A file can be dropped on the zone or chosen from the picker, and the picker is a genuine
 * `<input type="file">` with a genuine `<label>` — visually hidden but FOCUSABLE, never
 * `display: none`, which would take it out of the tab order and out of the accessibility
 * tree at once.
 *
 * That input is the whole reason this component is operable at all without a pointer. A drop
 * zone is a pointer-only affordance: there is no keyboard gesture for "drag", so a control
 * whose only way in is a drop cannot be used by a large number of people. The label is
 * styled as the button, `peer-focus-visible:` puts the focus ring on it when the hidden
 * input takes focus, and the drop handling is an ENHANCEMENT layered over a control that
 * already worked. `SortableList` answers the same question the other way and says why: a
 * drag needs a keyboard implementation of its own, and prompt 11 shipped one.
 *
 * ═══ THE PREVIEW SHOWS WHAT IS STORED ═════════════════════════════════════════════
 * While the request is in flight the preview is the local `URL.createObjectURL` — instant
 * feedback on a file that has not gone anywhere yet. The moment the upload lands it is
 * REPLACED by `/api/media/<stored path>`, fetched back from the server.
 *
 * That swap is the point. A preview that only ever shows the local file looks identical
 * whether the bytes reached the disk, reached a full disk, or reached a volume that is not
 * mounted — the picture is on screen, the editor saves, and the failure surfaces weeks later
 * as a broken image on the public site. Rendering the stored URL means the round trip is
 * part of what the editor sees.
 *
 * ═══ FAILURES GO THROUGH `ResultRegion` IN THE NORMALIZED SHAPE ═══════════════════
 * `/api/uploads` answers in the same `ActionResult` envelope the Server Actions use, so this
 * branches on `result.status` and never on message text — the rule
 * `references/06-error-system.md` §4.3 states and `RecordForm.tsx:18` follows. A 422 carries
 * `{ image: [message] }`, and that message is bound onto THIS field through the form's own
 * error state, so it appears under the control and clears when a different file is chosen.
 *
 * ═══ WHY `XMLHttpRequest` AND NOT `fetch` ═════════════════════════════════════════
 * `upload.onprogress` is the only real progress signal a browser exposes; `fetch` has none
 * and a Server Action has none. `references/07-forms.md` §6 is explicit that the alternative
 * to a real percentage is an indeterminate state, never a fake bar. The progress here is
 * real, and it is the reason `/api/uploads` takes raw bytes rather than multipart.
 */
'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useFormContext, type FieldValues, type Path } from 'react-hook-form';
import { Button } from '@/common/components/ds';
import {
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/common/components/form';
import { mapError, type NormalizedError } from '@/common/errors';
import { IMAGE_ACCEPT_ATTRIBUTE, MAX_UPLOAD_BYTES, mediaUrl } from '@/common/constants/uploads';
import type { ActionResult } from '@/common/services/action-result';
import type { UploadedImage } from '@/common/schemas/image';
import { ResultRegion } from './ResultRegion';

export interface ImageUploadFieldProps<TValues extends FieldValues> {
  /** Holds the stored path as a string; `''` means no image. */
  name: Path<TValues>;
  label: React.ReactNode;
  description?: React.ReactNode;
  /** Renders the label's required marker. The cross-field alt rule lives in the schema. */
  required?: boolean;
  /** Shown in the empty frame and used to name the controls in a list of many. */
  itemLabel?: string;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'uploading'; percent: number; localPreview: string }
  | { kind: 'failed'; error: NormalizedError | null; message: string | null };

export function ImageUploadField<TValues extends FieldValues>({
  name,
  label,
  description,
  required,
  itemLabel = 'image',
}: ImageUploadFieldProps<TValues>) {
  const form = useFormContext<TValues>();
  const inputId = useId();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  /**
   * The in-flight request, so a second file chosen while the first is uploading aborts it
   * rather than racing it. Without this the two responses can land in either order and the
   * field ends up holding the path of the file the editor replaced.
   */
  const requestRef = useRef<XMLHttpRequest | null>(null);

  // An object URL is leaked memory until it is revoked, and a stale one renders the
  // PREVIOUS file — which on a replace is the single most confusing thing this control
  // could do. Revoked when the phase leaves `uploading` and on unmount.
  useEffect(() => {
    const url = phase.kind === 'uploading' ? phase.localPreview : null;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [phase]);

  useEffect(() => () => requestRef.current?.abort(), []);

  return (
    <FormField
      name={name}
      control={form.control}
      render={({ field }) => {
        const storedPath = typeof field.value === 'string' ? field.value : '';

        const beginUpload = (file: File) => {
          // Client-side rejection is FEEDBACK, not enforcement: the endpoint checks the same
          // number while streaming. Refusing here saves an 8 MB round trip that would end in
          // a 413 the person cannot act on any differently.
          if (file.size > MAX_UPLOAD_BYTES) {
            setPhase({
              kind: 'failed',
              error: null,
              message: `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`,
            });
            return;
          }

          requestRef.current?.abort();
          const localPreview = URL.createObjectURL(file);
          setPhase({ kind: 'uploading', percent: 0, localPreview });

          const request = new XMLHttpRequest();
          requestRef.current = request;
          request.open('POST', '/api/uploads');
          request.responseType = 'json';

          request.upload.addEventListener('progress', event => {
            if (!event.lengthComputable) return;
            setPhase(current =>
              current.kind === 'uploading'
                ? { ...current, percent: Math.round((event.loaded / event.total) * 100) }
                : current,
            );
          });

          request.addEventListener('load', () => {
            requestRef.current = null;
            const result = request.response as ActionResult<UploadedImage> | null;

            if (result?.ok) {
              // `shouldValidate` and `shouldDirty` are both required: without the first the
              // cross-field alt rule never re-runs and the submit button stays disabled with
              // no visible error, and without the second an edit form never becomes dirty so
              // the button never enables at all. `references/07-forms.md` §4.
              field.onChange(result.data.path);
              form.setValue(name, result.data.path as never, {
                shouldValidate: true,
                shouldDirty: true,
              });
              setPhase({ kind: 'idle' });
              return;
            }

            const status = result && !result.ok ? result.status : request.status;
            const body = result && !result.ok ? result.body : undefined;
            /**
             * Branching on the STATUS, never on the sentence. 401 is the only one that needs
             * its own copy — the session died between loading this page and choosing a file,
             * and "reload and sign in" is actionable where a generic failure is not, exactly
             * as `RecordForm` handles the same status for a save.
             */
            if (status === 401) {
              setPhase({
                kind: 'failed',
                error: null,
                message: 'Your session has expired. Reload the page and sign in again.',
              });
              return;
            }
            setPhase({ kind: 'failed', error: mapError({ status, body }), message: null });
          });

          request.addEventListener('error', () => {
            requestRef.current = null;
            // `status: 0` — the request never reached the server. `mapError` refuses to show
            // a status-0 body for exactly this case and answers with the network sentence.
            setPhase({ kind: 'failed', error: mapError({ status: 0 }), message: null });
          });

          request.addEventListener('abort', () => {
            requestRef.current = null;
          });

          // The body IS the file. No multipart, no hand-set `Content-Type` — the browser
          // sets it from the `File`, and `/api/uploads` ignores it anyway and sniffs the
          // bytes.
          request.send(file);
        };

        const clear = () => {
          requestRef.current?.abort();
          form.setValue(name, '' as never, { shouldValidate: true, shouldDirty: true });
          setPhase({ kind: 'idle' });
          // Without this, choosing the SAME file again fires no `change` event and the
          // control appears dead. `references/07-forms.md` §6.
          if (inputRef.current) inputRef.current.value = '';
        };

        const uploading = phase.kind === 'uploading';
        const preview = uploading ? phase.localPreview : storedPath ? mediaUrl(storedPath) : null;

        return (
          <FormItem>
            <FormLabel required={required}>{label}</FormLabel>
            {description && <FormDescription>{description}</FormDescription>}

            {/*
              The drop target. `role` is deliberately absent and it carries no `tabIndex`:
              it is not the control, the file input inside it is. Giving a div a tab stop
              whose only action is "receive a drop" adds a focusable element that a keyboard
              user cannot do anything with.
            */}
            <div
              onDragOver={event => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={event => {
                event.preventDefault();
                setDragging(false);
                const file = event.dataTransfer.files[0];
                if (file) beginUpload(file);
              }}
              data-dragging={dragging || undefined}
              className="flex flex-col gap-3 border border-dashed border-rule p-3 transition-colors duration-[var(--d-xs)] ease-out-kavan data-[dragging]:border-a-1"
            >
              <div className="flex items-start gap-3">
                {/*
                  4:3, matching `.card__frame` — so what an editor sees here is framed the
                  way the public card frames it, rather than at the file's own proportions.
                */}
                <div className="relative aspect-[4/3] w-40 shrink-0 overflow-hidden border border-rule bg-s-1">
                  {preview ? (
                    /*
                      A plain <img>, not `next/image`. This is an admin preview of one small
                      picture behind a login: routing it through the optimizer would add a
                      re-encode per upload for an image nobody but the editor ever sees. The
                      PUBLIC pages use `next/image`, which is where it earns its cost.
                    */
                    // eslint-disable-next-line @next/next/no-img-element -- admin-only preview; see above
                    <img
                      src={preview}
                      alt=""
                      className="size-full object-cover"
                      // The stored preview is a fresh URL per upload and is `immutable`, so
                      // there is nothing to bust; this only stops a browser reusing a
                      // decoded frame across a replace.
                      key={preview}
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-fs-xs tracking-mid-kavan text-t-xlo uppercase">
                      No {itemLabel}
                    </span>
                  )}
                </div>

                <div className="flex min-w-0 flex-col items-start gap-2">
                  {/*
                    THE KEYBOARD PATH. The input is `sr-only` — hidden from sight, present in
                    the tab order and in the accessibility tree — and `peer` lets the label
                    below it wear the focus ring, so tabbing to it is visible. `display:
                    none` here would break both at once.
                  */}
                  <input
                    ref={inputRef}
                    id={inputId}
                    type="file"
                    accept={IMAGE_ACCEPT_ATTRIBUTE}
                    className="peer sr-only"
                    disabled={uploading}
                    onChange={event => {
                      const file = event.target.files?.[0];
                      if (file) beginUpload(file);
                    }}
                  />
                  <label
                    htmlFor={inputId}
                    className="inline-flex h-control cursor-pointer items-center border border-rule px-4 text-fs-xs tracking-mid-kavan text-t-md uppercase transition-colors duration-[var(--d-xs)] ease-out-kavan peer-focus-visible:outline-1 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-a-1 peer-disabled:cursor-not-allowed peer-disabled:opacity-disabled hover:border-rule-md hover:text-t-hi"
                  >
                    {storedPath ? `Replace ${itemLabel}` : `Choose ${itemLabel}`}
                  </label>

                  {storedPath && !uploading && (
                    <Button variant="ghost" size="sm" type="button" onClick={clear}>
                      Remove
                    </Button>
                  )}

                  <p className="text-fs-xs tracking-flat-kavan text-t-xlo">
                    Drop a file here, or use the button. JPEG, PNG, WebP, AVIF or GIF, up to{' '}
                    {formatBytes(MAX_UPLOAD_BYTES)}.
                  </p>

                  {uploading && (
                    /*
                      A REAL percentage from `upload.onprogress`. `progress` announces itself
                      to assistive technology; the text beside it is for everyone else and
                      is `aria-hidden` so the value is not read twice.
                    */
                    <div className="flex w-full items-center gap-2">
                      <progress
                        className="h-1 w-32"
                        max={100}
                        value={phase.percent}
                        aria-label={`Uploading ${itemLabel}`}
                      />
                      <span aria-hidden className="text-fs-xs text-t-xlo">
                        {phase.percent}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {phase.kind === 'failed' && (
                <ResultRegion error={phase.error} message={phase.message} />
              )}
            </div>

            {/* The schema's message for THIS field — the alt-text rule names the alt fields,
                but a path that fails its pattern lands here. */}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

/** `8388608` -> `8 MB`. One decimal below 10 MB, because "8.4 MB" is more use than "8 MB". */
function formatBytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return megabytes < 10 ? `${Math.round(megabytes * 10) / 10} MB` : `${Math.round(megabytes)} MB`;
}
