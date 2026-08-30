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
 * ═══ A ROW'S MARKERS FOLLOW ITS OWN STATE (prompt 14) ═════════════════════════════
 * `requireAltWithImage` has refused a row with an image and an empty description since
 * prompt 10, in either language — and nothing on screen said so. The editor was told at
 * SAVE time about a rule the form never showed them.
 *
 * Both descriptions are marked required exactly while this row holds a path, which is
 * exactly what the schema refuses on. The condition is `useWatch` on the row's OWN path, so
 * it is per row rather than per gallery, and it lives here rather than in the five forms
 * that mount a gallery — one implementation, like the rule it mirrors.
 *
 * The row's uploader is marked required unconditionally, because a row with no path at all
 * fails `galleryFormItemSchema.path` outright: the row exists because somebody added it.
 *
 * ═══ AN EMPTY ROW IS AN INVALID ROW, ON PURPOSE ═══════════════════════════════════
 * "Add image" appends a row with no path, and the schema refuses it — so `FormButton` stays
 * disabled until the editor either uploads a file into it or removes it again. The
 * alternative (an add button that only appears after an upload) needs somewhere to hold a
 * file that belongs to no row yet, which is state outside the form and therefore invisible
 * to `isValid`. An incomplete row that says so is the honest version.
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
import { Button, Input, Label } from '@/common/components/ds';
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
                No images yet. The page shows no pictures until one is added.
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
                      // Unconditional: a gallery row with no path fails its own schema. The
                      // DESCRIPTIONS below are the conditional pair.
                      required
                    />

                    {/*
                      Both descriptions, side by side, with the Persian one in its own
                      direction and language — the same treatment `LocaleFieldPair` gives
                      every other translated field. Neither is filled in from the other, and
                      since prompt 14 nothing anywhere in this dashboard is.
                    */}
                    <div className="grid gap-3 md:grid-cols-2">
                      <GalleryAltInput<TValues>
                        name={`${name}.${index}.altEn` as Path<TValues>}
                        label="Description · English"
                        imagePath={`${name}.${index}.path` as Path<TValues>}
                      />
                      <GalleryAltInput<TValues>
                        name={`${name}.${index}.altFa` as Path<TValues>}
                        label="Description · Persian"
                        imagePath={`${name}.${index}.path` as Path<TValues>}
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
 * field's `FormItem` would give the row two `aria-describedby` chains.
 *
 * ─── THE LABEL IS VISIBLE NOW, AND THAT IS FORCED BY THE MARKER (prompt 14) ───────
 * It used to be `sr-only`, on the argument that the row's heading and the field's own label
 * already said what this was. A required marker inside a hidden label is invisible, which
 * is the entire defect this change exists to fix — so the label is shown, shortened to
 * "Description · English" because the row heading two lines above already says "Image 3".
 *
 * It also fixes something the hidden label was papering over: the two boxes were told apart
 * only by their PLACEHOLDER, which disappears the moment either one is typed into.
 *
 * `ds/Label` rather than a bare `<span>`, so the asterisk arrives with its `(required)`
 * from the one place that pairing is written — and associated with `htmlFor`/`id` rather
 * than by nesting. `ds/Label` RENDERS a `<label>`, so wrapping it in another one is invalid
 * markup and leaves the outer element with no unambiguous control; `useId` is SSR-stable,
 * which a hand-rolled counter is not.
 */
function GalleryAltInput<TValues extends FieldValues>({
  name,
  label,
  imagePath,
  dir,
  lang,
}: {
  name: Path<TValues>;
  label: string;
  /** The row's own path field. The marker appears exactly while it holds an image. */
  imagePath: Path<TValues>;
  dir?: 'rtl';
  lang?: string;
}) {
  const form = useFormContext<TValues>();
  const inputId = useId();
  const error = form.getFieldState(name, form.formState).error;
  // This ROW's path, not the gallery's: `useWatch` on one leaf, so typing in row 3 does not
  // re-render rows 1 and 2.
  const path = useWatch({ control: form.control, name: imagePath }) as unknown;
  const required = String(path ?? '').trim() !== '';

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={inputId} required={required}>
        {label}
      </Label>
      <Input
        {...form.register(name)}
        id={inputId}
        dir={dir}
        lang={lang}
        placeholder={dir === 'rtl' ? 'Persian description' : 'English description'}
        aria-invalid={Boolean(error)}
        classNames={{ input: dir === 'rtl' ? 'text-end' : undefined }}
      />
      {error?.message && (
        <span className="text-fs-xs tracking-flat-kavan text-danger">{String(error.message)}</span>
      )}
    </div>
  );
}
