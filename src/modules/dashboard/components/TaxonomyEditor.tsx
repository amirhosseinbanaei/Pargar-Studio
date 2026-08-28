// src/modules/dashboard/components/TaxonomyEditor.tsx
/**
 * THE TERM EDITOR — one component, mounted three times, once per subject.
 *
 * It is what made the taxonomy editable: adding a category, retiring one, changing the order
 * options appear in and changing a Persian label were all code edits and a deploy before
 * prompt 9, from a dashboard that exists so the studio would not need one.
 *
 * ─── ONE COMPONENT, THREE SUBJECTS ────────────────────────────────────────────────
 * `subject` is the only difference between the copy on `/dashboard/projects`, `/dashboard/
 * design` and `/dashboard/media`. Which axes each has comes from `SUBJECT_AXES` in
 * `@/common/schemas/taxonomy` — the same map the write-time check reads — so the editor
 * cannot offer an axis the check would refuse, or miss one it accepts. Three copies of this
 * would be three places to fix one bug, and `index.ts` already lists which pieces exist to be
 * reused rather than copied; this joins them.
 *
 * ─── IT LIVES ON EACH SUBJECT'S OWN PAGE, NOT ON A SETTINGS PAGE ──────────────────
 * Above the record list, collapsed. That placement is the feature: the relationship between
 * a term and the records using it is only visible when they are on one screen, and the
 * question an editor actually has — "can I get rid of this one?" — is answerable here and
 * nowhere else, because the count is right there beside it. A settings area would put the
 * option list a navigation away from the only evidence about it.
 *
 * ─── COLLAPSED BY DEFAULT, AS A `<details>` ───────────────────────────────────────
 * The same pattern `FacetRail.tsx:64` uses, and for the same reason inverted: that rail has
 * one group and nothing below it, so it opens; this page's job is the LIST, and an editor
 * with six axes expanded would push the list off the fold on arrival. `<details>` also needs
 * no state and no JavaScript to do it.
 *
 * ─── EVERY ROW SHOWS ITS USE COUNT ────────────────────────────────────────────────
 * `usage` is counted from the content rows, not from the terms, so it also answers the
 * question the terms cannot: a value some record carries that no term declares shows up as a
 * row here marked "no term", rather than being invisible until somebody wonders why the
 * public rail has an option the editor does not list.
 */
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Checkbox } from '@/common/components/ds';
import { FormInput } from '@/common/components/form';
import {
  AXIS_LABEL,
  SUBJECT_AXES,
  type TaxonomyAxis,
  type TaxonomySubject,
  type TaxonomyTermRow,
} from '@/common/schemas/taxonomy';
import type { TaxonomyUsage } from '@/common/services/taxonomy-service';
import {
  createTaxonomyTermAction,
  deleteTaxonomyTermAction,
  moveTaxonomyTermAction,
  setTaxonomyTermVisibilityAction,
  updateTaxonomyTermAction,
} from '../actions/taxonomy-actions';
import {
  EMPTY_TAXONOMY_TERM,
  type TaxonomyLabelValues,
  TAXONOMY_CREATE_FIELDS,
  TAXONOMY_EDIT_FIELDS,
  taxonomyTermCreateFormSchema,
  taxonomyTermEditFormSchema,
  toTaxonomyTermEditValues,
  type TaxonomyTermCreateFormValues,
  type TaxonomyTermEditFormValues,
} from '../schemas/taxonomy-form';
import { RecordForm } from './RecordForm';
import { DeleteRecordDialog } from './DeleteRecordDialog';
import { RowReorder } from './RowReorder';

export interface TaxonomyEditorProps {
  subject: TaxonomySubject;
  /** Every term for this subject, hidden ones included, in `sortOrder` within each axis. */
  terms: readonly TaxonomyTermRow[];
  /** `usage[axis][value]` — how many content rows carry it. From `getTaxonomyUsage`. */
  usage: TaxonomyUsage;
}

export function TaxonomyEditor({ subject, terms, usage }: TaxonomyEditorProps) {
  const axes = SUBJECT_AXES[subject];
  const total = terms.length;

  return (
    <details className="border border-rule">
      <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-fs-xs tracking-mid-kavan text-t-lo uppercase select-none hover:text-t-hi">
        <span>Taxonomy</span>
        <span className="text-t-xlo normal-case">
          {total} {total === 1 ? 'term' : 'terms'} across {axes.length}{' '}
          {axes.length === 1 ? 'axis' : 'axes'} · the options this subject’s records and the public
          filter rail can use
        </span>
      </summary>

      <div className="flex flex-col gap-10 border-t border-rule px-4 py-6">
        {axes.map(axis => (
          <AxisGroup
            key={axis}
            subject={subject}
            axis={axis}
            terms={terms.filter(term => term.axis === axis)}
            usage={usage[axis] ?? {}}
          />
        ))}
      </div>
    </details>
  );
}

/* ────────────────────────────────────────────────────────────────────────────────
   One axis
   ──────────────────────────────────────────────────────────────────────────────── */

