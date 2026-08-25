// src/modules/dashboard/components/ProjectForm.tsx
/**
 * The project editor. One form, both languages, create and edit.
 *
 * ─── ONE COMPONENT FOR BOTH MODES ─────────────────────────────────────────────────
 * `project` present = edit, absent = create. The two differ in four small ways — which
 * action is called, what the button says, whether it resets to the submitted values, and
 * whether there is a delete control — and all four are props. Two components would be two
 * places to add a field to, and the field would get added to one of them.
 *
 * ─── THE TRANSLATED FIELDS ARE DRIVEN BY A LIST ───────────────────────────────────
 * `PROJECT_LOCALE_FIELDS` in the schema file names the five pairs; this renders one
 * `LocaleFieldPair` each. So adding a translated column to `projects` means adding one entry
 * to that list, and it is structurally impossible to add the English half of a field and
 * forget the Persian one.
 *
 * ─── WHAT HAPPENS AFTER A SAVE ────────────────────────────────────────────────────
 * A create navigates to the new record's edit page: the editor has just typed sixteen fields
 * and the next thing they want is to see that record, not an empty form. An edit stays put
 * and re-baselines — `resetToSubmitted` — so `isDirty` clears without wiping what was saved.
 *
 * A slug change on an edit also navigates, because the URL it is sitting on no longer
 * resolves. Without that the next reload of the page they are looking at is a 404.
 */
'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormInput, FormSelect } from '@/common/components/form';
import { projectScaleValues, projectStatusValues, projectTypeValues } from '@/common/schemas/enums';
import type { ProjectRow } from '@/common/schemas/project';
import {
  createProjectAction,
  deleteProjectAction,
  updateProjectAction,
} from '../actions/project-actions';
import {
  EMPTY_PROJECT_FORM,
  PROJECT_FORM_FIELDS,
  PROJECT_LOCALE_FIELDS,
  projectFormSchema,
  toProjectFormValues,
  type ProjectFormValues,
} from '../schemas/project-form';
import { RecordForm, RecordFormCancel } from './RecordForm';
import { LocaleFieldPair } from './LocaleFieldPair';
import { FormCheckboxGroup } from './FormCheckboxGroup';
import { DeleteRecordDialog } from './DeleteRecordDialog';

const LIST_PATH = '/dashboard/projects';

const toOptions = (values: readonly string[]) => values.map(value => ({ value, label: value }));

export interface ProjectFormProps {
  /** Absent on the create screen. */
  project?: ProjectRow;
}

export function ProjectForm({ project }: ProjectFormProps) {
  const router = useRouter();
  const editing = project !== undefined;

  const defaultValues: ProjectFormValues = project
    ? toProjectFormValues(project)
    : EMPTY_PROJECT_FORM;

  return (
    <div className="flex max-w-[64rem] flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-fs-xl tracking-tight-kavan text-t-hi uppercase">
          {editing ? project.titleEn || project.slug : 'New project'}
        </h1>
        <p className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">
          {editing ? `projects · id ${project.id}` : 'projects · new record'}
        </p>
      </header>

      <RecordForm<ProjectFormValues, { slug: string }>
        // Built HERE, where the schema's concrete type is known — `RecordForm` is generic
        // and cannot construct it. See that component's `resolver` prop.
        resolver={zodResolver(projectFormSchema)}
        defaultValues={defaultValues}
        fields={PROJECT_FORM_FIELDS}
        submitLabel={editing ? 'Save changes' : 'Create project'}
        successMessage={
          editing ? 'Saved. The public site is already showing it.' : 'Project created.'
        }
        // A create form seeded with valid defaults is never `isDirty` until something is
        // typed, so without this the button on an otherwise-valid form would never enable.
        allowPristine={!editing}
        resetToSubmitted={editing}
        onSave={values =>
          editing ? updateProjectAction(project.id, values) : createProjectAction(values)
        }
        onSaved={data => {
          if (!editing) {
            router.replace(`${LIST_PATH}/${data.slug}`);
            router.refresh();
            return;
          }
          // A rename moves the record's URL. Staying put would leave the editor on a path
          // that 404s the moment they reload it.
          if (data.slug !== project.slug) router.replace(`${LIST_PATH}/${data.slug}`);
          router.refresh();
        }}
        actions={
          <>
            <RecordFormCancel>
              <Link href={LIST_PATH}>Cancel</Link>
            </RecordFormCancel>
            {editing && (
              <DeleteRecordDialog
                recordName={project.titleEn || project.slug}
                recordKind="project"
                onConfirm={() => deleteProjectAction(project.id)}
                onDeleted={() => {
                  // The record this page renders is gone, so there is nothing to refresh
                  // into — go back to the list.
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
            <FormInput<ProjectFormValues>
              name="slug"
              label="Slug"
              required
              description={
                editing
                  ? 'Changing this moves the public URL. The old one stops resolving.'
                  : 'Also the seed for this project’s generated drawings.'
              }
              classNames={{ input: 'font-mono' }}
            />
            <FormInput<ProjectFormValues>
              name="year"
              label="Year"
              type="number"
              inputMode="numeric"
              required
            />
            <FormSelect<ProjectFormValues>
              name="status"
              label="Status"
              options={toOptions(projectStatusValues)}
              required
            />
            <FormSelect<ProjectFormValues>
              name="scale"
              label="Scale"
              options={toOptions(projectScaleValues)}
              required
            />
            <FormInput<ProjectFormValues>
              name="area"
              label="Area"
              description="Free text, as it appears on the public page — “1,450 m²”."
            />
          </div>

          <FormCheckboxGroup<ProjectFormValues>
            name="types"
            label="Types"
            required
            options={toOptions(projectTypeValues)}
            description="A project can carry more than one. These drive the public filter rail."
          />
        </section>

        <section className="flex flex-col gap-6 border-t border-rule pt-8">
          <div className="flex flex-col gap-1">
            <h2 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">Content</h2>
            <p className="text-fs-xs tracking-flat-kavan text-t-xlo">
              English on the left, Persian on the right. A Persian field left empty is stored as its
              English counterpart, so the Persian page never renders blank.
            </p>
          </div>

          {PROJECT_LOCALE_FIELDS.map(field => (
            <LocaleFieldPair<ProjectFormValues>
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
      </RecordForm>
    </div>
  );
}
