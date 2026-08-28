// src/modules/dashboard/components/StudioForm.tsx
/**
 * The studio editor. One row, one form, one submit — see `schemas/studio-form.ts` for why
 * there is no create and no delete here.
 */
'use client';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import type { StudioRow } from '@/common/schemas/studio';
import { updateStudioAction } from '../actions/studio-actions';
import {
  STUDIO_FORM_FIELDS,
  studioFormSchema,
  toStudioFormValues,
  type StudioFormValues,
} from '../schemas/studio-form';
import { RecordForm } from './RecordForm';
import { LocaleFieldPair } from './LocaleFieldPair';
import { RepeatableListField } from './RepeatableListField';
import { RepeatableGroupField } from './RepeatableGroupField';

/**
 * `imageAlt` is a column on BOTH sides; the PORTRAIT itself is not.
 *
 * A founder's photograph is one fact and their description of it is two — so the uploader is
 * rendered on the English editor only (`imageKey` below) and the path is copied into the
 * Persian array by index on save. The alt text is a genuine column here because it is heard
 * in the reader's own language, and it is the one translated field in this codebase that is
 * deliberately NOT filled in from English when it is left blank: see
 * `../schemas/image.ts`'s header.
 */
const FOUNDER_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'born', label: 'Born' },
  { key: 'bio', label: 'Bio', multiline: true },
  { key: 'imageAlt', label: 'Portrait description' },
] as const;

/** Every key the schema requires, so an appended founder is a complete row. */
const EMPTY_FOUNDER = { name: '', role: '', born: '', bio: '', image: '', imageAlt: '' };

const STAT_COLUMNS = [
  { key: 'label', label: 'Label' },
  { key: 'value', label: 'Value' },
] as const;

const AWARD_COLUMNS = [
  { key: 'year', label: 'Year' },
  { key: 'title', label: 'Title' },
  { key: 'project', label: 'Project' },
  { key: 'body', label: 'Body', multiline: true },
] as const;

const CHAPTER_COLUMNS = [
  { key: 'year', label: 'Year' },
  { key: 'text', label: 'Text', multiline: true },
] as const;

export interface StudioFormProps {
  studio: StudioRow;
}

export function StudioForm({ studio }: StudioFormProps) {
  const router = useRouter();

  return (
    <div className="flex max-w-[64rem] flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-fs-xl tracking-tight-kavan text-t-hi uppercase">Studio</h1>
        <p className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">
          studio · one record, saved as a whole
        </p>
      </header>

      <RecordForm<StudioFormValues, void>
        resolver={zodResolver(studioFormSchema)}
        defaultValues={toStudioFormValues(studio)}
        fields={STUDIO_FORM_FIELDS}
        submitLabel="Save changes"
        successMessage="Saved. /studio is already showing it, in both languages."
        resetToSubmitted
        onSave={values => updateStudioAction(values)}
        onSaved={() => router.refresh()}
      >
        <section className="flex flex-col gap-6">
          <h2 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">Manifesto</h2>
          <LocaleFieldPair<StudioFormValues>
            label="Manifesto"
            en="manifestoEn"
            fa="manifestoFa"
            multiline
            rows={6}
          />
        </section>

        <section className="flex flex-col gap-6 border-t border-rule pt-8">
          <h2 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">Founders</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <RepeatableGroupField<StudioFormValues>
              name="foundersEn"
              label="Founders · English"
              columns={FOUNDER_COLUMNS}
              emptyRow={EMPTY_FOUNDER}
              itemLabel="Founder"
              // The uploader lives on this side only — see FOUNDER_COLUMNS above.
              imageKey="image"
              imageLabel="Portrait"
              description="A founder with no portrait keeps the generated one, drawn from their English name."
            />
            <RepeatableGroupField<StudioFormValues>
              name="foundersFa"
              label="Founders · Persian"
              columns={FOUNDER_COLUMNS}
              emptyRow={EMPTY_FOUNDER}
              itemLabel="Founder"
              dir="rtl"
              lang="fa"
            />
          </div>
        </section>

        <section className="flex flex-col gap-6 border-t border-rule pt-8">
          <h2 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">Stats</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <RepeatableGroupField<StudioFormValues>
              name="statsEn"
              label="Stats · English"
              columns={STAT_COLUMNS}
              emptyRow={{ label: '', value: '' }}
              itemLabel="Stat"
            />
            <RepeatableGroupField<StudioFormValues>
              name="statsFa"
              label="Stats · Persian"
              columns={STAT_COLUMNS}
              emptyRow={{ label: '', value: '' }}
              itemLabel="Stat"
              dir="rtl"
              lang="fa"
            />
          </div>
        </section>

        <section className="flex flex-col gap-6 border-t border-rule pt-8">
          <h2 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">Team</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <RepeatableListField<StudioFormValues>
              name="teamEn"
              label="Team · English"
              itemLabel="Team member"
            />
            <RepeatableListField<StudioFormValues>
              name="teamFa"
              label="Team · Persian"
              itemLabel="Team member"
              dir="rtl"
              lang="fa"
            />
          </div>
        </section>

        <section className="flex flex-col gap-6 border-t border-rule pt-8">
          <h2 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">Alumni</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <RepeatableListField<StudioFormValues>
              name="alumniEn"
              label="Alumni · English"
              itemLabel="Alumnus"
            />
            <RepeatableListField<StudioFormValues>
              name="alumniFa"
              label="Alumni · Persian"
              itemLabel="Alumnus"
              dir="rtl"
              lang="fa"
            />
          </div>
        </section>

        <section className="flex flex-col gap-6 border-t border-rule pt-8">
          <h2 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">Awards</h2>
          <p className="text-fs-xs tracking-flat-kavan text-t-xlo">
            Rendered on the public page in this order — the first row here is the first award shown.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <RepeatableGroupField<StudioFormValues>
              name="awardsEn"
              label="Awards · English"
              columns={AWARD_COLUMNS}
              emptyRow={{ year: '', title: '', project: '', body: '' }}
              itemLabel="Award"
            />
            <RepeatableGroupField<StudioFormValues>
              name="awardsFa"
              label="Awards · Persian"
              columns={AWARD_COLUMNS}
              emptyRow={{ year: '', title: '', project: '', body: '' }}
              itemLabel="Award"
              dir="rtl"
              lang="fa"
            />
          </div>
        </section>

        <section className="flex flex-col gap-6 border-t border-rule pt-8">
          <h2 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">Chapters</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <RepeatableGroupField<StudioFormValues>
              name="chaptersEn"
              label="Chapters · English"
              columns={CHAPTER_COLUMNS}
              emptyRow={{ year: '', text: '' }}
              itemLabel="Chapter"
            />
            <RepeatableGroupField<StudioFormValues>
              name="chaptersFa"
              label="Chapters · Persian"
              columns={CHAPTER_COLUMNS}
              emptyRow={{ year: '', text: '' }}
              itemLabel="Chapter"
              dir="rtl"
              lang="fa"
            />
          </div>
        </section>
      </RecordForm>
    </div>
  );
}
