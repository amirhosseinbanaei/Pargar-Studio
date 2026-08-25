// src/modules/dashboard/components/FormCheckboxGroup.tsx
/**
 * A form-bound control for an ARRAY-valued field: several checkboxes, one field name.
 *
 * The `form/` tier ships `FormCheckbox`, which binds ONE boolean to one name. A project
 * carries more than one type (`['Residential', 'Interior Design']`,
 * `legacy/data/projects.js:31`), so its control has to hold a `string[]` — and getting that
 * wrong is what makes a multi-type project vanish from a type filter, the exact bug prompt 4
 * pinned a test against on the read side.
 *
 * ─── WHY IT IS BUILT FROM `FormField`, NOT FROM SCRATCH ───────────────────────────
 * `FormField`, `FormItem`, `FormLabel` and `FormMessage` are all exported from the form
 * tier's barrel precisely so a composite control can be assembled from them. Doing that
 * rather than reaching for `Controller` directly is what keeps the generated id, the
 * `aria-describedby` wiring and the error message rendering identical to every other field
 * on the page — a hand-rolled group is how one field out of sixteen ends up with no message.
 *
 * ─── WHY IT LIVES IN THIS MODULE AND NOT IN `common/components/form/` ─────────────
 * It has exactly one consumer. `references/01-layering-and-boundaries.md` promotes on the
 * SECOND consumer, not the first, because a component generalized against one call site
 * invariably gets its API wrong — and here the open question is whether the second consumer
 * wants checkboxes at all or a multi-select. `design_works.category` and `media.type` are
 * both single-valued, so prompt 7 may well never need this. If it does, this file moves to
 * `common/components/form/FormCheckboxGroup.tsx` unchanged and both call sites import it
 * from there.
 */
'use client';
import type { FieldValues, Path } from 'react-hook-form';
import { useFormContext } from 'react-hook-form';
import { Checkbox } from '@/common/components/ds';
import { FormField, FormItem, FormLabel, FormMessage } from '@/common/components/form';

export interface FormCheckboxGroupOption {
  value: string;
  label: React.ReactNode;
}

export interface FormCheckboxGroupProps<TValues extends FieldValues> {
  name: Path<TValues>;
  label: React.ReactNode;
  options: readonly FormCheckboxGroupOption[];
  description?: React.ReactNode;
  required?: boolean;
}

export function FormCheckboxGroup<TValues extends FieldValues>({
  name,
  label,
  options,
  description,
  required,
}: FormCheckboxGroupProps<TValues>) {
  const form = useFormContext<TValues>();

  return (
    <FormField
      name={name}
      control={form.control}
      render={({ field }) => {
        /**
         * `?? []` — never hand a controlled control `undefined`. The same rule the rest of
         * the tier follows with `?? ''`: a field that starts undefined mounts uncontrolled
         * and flips on the first `reset()`.
         */
        const selected: string[] = Array.isArray(field.value) ? (field.value as string[]) : [];

        const toggle = (value: string, checked: boolean) => {
          /**
           * Rebuild from `options`, do NOT push and filter the existing array.
           *
           * Two things fall out of that. The result keeps the CANONICAL order from
           * `common/schemas/enums.ts` rather than the order the boxes happened to be clicked
           * in — that order is deliberate, not alphabetical (AGENTS.md), and the public site
           * renders types in it. And a new array is produced every time, so react-hook-form
           * sees a changed reference and re-validates; mutating the array it handed us would
           * leave `isDirty` and `isValid` stale and the submit button disabled over an edit
           * that visibly happened.
           */
          const next = new Set(selected);
          if (checked) next.add(value);
          else next.delete(value);
          field.onChange(options.filter(option => next.has(option.value)).map(o => o.value));
        };

        return (
          <FormItem>
            <FormLabel required={required}>{label}</FormLabel>
            {description && (
              <p className="text-fs-xs tracking-flat-kavan text-t-xlo">{description}</p>
            )}

            {/*
              `role="group"` plus `aria-label`: without it the checkboxes are announced as
              nine unrelated controls rather than as one field with nine options, and the
              field's own label is never read. A `<fieldset>` would do the same job, but the
              form tier's `FormItem` already provides the labelled wrapper and nesting a
              second one would give the group two accessible names.
            */}
            <div
              role="group"
              aria-label={typeof label === 'string' ? label : undefined}
              className="flex flex-wrap gap-x-6 gap-y-3 border border-rule bg-s-1 p-4"
            >
              {options.map(option => (
                <Checkbox
                  key={option.value}
                  label={option.label}
                  value={option.value}
                  checked={selected.includes(option.value)}
                  onCheckedChange={checked => toggle(option.value, checked === true)}
                  onBlur={field.onBlur}
                />
              ))}
            </div>

            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
