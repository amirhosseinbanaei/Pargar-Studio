// src/modules/dashboard/components/MediaForm.tsx
/**
 * The media editor. One form, both languages, create and edit — same shape as
 * `DesignWorkForm`, with one addition: the related-project field.
 *
 * ─── `projectOptions` IS A PROP, NOT A FETCH ──────────────────────────────────────
 * This is a `'use client'` form and `project-service` is `server-only`, so the options
 * cannot be read here. The owning ROUTE — a Server Component — calls `listProjectRows()`
 * once and passes the (slug, title) pairs down. See `schemas/media-form.ts` for why the
 * field is a select at all.
 */
'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormInput, FormSelect } from '@/common/components/form';
import type { TaxonomyTermRow } from '@/common/schemas/taxonomy';
import { withCurrentValues } from '@/common/utils/taxonomy';
import { axisOptions, toControlOptions } from '../lib/taxonomy-options';
import type { MediaRow } from '@/common/schemas/media';
import { createMediaAction, deleteMediaAction, updateMediaAction } from '../actions/media-actions';
import {
  EMPTY_MEDIA_FORM,
  MEDIA_FORM_FIELDS,
  MEDIA_LOCALE_FIELDS,
  NO_RELATED_PROJECT,
  mediaFormSchema,
  toMediaFormValues,
  type MediaFormValues,
} from '../schemas/media-form';
import { RecordForm, RecordFormCancel } from './RecordForm';
import { LocaleFieldPair } from './LocaleFieldPair';
import { ImageUploadField } from './ImageUploadField';
import { GalleryField } from './GalleryField';
import { RepeatableGroupField } from './RepeatableGroupField';
import { DeleteRecordDialog } from './DeleteRecordDialog';

const LIST_PATH = '/dashboard/media';

const FACT_COLUMNS = [
  { key: 'k', label: 'Key' },
  { key: 'v', label: 'Value' },
] as const;

export interface MediaProjectOption {
  slug: string;
  titleEn: string;
}

export interface MediaFormProps {
  /** Absent on the create screen. */
  media?: MediaRow;
  projectOptions: readonly MediaProjectOption[];
  /**
   * Every media term, read from `taxonomy_terms` by the ROUTE and passed in — a client form
   * cannot import a `server-only` service. See `ProjectForm` for the full note.
   */
  terms: readonly TaxonomyTermRow[];
}

export function MediaForm({ media, projectOptions, terms }: MediaFormProps) {
  const router = useRouter();
  const editing = media !== undefined;

  // The record's own value is merged in — see `ProjectForm`.
  const typeOptions = withCurrentValues(axisOptions(terms, 'type'), media ? [media.type] : []);

  const defaultValues: MediaFormValues = media
    ? toMediaFormValues(media)
    : { ...EMPTY_MEDIA_FORM, type: typeOptions[0]?.value ?? '' };

  const relatedProjectOptions = [
    { value: NO_RELATED_PROJECT, label: '— No related project —' },
    ...projectOptions.map(project => ({
      value: project.slug,
      label: project.titleEn || project.slug,
    })),
  ];

  return (
    <div className="flex max-w-[64rem] flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-fs-xl tracking-tight-kavan text-t-hi uppercase">
          {editing ? media.titleEn || media.slug : 'New media entry'}
        </h1>
        <p className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">
          {editing ? `media · id ${media.id}` : 'media · new record'}
        </p>
      </header>

      <RecordForm<MediaFormValues, { slug: string }>
        resolver={zodResolver(mediaFormSchema)}
        defaultValues={defaultValues}
        fields={MEDIA_FORM_FIELDS}
        submitLabel={editing ? 'Save changes' : 'Create media entry'}
        successMessage={
          editing ? 'Saved. The public site is already showing it.' : 'Media entry created.'
        }
        allowPristine={!editing}
        resetToSubmitted={editing}
        onSave={values =>
          editing ? updateMediaAction(media.id, values) : createMediaAction(values)
        }
        onSaved={data => {
          if (!editing) {
            router.replace(`${LIST_PATH}/${data.slug}`);
            router.refresh();
            return;
          }
          if (data.slug !== media.slug) router.replace(`${LIST_PATH}/${data.slug}`);
          router.refresh();
        }}
        actions={
          <>
            <RecordFormCancel>
              <Link href={LIST_PATH}>Cancel</Link>
            </RecordFormCancel>
            {editing && (
              <DeleteRecordDialog
                recordName={media.titleEn || media.slug}
                recordKind="media entry"
                onConfirm={() => deleteMediaAction(media.id)}
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
            <FormInput<MediaFormValues>
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
            <FormInput<MediaFormValues>
              name="year"
              label="Year"
              type="number"
              inputMode="numeric"
              required
            />
            <FormSelect<MediaFormValues>
              name="type"
              label="Type"
              options={toControlOptions(typeOptions)}
              required
            />
            <FormSelect<MediaFormValues>
              name="projectSlug"
              label="Related project"
              options={relatedProjectOptions}
              description="Not every entry is about a project — awards and lectures often have none."
            />
          </div>
        </section>

        <section className="flex flex-col gap-6 border-t border-rule pt-8">
          <div className="flex flex-col gap-1">
            <h2 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">Content</h2>
            <p className="text-fs-xs tracking-flat-kavan text-t-xlo">
              English on the left, Persian on the right. A field marked with an asterisk is required
              in BOTH languages: since prompt 14 an empty Persian field is a refusal, not a silent
              copy of the English one.
            </p>
          </div>

          {MEDIA_LOCALE_FIELDS.map(field => (
            <LocaleFieldPair<MediaFormValues>
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
              Optional, and empty is a normal state — an entry with no photographs simply shows
              none. A cover and a gallery, the same as a project: an exhibition or a lecture is
              photographed like anything else. A description is required in both languages for every
              image you add.
            </p>
          </div>

          <ImageUploadField<MediaFormValues>
            name="coverImage"
            label="Cover image"
            itemLabel="cover"
            description="Shown on the card and as the first plate on this entry's page."
          />

          <LocaleFieldPair<MediaFormValues>
            label="Cover description"
            en="coverAltEn"
            fa="coverAltFa"
            requiredWithImage="coverImage"
            description="What the image shows. Required once there is a cover."
          />

          <GalleryField<MediaFormValues>
            name="gallery"
            label="Gallery"
            description="Shown after the cover on the public page, in this order. Drag a row by its handle to reorder — or focus the handle and use the arrow keys. The order is saved with the record."
          />
        </section>

        <section className="flex flex-col gap-6 border-t border-rule pt-8">
          <h2 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">Facts</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <RepeatableGroupField<MediaFormValues>
              name="factsEn"
              label="Facts · English"
              columns={FACT_COLUMNS}
              emptyRow={{ k: '', v: '' }}
              itemLabel="Fact"
            />
            <RepeatableGroupField<MediaFormValues>
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
