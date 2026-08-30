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
 * ─── ~~THE PERSIAN SIDE IS NEVER MARKED REQUIRED~~ REVERSED IN PROMPT 14 ─────────
 * This header used to argue that a required marker on the Persian side "would be a lie,
 * and — worse — would train an editor to paste the English text in by hand". The first half
 * was TRUE and is why the marker could not simply be added: the schema did not require the
 * field, because `withPersianFallback` filled an empty Persian column with its English
 * counterpart on save.
 *
 * So the FALLBACK went, not the marker. `required` now marks BOTH sides, because the schema
 * requires both sides — `schemas/project-form.ts` and its four siblings — and the second
 * half of the old argument answers itself: an editor who pastes English into a Persian box
 * has made a visible, attributable choice, where the fallback made the identical stored
 * value invisibly and automatically.
 *
 * ─── AND SOME FIELDS ARE REQUIRED ONLY SOMETIMES ──────────────────────────────────
 * `requiredWithImage` names the form path of an image whose DESCRIPTION this pair is. The
 * marker then appears exactly when there is an image in that slot and disappears when there
 * is not, which is precisely what `requireAltWithImage` refuses on — so the label and the
 * schema cannot disagree.
 *
 * It lives here rather than in each of the six forms that mount such a pair for the reason
 * `schemas/image.ts` gives for the rule itself: a condition written six times is a condition
 * that gets it wrong in one of them. `useWatch` on the one path subscribes to that field
 * alone, so typing anywhere else in a sixteen-field form re-renders nothing here.
 */
'use client';
import { useFormContext, useWatch, type FieldValues, type Path } from 'react-hook-form';
import { FormInput, FormTextarea } from '@/common/components/form';

export interface LocaleFieldPairProps<TValues extends FieldValues> {
  /** The human name of the field — "Title", "Description". Suffixed per side. */
  label: string;
  en: Path<TValues>;
  fa: Path<TValues>;
  multiline?: boolean;
  rows?: number;
  /** Marks BOTH sides, because the schema requires both — see the header. */
  required?: boolean;
  /**
   * The form path of an image this pair DESCRIBES, when it describes one.
   *
   * Set it and the pair is required exactly while that path holds an image, matching
   * `requireAltWithImage` in `../schemas/image`. Leave it unset for an ordinary pair.
   */
  requiredWithImage?: Path<TValues>;
  description?: React.ReactNode;
}

export function LocaleFieldPair<TValues extends FieldValues>({
  label,
  en,
  fa,
  multiline = false,
  rows = 3,
  required = false,
  requiredWithImage,
  description,
}: LocaleFieldPairProps<TValues>) {
  const { control } = useFormContext<TValues>();
  /**
   * `useWatch` with a name, never `form.watch()` with none: the latter re-renders the whole
   * form on every keystroke anywhere in it (`references/07-forms.md` §4), and this pair is
   * mounted up to six times on one screen.
   *
   * The hook is called unconditionally with a placeholder name when there is no image path
   * to watch — a hook cannot be called conditionally, and `''` subscribes to nothing.
   */
  const watchedImage = useWatch({
    control,
    name: (requiredWithImage ?? ('' as Path<TValues>)) as Path<TValues>,
  }) as unknown;

  const isRequired =
    required || (requiredWithImage !== undefined && String(watchedImage ?? '').trim() !== '');
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
        {/*
          Decorative here, and deliberately so: this is the GROUP's marker, and both
          controls inside carry their own from `ds/Label`, which pairs the glyph with a real
          `(required)` for a screen reader. Announcing it a third time on the legend would
          have every field read "required" twice.
        */}
        {isRequired && (
          <span aria-hidden="true" className="ms-1 text-danger">
            *
          </span>
        )}
      </legend>

      <div className="grid gap-4 md:grid-cols-2">
        {multiline ? (
          <>
            <FormTextarea<TValues>
              name={en}
              label={`${label} · English`}
              required={isRequired}
              rows={rows}
            />
            <FormTextarea<TValues>
              name={fa}
              label={`${label} · Persian`}
              required={isRequired}
              rows={rows}
              dir="rtl"
              lang="fa"
              className="text-end"
            />
          </>
        ) : (
          <>
            <FormInput<TValues> name={en} label={`${label} · English`} required={isRequired} />
            <FormInput<TValues>
              name={fa}
              label={`${label} · Persian`}
              required={isRequired}
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
