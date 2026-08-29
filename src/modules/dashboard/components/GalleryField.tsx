// src/modules/dashboard/components/GalleryField.tsx
/**
 * The ordered gallery editor: a list of photographs, each with its own description in both
 * languages, in the order they will appear on the public detail page.
 *
 * ═══ ONE LIST, TWO COLUMNS ════════════════════════════════════════════════════════
 * The database stores `gallery_en` and `gallery_fa` as two index-aligned JSON arrays, per
 * the per-locale column-pair rule the rest of the content model follows. This component
 * deliberately does NOT mirror that shape: it edits ONE list in which a row carries the path
 * and both alt texts, and `toGalleryColumns` in `../schemas/image` splits it on save.
 *
 * That is what makes the two columns unable to desync. Two independent editors — the shape
 * `StudioForm` uses for the founders, which predates this — would let someone add a
 * photograph to the English gallery and not the Persian one, or reorder one and not the
 * other, and item `i` would stop being the same picture in both. The symptom appears only
 * on the Persian page, which is the language fewer people check.
 *
 * ═══ ORDER IS PART OF THE RECORD, SO THE DROP IS LOCAL ════════════════════════════
 * This is the same `SortableList` the tables use, with the one difference that matters:
 * `commit.to === 'form'`, so a drop calls `useFieldArray`'s `move` and posts NOTHING. A
 * table's rows exist independently of any form and their order is written the moment it
 * changes; a gallery's order is a field of the record being edited, so it moves with the rest
 * of the unsaved values and is written by the same save — reordering and then cancelling
 * leaves the stored order alone, which is what an editor expects of anything inside a form.
 *
 * One component rather than a second local one means the drag handle, the keyboard protocol
 * and the announcements are identical here and in the tables, which is the whole reason
 * `SortableList` takes the commit as a parameter instead of assuming one.
 *
 * ═══ AN EMPTY ROW IS AN INVALID ROW, ON PURPOSE ═══════════════════════════════════
 * "Add image" appends a row with no path, and the schema refuses it — so `FormButton` stays
 * disabled until the editor either uploads a file into it or removes it again. The
 * alternative (an add button that only appears after an upload) needs somewhere to hold a
 * file that belongs to no row yet, which is state outside the form and therefore invisible
 * to `isValid`. An incomplete row that says so is the honest version.
 */
'use client';
import { useFieldArray, useFormContext, type FieldValues, type Path } from 'react-hook-form';
import { Button, Input } from '@/common/components/ds';
import {
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/common/components/form';
import type { GalleryFormItem } from '../schemas/image';
import { ImageUploadField } from './ImageUploadField';
import { SortableDragHandle, SortableList } from './SortableList';

export interface GalleryFieldProps<TValues extends FieldValues> {
  name: Path<TValues>;
  label: React.ReactNode;
  description?: React.ReactNode;
}

const EMPTY_ROW: GalleryFormItem = { path: '', altEn: '', altFa: '' };

export function GalleryField<TValues extends FieldValues>({
  name,
  label,
  description,
}: GalleryFieldProps<TValues>) {
  const form = useFormContext<TValues>();
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: name as never,
  });

  return (
    <FormField
      name={name}
      control={form.control}
      render={() => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          {description && <FormDescription>{description}</FormDescription>}

          <div className="flex flex-col gap-4">
            {fields.length === 0 && (
              <p className="text-fs-xs tracking-flat-kavan text-t-xlo">
                No images yet. The detail page shows its generated drawings.
              </p>
            )}

            <SortableList<string>
              id={`gallery-${String(name)}`}
              variant="block"
              itemNoun="image"
              // `move` straight through: the field array IS the list, so there is no
              // optimistic copy to keep and nothing to reconcile against.
              commit={{ to: 'form', move: (from, to) => move(from, to) }}
              items={fields.map((field, index) => ({
                id: field.id,
                // Names the POSITION, because every row here is otherwise identical to
                // anyone navigating by control — a gallery row has no title of its own.
                name: `image ${index + 1}`,
                className: 'flex flex-col gap-3 border border-rule bg-s-1 p-3',
                children: (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">
                        Image {index + 1}
                      </p>
                      <div className="flex items-center gap-1">
                        <SortableDragHandle />
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => remove(index)}
                          aria-label={`Remove image ${index + 1}`}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    <ImageUploadField<TValues>
                      name={`${name}.${index}.path` as Path<TValues>}
                      label={`Image ${index + 1} file`}
                      itemLabel="image"
                    />

                    {/*
                  Both descriptions, side by side, with the Persian one in its own direction
                  and language — the same treatment `LocaleFieldPair` gives every other
                  translated field. Neither is optional and neither is filled in from the
                  other: see `../schemas/image` for why alt text is the one exception to the
                  Persian-falls-back-to-English rule.
                */}
                    <div className="grid gap-3 md:grid-cols-2">
                      <GalleryAltInput<TValues>
                        name={`${name}.${index}.altEn` as Path<TValues>}
                        label={`Image ${index + 1} description · English`}
                      />
                      <GalleryAltInput<TValues>
                        name={`${name}.${index}.altFa` as Path<TValues>}
                        label={`Image ${index + 1} description · Persian`}
                        dir="rtl"
                        lang="fa"
                      />
                    </div>
                  </>
                ),
              }))}
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => append(EMPTY_ROW as never)}
            className="self-start"
          >
            Add image
          </Button>

          {/* Carries a server 422 about any row: `z.flattenError` collapses
              `gallery.2.altFa` onto the top-level `gallery` key, so the message reaches a
              control the editor can see even though it cannot point at the row. */}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * One alt-text box.
 *
 * Its own small component rather than a `FormInput`, because a `FormInput` renders a
 * `FormItem` with its own label/description/message wiring and nesting one inside this
 * field's `FormItem` would give the row two `aria-describedby` chains. Here the label is
 * visually hidden — the row's heading and the field's own label already say what this is —
 * and remains a real `<label>` so the control is named for anyone who cannot see that
 * grouping.
 */
function GalleryAltInput<TValues extends FieldValues>({
  name,
  label,
  dir,
  lang,
}: {
  name: Path<TValues>;
  label: string;
  dir?: 'rtl';
  lang?: string;
}) {
  const form = useFormContext<TValues>();
  const error = form.getFieldState(name, form.formState).error;

  return (
    <label className="flex flex-col gap-1">
      <span className="sr-only">{label}</span>
      <Input
        {...form.register(name)}
        dir={dir}
        lang={lang}
        placeholder={dir === 'rtl' ? 'Persian description' : 'English description'}
        aria-invalid={Boolean(error)}
        classNames={{ input: dir === 'rtl' ? 'text-end' : undefined }}
      />
      {error?.message && (
        <span className="text-fs-xs tracking-flat-kavan text-danger">{String(error.message)}</span>
      )}
    </label>
  );
}
