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
 * ─── WHY IT LIVES HERE, NOT IN `common/components/form/` ──────────────────────────
 * Same rule as `RepeatableListField`: one module (`dashboard`) is the only consumer so far.
 * Promote unchanged on the day a resource outside this module needs it.
 */
'use client';
import { useFieldArray, useFormContext, type FieldValues, type Path } from 'react-hook-form';
import { Button, Input, Textarea } from '@/common/components/ds';
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