function AxisGroup({
  subject,
  axis,
  terms,
  usage,
}: {
  subject: TaxonomySubject;
  axis: TaxonomyAxis;
  terms: readonly TaxonomyTermRow[];
  usage: Record<string, number>;
}) {
  /**
   * Values some record carries that no term declares.
   *
   * They are shown, not hidden, and that is the editor's half of the degradation the public
   * rails apply: such a value is already rendering on the site and already filtering, so an
   * editor who cannot see it here has no way to explain the option that appears on the rail
   * and no way to give it a Persian label. Listing it makes "declare this properly" a visible
   * next action instead of a mystery.
   */
  const declared = new Set(terms.map(term => term.value));
  const undeclared = Object.entries(usage)
    .filter(([value, count]) => count > 0 && !declared.has(value))
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-fs-xs tracking-mid-kavan text-t-md uppercase">
        {AXIS_LABEL[axis]}
        <span className="ms-2 text-t-xlo normal-case">
          {terms.length} {terms.length === 1 ? 'term' : 'terms'}
        </span>
      </h3>

      <ul className="flex flex-col">
        {terms.map((term, index) => (
          <TermRow
            key={term.id}
            term={term}
            count={usage[term.value] ?? 0}
            canMoveUp={index > 0}
            canMoveDown={index < terms.length - 1}
          />
        ))}

        {terms.length === 0 && (
          <li className="border-t border-rule py-3 text-fs-xs text-t-xlo">
            No terms on this axis yet. Records cannot be saved with a value until one exists.
          </li>
        )}

        {undeclared.map(([value, count]) => (
          <UndeclaredRow key={value} value={value} count={count} />
        ))}
      </ul>

      <CreateTerm subject={subject} axis={axis} />
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────────────
   One term
   ──────────────────────────────────────────────────────────────────────────────── */

function TermRow({
  term,
  count,
  canMoveUp,
  canMoveDown,
}: {
  term: TaxonomyTermRow;
  count: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [visibilityError, setVisibilityError] = useState<string | null>(null);

  const toggleVisible = async (next: boolean) => {
    setVisibilityError(null);
    const result = await setTaxonomyTermVisibilityAction({ id: term.id, visible: next });
    if (result.ok) {
      router.refresh();
      return;
    }
    // Branch on status, never on message text — the rule every failure path here follows.
    setVisibilityError(
      result.status === 401
        ? 'Your session has expired. Reload the page and sign in again.'
        : 'That did not save. Try again.',
    );
  };

  return (
    <li className="flex flex-col gap-3 border-t border-rule py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="min-w-[10rem] flex-1 text-fs-sm tracking-flat-kavan text-t-hi">
          {term.labelEn}
        </span>

        {/*
          The Persian label in its OWN direction and language, exactly as `LocaleFieldPair`
          treats a Persian input: this is a `dir="ltr"` document, so the browser has to be
          told this run is not, and told which language it is so a screen reader switches
          voice. Without `lang` a Persian label is read out by an English synthesiser.
        */}
        <span dir="rtl" lang="fa" className="min-w-[10rem] flex-1 text-fs-sm text-t-md">
          {term.labelFa}
        </span>

        {/*
          The WIRE VALUE, monospaced and visibly distinct from the labels, because it is the
          string the content rows actually store and the one that appears in a URL. It is
          immutable — see the schema — so it is shown, never offered as an input.
        */}
        <code className="min-w-[9rem] flex-1 font-mono text-fs-xs tracking-flat-kavan text-t-lo">
          {term.value}
        </code>

        <span className="w-24 text-fs-xs text-t-xlo tabular-nums">
          {count} {count === 1 ? 'record' : 'records'}
        </span>

        <div className="flex items-center gap-3">
          <Checkbox
            checked={term.visible}
            onCheckedChange={next => void toggleVisible(next === true)}
            // Names the TERM, not just "visible": in a list of eleven, eleven identically
            // named checkboxes are eleven controls nobody navigating by control can tell apart.
            label={<span className="sr-only">{`Show ${term.labelEn} on the site`}</span>}
            aria-label={`Show ${term.labelEn} on the site`}
          />

          <Button variant="ghost" size="sm" onClick={() => setEditing(value => !value)}>
            {editing ? 'Close' : 'Edit'}
          </Button>

          <DeleteRecordDialog
            recordName={term.labelEn}
            recordKind="term"
            onConfirm={() => deleteTaxonomyTermAction(term.id)}
            onDeleted={() => router.refresh()}
            /**
             * THE IN-USE REFUSAL. The action answers 409 with `{ count }` rather than
             * deleting a term records still carry — there is no foreign key, so the database
             * would accept the delete and silently orphan them. This turns that into the
             * sentence that names the number and points at the toggle, which is the
             * non-destructive thing the person wanted: the option off the site, the records
             * intact. Branching on the STATUS and the named key, never on the message.
             */
            resolveRefusal={failure => {
              if (failure.status !== 409) return null;
              const body = failure.body as { count?: number } | undefined;
              const using = body?.count ?? count;
              return `${using} ${using === 1 ? 'record uses' : 'records use'} “${term.value}”, so it cannot be deleted without orphaning them. Clear the “show on site” checkbox instead — that takes the option off the public filter rail and leaves every record reachable.`;
            }}
            trigger={
              <Button variant="ghost" size="sm">
                Delete
              </Button>
            }
          />

          <RowReorder
            onMove={direction => moveTaxonomyTermAction({ id: term.id, direction })}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            recordName={term.labelEn}
          />
        </div>
      </div>

      {visibilityError && (
        <p role="alert" className="text-fs-xs text-danger">
          {visibilityError}
        </p>
      )}

      {editing && (
        <div className="border-s-2 border-rule ps-4">
          {/*
            ONLY THE LABELS. `value` is not editable and is not on this form, because
            renaming it would have to rewrite every content row holding the old string inside
            the same transaction — a partial rename is data corruption behind a green toast.
            The submission schema omits it too, so a crafted POST carrying one is refused
            rather than ignored.
          */}
          <RecordForm<TaxonomyTermEditFormValues, void>
            resolver={zodResolver(taxonomyTermEditFormSchema)}
            defaultValues={toTaxonomyTermEditValues(term)}
            fields={TAXONOMY_EDIT_FIELDS}
            submitLabel="Save labels"
            successMessage="Saved. The public rail is already showing it."
            resetToSubmitted
            onSave={values => updateTaxonomyTermAction({ id: term.id, ...values })}
            onSaved={() => {
              setEditing(false);
              router.refresh();
            }}
          >
            <LabelPair />
          </RecordForm>
        </div>
      )}
    </li>
  );
}

/**
 * A value the records carry that no term declares.
 *
 * It cannot be edited — there is nothing to edit — so the row states the fact and the fix.
 * Adding a term with the same value adopts it: the rail stops falling through to the message
 * catalog and starts using the label, and nothing about the records changes.
 */
function UndeclaredRow({ value, count }: { value: string; count: number }) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule py-3">
      <code className="min-w-[9rem] flex-1 font-mono text-fs-xs tracking-flat-kavan text-t-md">
        {value}
      </code>
      <span className="flex-1 text-fs-xs text-t-xlo">
        No term. Still shown on the site and still filterable, labelled from the message catalog or
        as itself. Add it below to give it labels and a position.
      </span>
      <span className="w-24 text-fs-xs text-t-xlo tabular-nums">
        {count} {count === 1 ? 'record' : 'records'}
      </span>
    </li>
  );
}

