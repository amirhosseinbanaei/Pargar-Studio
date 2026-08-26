// src/modules/dashboard/components/RepeatableListField.tsx
/**
 * A form-bound editor for a STRING ARRAY field: add, edit and remove rows of plain text.
 *
 * ─── WHY THIS EXISTS ───────────────────────────────────────────────────────────────
 * `design_works.team`, `studio.team` and `studio.alumni` are all `string[]` columns
 * (AGENTS.md), and a raw JSON textarea standing in for one of them is exactly the failure
 * mode the prompt this component was built for calls out by name: a studio typing a stray
 * comma at 11pm breaks its own site. `useFieldArray` is react-hook-form's own tool for an
 * array field, so add/remove stays inside the form's normal validate-and-dirty lifecycle
 * rather than a hand-rolled `useState` array that RHF knows nothing about.
 *
 * ─── WHY IT LIVES HERE, NOT IN `common/components/form/` ──────────────────────────
 * Promotion happens on the second consumer (`references/01-layering-and-boundaries.md`),
 * and this component's second consumer — `studio`'s team and alumni — is still inside the
 * dashboard module. If a resource outside `dashboard` ever needs a string-list editor, move
 * this file to `common/components/form/` unchanged.
 */
'use client';
import { useFieldArray, useFormContext, type FieldValues, type Path } from 'react-hook-form';
import { Button, Input } from '@/common/components/ds';
import { FormField, FormItem, FormLabel, FormMessage } from '@/common/components/form';

export interface RepeatableListFieldProps<TValues extends FieldValues> {
  name: Path<TValues>;
  label: React.ReactNode;
  /** Names one row for its remove button's accessible name and the "add" label default. */
  itemLabel?: string;
  addLabel?: string;
  description?: React.ReactNode;
  required?: boolean;
  /** Set on the Persian side of a locale pair — `rtl` text and `fa` shaping/voice. */
  dir?: 'rtl' | 'ltr';
  lang?: string;
}

export function RepeatableListField<TValues extends FieldValues>({
  name,
  label,
  itemLabel = 'Item',
  addLabel,
  description,
  required,
  dir,
  lang,
}: RepeatableListFieldProps<TValues>) {
  const form = useFormContext<TValues>();
  // `name as never` — `useFieldArray`'s generic wants a concrete field-array path, which a
  // component generic over `TValues` cannot express; the runtime behaviour does not depend
  // on the type parameter, only the caller's own schema does.
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

          <div className="flex flex-col gap-2">
            {fields.length === 0 && (
              <p className="text-fs-xs tracking-flat-kavan text-t-xlo">None yet.</p>
            )}
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <Input
                  {...form.register(`${name}.${index}` as Path<TValues>)}
                  dir={dir}
                  lang={lang}
                  aria-label={`${itemLabel} ${index + 1}`}
                  classNames={{
                    container: 'flex-1',
                    input: dir === 'rtl' ? 'text-end' : undefined,
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
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
            onClick={() => append('' as never)}
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
