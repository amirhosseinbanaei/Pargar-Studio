// src/modules/dashboard/components/RepeatableGroupField.tsx
/**
 * A form-bound editor for an ARRAY OF OBJECTS: add, edit and remove rows, each row holding
 * several named columns.
 *
 * ─── THE ONE COMPONENT BEHIND SIX FIELDS ───────────────────────────────────────────
 * `design_works.facts` / `media.facts` (`{ k, v }`), `studio.founders` (`{ name, role, born,
 * bio }`), `studio.stats` (`{ label, value }`), `studio.awards` (`{ year, title, project,
 * body }`), `studio.chapters` (`{ year, text }`) and `contact.socials` (`{ name, handle }`)
 * are all arrays of small, flat objects. Building a bespoke editor per resource would be six
 * near-identical components differing only in which keys they know about — six places for
 * one bug (a `k`/`v` swap, a lost `Remove` handler) to be introduced once and fixed five
 * times. `columns` is what lets one component describe all six shapes.
 *
 * `emptyRow` is supplied by the caller rather than inferred, because a schema-derived
 * default would need runtime access to the zod shape and this component is deliberately
 * schema-agnostic — it only ever sees the field NAMES, from `columns` and `imageKey`.
 *
 * ─── ONE ROW MAY CARRY AN IMAGE (prompt 10) ────────────────────────────────────────
 * `imageKey` names a row key holding an uploaded path and renders `ImageUploadField` for it
 * above that row's text columns. `studio.founders` is the only list that uses it today —
 * see that prop for why it is set on the English side only.
 *
 * ─── AND ITS DESCRIPTION IS REQUIRED WHILE IT HOLDS ONE (prompt 14) ───────────────
 * `imageAltKey` names the column DESCRIBING that image. It gets a visible label and a
 * required marker exactly while the row's image path is non-empty, matching what
 * `requireStudioImages` in `../schemas/studio-form` refuses on.
 *
 * The gap this closes was found by prompt 14's label-versus-schema sweep and is worth
 * stating: prompt 10 made alt text required wherever there is an image and wired the rule
 * into four editors, but not into this one — a founder's picture is a key inside a
 * repeatable row rather than a `coverImage` field, so a portrait could be saved with no
 * description at all. `StudioScreen` then falls back to the GENERATED portrait, so the
 * symptom was an uploaded photograph that simply never appeared on the page.
 *
 * ─── WHY IT LIVES HERE, NOT IN `common/components/form/` ──────────────────────────
 * Same rule as `RepeatableListField`: one module (`dashboard`) is the only consumer so far.
 * Promote unchanged on the day a resource outside this module needs it.
 */
'use client';
import { useId } from 'react';
import {
  useFieldArray,
  useFormContext,
  useWatch,
  type FieldValues,
  type Path,
} from 'react-hook-form';
import { Button, Input, Label, Textarea } from '@/common/components/ds';
import { FormField, FormItem, FormLabel, FormMessage } from '@/common/components/form';
import { ImageUploadField } from './ImageUploadField';

export interface RepeatableGroupColumn {
  /** The row object's key — `'k'`, `'title'`, `'year'`. */
  key: string;
  label: string;
  multiline?: boolean;
}

export interface RepeatableGroupFieldProps<TValues extends FieldValues> {
  name: Path<TValues>;
  label: React.ReactNode;
  columns: readonly RepeatableGroupColumn[];
  /** The row a click on "Add" appends — every column present, each an empty string. */
  emptyRow: Record<string, string>;
  itemLabel?: string;
  addLabel?: string;
  description?: React.ReactNode;
  required?: boolean;
  /** Set on the Persian side of a locale pair — `rtl` text and `fa` shaping/voice. */
  dir?: 'rtl' | 'ltr';
  lang?: string;
  /**
   * The row key holding an uploaded image path, if this list has one. Rendering an uploader
   * for it above the text columns is the whole extension prompt 10 made to this component.
   *
   * IT IS SET ON ONE SIDE OF A LOCALE PAIR ONLY. `studio.founders` is stored as two
   * index-aligned arrays and a founder's PORTRAIT is not per-locale — only the sentence
   * describing it is. So the English founders editor passes this and the Persian one does
   * not, and the save copies each path across by index
   * (`../schemas/studio-form.ts`'s `withPersianFallback`). Rendering an uploader on both
   * sides would let the two arrays disagree about which photograph a founder has, which is
   * a bug with no symptom in English.
   */
  imageKey?: string;
  imageLabel?: string;
  /**
   * The column describing `imageKey`'s picture. It carries a visible label and a required
   * marker exactly while that row holds an image — see the header.
   *
   * Set on BOTH sides of a locale pair, unlike `imageKey`: the path has one author but the
   * sentence describing it is per-locale, and both are refused when empty beside a picture.
   */
  imageAltKey?: string;
}

