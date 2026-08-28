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
import type { ProjectRow } from '@/common/schemas/project';
import type { TaxonomyTermRow } from '@/common/schemas/taxonomy';
import { withCurrentValues } from '@/common/utils/taxonomy';
import { axisOptions, toControlOptions } from '../lib/taxonomy-options';
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
import { ImageUploadField } from './ImageUploadField';
import { GalleryField } from './GalleryField';
import { FormCheckboxGroup } from './FormCheckboxGroup';
import { DeleteRecordDialog } from './DeleteRecordDialog';

const LIST_PATH = '/dashboard/projects';

export interface ProjectFormProps {
  /** Absent on the create screen. */
  project?: ProjectRow;
  /**
   * Every project term, read from `taxonomy_terms` by the ROUTE and passed in.
   *
   * A prop rather than an import, because this is a `'use client'` component and a client
   * form cannot import a `server-only` service — the same reason `MediaForm` takes its
   * related-project options from the route. It is also what makes a term added a minute ago
   * selectable here with no rebuild: the route reads the table on every request, because
   * nothing under `(dashboard)` is cached.
   */
  terms: readonly TaxonomyTermRow[];
}

export function ProjectForm({ project, terms }: ProjectFormProps) {
  const router = useRouter();
  const editing = project !== undefined;

  /**
   * The record's OWN values are merged into every option list, so a value whose term was
   * retired — or never declared — is still displayed and still saved back unchanged.
   * Without this a select would render blank on it and saving the form would quietly rewrite
   * a field the editor never touched.
   */
  const typeOptions = withCurrentValues(axisOptions(terms, 'type'), project?.types ?? []);
  const statusOptions = withCurrentValues(
    axisOptions(terms, 'status'),
    project ? [project.status] : [],
  );
  const scaleOptions = withCurrentValues(
    axisOptions(terms, 'scale'),
    project ? [project.scale] : [],
  );

  const defaultValues: ProjectFormValues = project
    ? toProjectFormValues(project)
    : {
        ...EMPTY_PROJECT_FORM,
        // The create form opens on the first term of each axis rather than on a blank
        // select. There is no hardcoded first value any more, so "first" means the position
        // the studio put it in.
        status: statusOptions[0]?.value ?? '',
        scale: scaleOptions[0]?.value ?? '',
      };

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
              options={toControlOptions(statusOptions)}
              required
            />
            <FormSelect<ProjectFormValues>
              name="scale"
              label="Scale"
              options={toControlOptions(scaleOptions)}
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
            options={toControlOptions(typeOptions)}
            description="A project can carry more than one. These drive the public filter rail, and the list of them is editable in the taxonomy panel above the project list."
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

        <section className="flex flex-col gap-6 border-t border-rule pt-8">
          <div className="flex flex-col gap-1">
            <h2 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">Photographs</h2>
            <p className="text-fs-xs tracking-flat-kavan text-t-xlo">
              Optional. A project with no cover keeps the drawing generated from its slug, on the
              card and on its page — so leaving this empty is a finished state, not an unfinished
              one. A description is required in both languages for every image you do add: it is
              what a reader who cannot see the photograph gets instead, and the Persian one is not
              filled in from the English, because a Persian screen reader would read out an English
              sentence.
            </p>
          </div>

          <ImageUploadField<ProjectFormValues>
            name="coverImage"
            label="Cover image"
            itemLabel="cover"
            description="Shown on the project card and as the first plate on its page, in place of the generated drawing."
          />

          <LocaleFieldPair<ProjectFormValues>
            label="Cover description"
            en="coverAltEn"
            fa="coverAltFa"
            description="What the photograph shows — read aloud in place of it. Required once there is a cover."
          />

          <GalleryField<ProjectFormValues>
            name="gallery"
            label="Gallery"
            description="Shown after the cover on the project page, in this order. Use the arrows to reorder; the order is saved with the record."
          />
        </section>
      </RecordForm>
    </div>
  );
}
