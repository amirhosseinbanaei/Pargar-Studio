// src/modules/dashboard/components/LocaleFieldPair.tsx
/**
 * ONE TRANSLATED FIELD, BOTH LANGUAGES, SIDE BY SIDE. English on the left, Persian on the
 * right with `dir="rtl"` and the Persian type treatment.
 *
 * ─── THIS COMPONENT IS THE PAYOFF OF THE SCHEMA DECISION ──────────────────────────
 * AGENTS.md records that bilingual content is per-locale COLUMNS on one row — `title_en` and
 * `title_fa` — rather than a translations table. This is what that buys: a translated field
 * is one pair of inputs in one form, so translating a project is a single save instead of
 * two, and it is impossible to save the English half and forget the Persian one, because
 * they are on screen together.
 *
 * With a translations table the same screen would be two records, two saves, two failure
 * modes and a join to keep them associated.
 *
 * ─── `dir="rtl"` IS ON THE FIELD, NOT THE PAGE ────────────────────────────────────
 * The dashboard's interface language is English and its document is `dir="ltr"` (AGENTS.md).
 * Only the Persian INPUT is right-to-left, which is exactly the right scope: the label, the
 * validation message and the layout stay in the interface's direction, and the text the
 * editor is typing behaves the way Persian text has to — caret on the right, punctuation at
 * the correct end, and mixed Latin runs (a client name, a year) isolated correctly by the
 * browser's own bidi algorithm rather than by a rule this app would have to write.
 *
 * `lang="fa"` is not decoration either. It is what lets the browser pick Persian shaping and
 * hyphenation rules, and what tells a screen reader to switch voices — without it a Persian
 * value is read out by an English synthesiser.
 *
 * ─── WHY THE PERSIAN SIDE IS NEVER MARKED REQUIRED ────────────────────────────────
 * Persian is optional on save; an empty Persian column is filled with its English
 * counterpart by the action before the write (`schemas/project-form.ts`). So a required
 * marker there would be a lie, and — worse — would train an editor to paste the English text
 * in by hand, producing exactly the same stored value with none of the traceability.
 */
'use client';
import type { FieldValues, Path } from 'react-hook-form';
import { FormInput, FormTextarea } from '@/common/components/form';

export interface LocaleFieldPairProps<TValues extends FieldValues> {
  /** The human name of the field — "Title", "Description". Suffixed per side. */
  label: string;
  en: Path<TValues>;
  fa: Path<TValues>;
  multiline?: boolean;
  rows?: number;
  /** Marks the ENGLISH side only. The Persian side is never required — see the header. */
  required?: boolean;
  description?: React.ReactNode;
}

export function LocaleFieldPair<TValues extends FieldValues>({
  label,
  en,
  fa,
  multiline = false,
  rows = 3,
  required = false,
  description,
}: LocaleFieldPairProps<TValues>) {
  /**
   * The two branches are written out rather than aliased to one `Control` variable, because
   * `ds/Input` and `ds/Textarea` do NOT share a props shape: Input renders up to three
   * elements so its overrides are `classNames.input`, while Textarea renders one and takes a
   * plain `className`. A single alias would need a cast to paper over that, and a cast here
   * would hide the day one of them gains a prop the other does not have.
   */
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      {/*
        A real `<legend>`, so the pair is announced as a group and the two inputs are heard
        as "Title, English" and "Title, Persian" rather than as two unrelated fields with
        similar names. The visible labels below carry the language; this carries the field.
      */}
      <legend className="mb-1 text-fs-xs tracking-mid-kavan text-t-lo uppercase">
        {label}
        {required && <span className="ms-1 text-danger">*</span>}
      </legend>

      <div className="grid gap-4 md:grid-cols-2">
        {multiline ? (
          <>
            <FormTextarea<TValues>
              name={en}
              label={`${label} · English`}
              required={required}
              rows={rows}
            />
            <FormTextarea<TValues>
              name={fa}
              label={`${label} · Persian`}
              rows={rows}
              dir="rtl"
              lang="fa"
              className="text-end"
            />
          </>
        ) : (
          <>
            <FormInput<TValues> name={en} label={`${label} · English`} required={required} />
            <FormInput<TValues>
              name={fa}
              label={`${label} · Persian`}
              dir="rtl"
              lang="fa"
              classNames={{ input: 'text-end' }}
            />
          </>
        )}
      </div>

      {description && <p className="text-fs-xs tracking-flat-kavan text-t-xlo">{description}</p>}
    </fieldset>
  );
}