export function RepeatableGroupField<TValues extends FieldValues>({
  name,
  label,
  columns,
  emptyRow,
  itemLabel = 'Row',
  addLabel,
  description,
  required,
  dir,
  lang,
  imageKey,
  imageLabel = 'Image',
  imageAltKey,
}: RepeatableGroupFieldProps<TValues>) {
  const form = useFormContext<TValues>();
  const { fields, append, remove } = useFieldArray({ control: form.control, name: name as never });

  return (
    <FormField
      name={name}
      control={form.control}
      render={() => (
        <FormItem>
          <FormLabel required={required}>{label}</FormLabel>
          {description && (
            <p className="text-fs-xs tracking-flat-kavan text-t-xlo">{description}</p>
          )}

          <div className="flex flex-col gap-3">
            {fields.length === 0 && (
              <p className="text-fs-xs tracking-flat-kavan text-t-xlo">None yet.</p>
            )}
            {fields.map((field, index) => (
              <div key={field.id} className="flex flex-col gap-2 border border-rule bg-s-1 p-3">
                {imageKey && (
                  <ImageUploadField<TValues>
                    name={`${name}.${index}.${imageKey}` as Path<TValues>}
                    label={`${itemLabel} ${index + 1} · ${imageLabel}`}
                    itemLabel={imageLabel.toLowerCase()}
                  />
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  {columns.map(column => {
                    const path = `${name}.${index}.${column.key}` as Path<TValues>;
                    const itemAriaLabel = `${itemLabel} ${index + 1} · ${column.label}`;

                    // The one column whose requirement depends on a sibling. Its own small
                    // component because it needs a hook, and a hook cannot be called from
                    // inside this `.map`'s callback conditionally.
                    if (imageAltKey && column.key === imageAltKey) {
                      return (
                        <ImageAltColumn<TValues>
                          key={column.key}
                          name={path}
                          label={column.label}
                          // The row's own image, however the row is named. On the Persian
                          // side of a pair the uploader is not rendered but the path IS
                          // present in the values, copied across on save — so the marker is
                          // correct on both sides.
                          imagePath={`${name}.${index}.${imageKey ?? imageAltKey}` as Path<TValues>}
                          dir={dir}
                          lang={lang}
                        />
                      );
                    }

                    return column.multiline ? (
                      <Textarea
                        key={column.key}
                        {...form.register(path)}
                        dir={dir}
                        lang={lang}
                        placeholder={column.label}
                        aria-label={itemAriaLabel}
                        rows={2}
                        className={dir === 'rtl' ? 'text-end' : undefined}
                      />
                    ) : (
                      <Input
                        key={column.key}
                        {...form.register(path)}
                        dir={dir}
                        lang={lang}
                        placeholder={column.label}
                        aria-label={itemAriaLabel}
                        classNames={{ input: dir === 'rtl' ? 'text-end' : undefined }}
                      />
                    );
                  })}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
                  className="self-end"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => append(emptyRow as never)}
            className="self-start"
          >
            {addLabel ?? `Add ${itemLabel.toLowerCase()}`}
          </Button>

          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * The column that DESCRIBES a row's picture.
 *
 * A VISIBLE label, rather than the `aria-label` every other column in this component uses:
 * a required marker inside an invisible label is invisible, which is the whole point of
 * showing it. `ds/Label` pairs the glyph with a real `(required)` for a screen reader, in
 * the one place that pairing is written.
 *
 * Associated with `htmlFor`/`id`, never by nesting — `ds/Label` renders a `<label>` itself,
 * and a `<label>` inside a `<label>` is invalid markup with no unambiguous control. `useId`
 * is SSR-stable, which a hand-rolled counter is not.
 */
function ImageAltColumn<TValues extends FieldValues>({
  name,
  label,
  imagePath,
  dir,
  lang,
}: {
  name: Path<TValues>;
  label: string;
  imagePath: Path<TValues>;
  dir?: 'rtl' | 'ltr';
  lang?: string;
}) {
  const form = useFormContext<TValues>();
  const inputId = useId();
  // One leaf, so a row with a picture does not re-render every other row on each keystroke.
  const path = useWatch({ control: form.control, name: imagePath }) as unknown;
  const required = String(path ?? '').trim() !== '';

  return (
    <div className="flex flex-col gap-1 sm:col-span-2">
      <Label htmlFor={inputId} required={required}>
        {label}
      </Label>
      <Input
        {...form.register(name)}
        id={inputId}
        dir={dir}
        lang={lang}
        placeholder={label}
        classNames={{ input: dir === 'rtl' ? 'text-end' : undefined }}
      />
    </div>
  );
}
