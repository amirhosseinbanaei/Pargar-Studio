// src/modules/dashboard/components/DesignWorkForm.tsx
/**
 * The design-work editor. One form, both languages, create and edit — same shape as
 * `ProjectForm`, see that component for the reasoning behind the single-component,
 * `project`-present-means-edit design.
 *
 * ─── TEAM AND FACTS ARE NOT `LocaleFieldPair`S ────────────────────────────────────
 * They are array-valued, so each gets its own English/Persian pair of
 * `RepeatableListField` / `RepeatableGroupField` instances laid out the same way
 * `LocaleFieldPair` lays out a scalar pair — English on the left, Persian on the right with
 * `dir="rtl"` and `lang="fa"` on the Persian side only.
 */
'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormInput, FormSelect } from '@/common/components/form';
import { designCategoryValues, designStatusValues } from '@/common/schemas/enums';
import type { DesignWorkRow } from '@/common/schemas/design-work';
import {
  createDesignWorkAction,
  deleteDesignWorkAction,
  updateDesignWorkAction,
} from '../actions/design-work-actions';
import {
  DESIGN_WORK_FORM_FIELDS,
  DESIGN_WORK_LOCALE_FIELDS,
  EMPTY_DESIGN_WORK_FORM,
  designWorkFormSchema,
  toDesignWorkFormValues,
  type DesignWorkFormValues,
} from '../schemas/design-work-form';
import { RecordForm, RecordFormCancel } from './RecordForm';
import { LocaleFieldPair } from './LocaleFieldPair';
import { RepeatableListField } from './RepeatableListField';
import { RepeatableGroupField } from './RepeatableGroupField';
import { DeleteRecordDialog } from './DeleteRecordDialog';

const LIST_PATH = '/dashboard/design';

const toOptions = (values: readonly string[]) => values.map(value => ({ value, label: value }));

const FACT_COLUMNS = [
  { key: 'k', label: 'Key' },
  { key: 'v', label: 'Value' },
] as const;

export interface DesignWorkFormProps {
  /** Absent on the create screen. */
  designWork?: DesignWorkRow;
}

export function DesignWorkForm({ designWork }: DesignWorkFormProps) {
  const router = useRouter();
  const editing = designWork !== undefined;

  const defaultValues: DesignWorkFormValues = designWork
    ? toDesignWorkFormValues(designWork)
    : EMPTY_DESIGN_WORK_FORM;

  return (
    <div className="flex max-w-[64rem] flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-fs-xl tracking-tight-kavan text-t-hi uppercase">
          {editing ? designWork.titleEn || designWork.slug : 'New design work'}
        </h1>
        <p className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">
          {editing ? `design-works · id ${designWork.id}` : 'design-works · new record'}
        </p>
      </header>

      <RecordForm<DesignWorkFormValues, { slug: string }>
        resolver={zodResolver(designWorkFormSchema)}
        defaultValues={defaultValues}
        fields={DESIGN_WORK_FORM_FIELDS}
        submitLabel={editing ? 'Save changes' : 'Create design work'}
        successMessage={
          editing ? 'Saved. The public site is already showing it.' : 'Design work created.'
        }
        allowPristine={!editing}
        resetToSubmitted={editing}
        onSave={values =>
          editing ? updateDesignWorkAction(designWork.id, values) : createDesignWorkAction(values)
        }
        onSaved={data => {
          if (!editing) {
            router.replace(`${LIST_PATH}/${data.slug}`);
            router.refresh();
            return;
          }
          if (data.slug !== designWork.slug) router.replace(`${LIST_PATH}/${data.slug}`);
          router.refresh();
        }}
        actions={
          <>
            <RecordFormCancel>
              <Link href={LIST_PATH}>Cancel</Link>
            </RecordFormCancel>
            {editing && (
              <DeleteRecordDialog
                recordName={designWork.titleEn || designWork.slug}
                recordKind="design work"
                onConfirm={() => deleteDesignWorkAction(designWork.id)}
                onDeleted={() => {
                  router.replace(LIST_PATH);
                  router.refresh();
                }}
              />
            )}
          </>
        }
      >
        <section className="flex flex-col gap-5">
          <h2 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">Record</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <FormInput<DesignWorkFormValues>
              name="slug"
              label="Slug"
              required
              description={
                editing
                  ? 'Changing this moves the public URL. The old one stops resolving.'
                  : undefined
              }
              classNames={{ input: 'font-mono' }}
            />
            <FormInput<DesignWorkFormValues>
              name="year"
              label="Year"
              type="number"
              inputMode="numeric"
              required
            />
            <FormSelect<DesignWorkFormValues>
              name="category"
              label="Category"
              options={toOptions(designCategoryValues)}
              required
            />
            <FormSelect<DesignWorkFormValues>
              name="status"
              label="Status"
              options={toOptions(designStatusValues)}
              required
            />
          </div>
        </section>

        <section className="flex flex-col gap-6 border-t border-rule pt-8">
          <div className="flex flex-col gap-1">
            <h2 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">Content</h2>
            <p className="text-fs-xs tracking-flat-kavan text-t-xlo">
              English on the left, Persian on the right. A Persian field left empty is stored as its
              English counterpart, so the Persian page never renders blank.
            </p>
          </div>

          {DESIGN_WORK_LOCALE_FIELDS.map(field => (
            <LocaleFieldPair<DesignWorkFormValues>
              key={field.en}
              label={field.label}
              en={field.en}
              fa={field.fa}
              multiline={field.multiline}
              rows={'rows' in field ? field.rows : undefined}
              required={'required' in field ? field.required : false}
            />
          ))}
        </section>

        <section className="flex flex-col gap-6 border-t border-rule pt-8">
          <h2 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">Team</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <RepeatableListField<DesignWorkFormValues>
              name="teamEn"
              label="Team · English"
              itemLabel="Team member"
            />
            <RepeatableListField<DesignWorkFormValues>
              name="teamFa"
              label="Team · Persian"
              itemLabel="Team member"
              dir="rtl"
              lang="fa"
            />
          </div>
        </section>

        <section className="flex flex-col gap-6 border-t border-rule pt-8">
          <h2 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">Facts</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <RepeatableGroupField<DesignWorkFormValues>
              name="factsEn"
              label="Facts · English"
              columns={FACT_COLUMNS}
              emptyRow={{ k: '', v: '' }}
              itemLabel="Fact"
            />
            <RepeatableGroupField<DesignWorkFormValues>
              name="factsFa"
              label="Facts · Persian"
              columns={FACT_COLUMNS}
              emptyRow={{ k: '', v: '' }}
              itemLabel="Fact"
              dir="rtl"
              lang="fa"
            />
          </div>
        </section>
      </RecordForm>
    </div>
  );
}