/* ────────────────────────────────────────────────────────────────────────────────
   Adding a term
   ──────────────────────────────────────────────────────────────────────────────── */

function CreateTerm({ subject, axis }: { subject: TaxonomySubject; axis: TaxonomyAxis }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          {`Add a ${AXIS_LABEL[axis].toLowerCase()} term`}
        </Button>
      </div>
    );
  }

  return (
    <div className="border border-rule p-4">
      <RecordForm<TaxonomyTermCreateFormValues, { id: number }>
        resolver={zodResolver(taxonomyTermCreateFormSchema)}
        defaultValues={EMPTY_TAXONOMY_TERM}
        fields={TAXONOMY_CREATE_FIELDS}
        submitLabel="Add term"
        successMessage="Added. It is selectable on the record form straight away."
        // A create form seeded with valid defaults is never `isDirty` until something is
        // typed, so without this the button on an otherwise-valid form would never enable.
        allowPristine
        onSave={values => createTaxonomyTermAction({ subject, axis, ...values })}
        onSaved={() => {
          setOpen(false);
          router.refresh();
        }}
        actions={
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        }
      >
        <FormInput<TaxonomyTermCreateFormValues>
          name="value"
          label="Value"
          required
          description="What the records store, and what appears in a filter URL. Capitalized English, spaces allowed — “Interior Design”. It cannot be changed afterwards; the labels can."
          classNames={{ input: 'font-mono' }}
        />
        <LabelPair />
      </RecordForm>
    </div>
  );
}

/**
 * The two labels, side by side, Persian in its own direction.
 *
 * Written out rather than reusing `LocaleFieldPair` because of the one place they differ:
 * that component never marks the Persian side required, and here it IS required. Persian is
 * optional on every content form — an empty column is filled with its English counterpart so
 * a studio is never blocked from publishing — but a term is one word that every Persian rail
 * on the site renders, so the same fallback would quietly put an English word on the Persian
 * page for as long as nobody noticed. See `schemas/taxonomy-form.ts`.
 *
 * Typed against the two fields it actually binds rather than against either whole form.
 * Both form value types include this pair structurally, so the annotation is true in both
 * contexts — and it needs no cast, which a generic over a union of the two would have.
 */
function LabelPair() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormInput<TaxonomyLabelValues> name="labelEn" label="Label · English" required />
      <FormInput<TaxonomyLabelValues>
        name="labelFa"
        label="Label · Persian"
        required
        dir="rtl"
        lang="fa"
        classNames={{ input: 'text-end' }}
      />
    </div>
  );
}
