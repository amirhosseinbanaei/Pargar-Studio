// src/modules/dashboard/components/IndexCardForm.tsx
/**
 * One of the five index cards — the words and the picture on a column of the front page.
 *
 * Built from `RecordForm`, `LocaleFieldPair` and `ImageUploadField` exactly as `ProjectForm`
 * is, and shaped like the studio and contact editors: one record, one form, one submit, no
 * create and no delete. The difference from those two is only that there are five of them,
 * each reached at its own URL, because the reader meets them as five separate things.
 *
 * ─── WHAT AN EDITOR CANNOT CHANGE HERE, AND WHY THE FORM SAYS SO ──────────────────
 * The section's id, its URL and its generated drawing are constants in
 * `common/constants/site.ts` and are not on this form. They are referenced by the route
 * tree, by `.col[data-id]` in the ported CSS and by the shell transition, so a save that
 * could change one is a save that could delete a route. The header below states that in
 * one line rather than leaving somebody to wonder where the rest of the fields went.
 *
 * ─── THE FALLBACK IS SHOWN, NOT JUST IMPLEMENTED ──────────────────────────────────
 * Each field's help text names the wording the public page falls back to when it is left
 * empty. Without that the empty state reads as broken — an editor looking at a blank title
 * beside a column that visibly says PROJECTS has no way to know the two are related.
 */
'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import type { IndexCardRow } from '@/common/schemas/index-card';
import { updateIndexCardAction } from '../actions/index-card-actions';
import {
  INDEX_CARD_FORM_FIELDS,
  indexCardFormSchema,
  toIndexCardFormValues,
  type IndexCardFormValues,
} from '../schemas/index-card-form';
import { RecordForm, RecordFormCancel } from './RecordForm';
import { LocaleFieldPair } from './LocaleFieldPair';
import { ImageUploadField } from './ImageUploadField';

const LIST_PATH = '/dashboard/index-cards';

export interface IndexCardFormProps {
  /** One of the five NAV ids. The ROUTE has already refused anything else. */
  sectionId: string;
  /** `null` when this section has no row yet — the first save writes one. */
  card: IndexCardRow | null;
  /** The public path this column leads to, for the header. */
  path: string;
  /** What the column shows today when the card is empty — `nav.<id>` in English. */
  fallbackTitle: string;
  /** `cap.<id>` in English. */
  fallbackCaption: string;
}

export function IndexCardForm({
  sectionId,
  card,
  path,
  fallbackTitle,
  fallbackCaption,
}: IndexCardFormProps) {
  const router = useRouter();

  return (
    <div className="flex max-w-[64rem] flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-fs-xl tracking-tight-kavan text-t-hi uppercase">{fallbackTitle}</h1>
        <p className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">
          index_cards · {sectionId} · one column of the front page
        </p>
        <p className="text-fs-xs tracking-flat-kavan text-t-xlo">
          This edits the words and the picture on the column that leads to{' '}
          <code className="font-mono text-t-md">{path}</code>. The section itself — its id, its URL
          and its generated drawing — is fixed in code, because the route tree and the shell
          transition are built on it.
        </p>
      </header>

      <RecordForm<IndexCardFormValues, void>
        resolver={zodResolver(indexCardFormSchema)}
        defaultValues={toIndexCardFormValues(card)}
        fields={INDEX_CARD_FORM_FIELDS}
        submitLabel="Save changes"
        successMessage="Saved. The front page is already showing it, in both languages."
        resetToSubmitted
        onSave={values => updateIndexCardAction({ ...values, sectionId })}
        onSaved={() => router.refresh()}
        actions={
          <RecordFormCancel>
            <Link href={LIST_PATH}>Back to the five</Link>
          </RecordFormCancel>
        }
      >
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">Words</h2>
            <p className="text-fs-xs tracking-flat-kavan text-t-xlo">
              English on the left, Persian on the right. A Persian field left empty is NOT filled in
              from the English here — unlike everywhere else in this dashboard — because the column
              falls back to its own translated wording instead, which is better Persian than the
              English word would be.
            </p>
          </div>

          <LocaleFieldPair<IndexCardFormValues>
            label="Title"
            en="titleEn"
            fa="titleFa"
            required
            description={`The word on the column. Empty falls back to “${fallbackTitle}”.`}
          />

          <LocaleFieldPair<IndexCardFormValues>
            label="Caption"
            en="captionEn"
            fa="captionFa"
            description={`The line under the title, shown on hover and always on a phone. Empty falls back to “${fallbackCaption}”.`}
          />
        </section>

        <section className="flex flex-col gap-6 border-t border-rule pt-8">
          <div className="flex flex-col gap-1">
            <h2 className="text-fs-xs tracking-mid-kavan text-t-lo uppercase">Picture</h2>
            <p className="text-fs-xs tracking-flat-kavan text-t-xlo">
              Optional. A column with no picture keeps its generated drawing, which is a finished
              state rather than an unfinished one — the drawing is what the front page has always
              shown. A description is required in both languages for a picture you do add: it is
              what a reader who cannot see it gets instead, and the Persian one is not filled in
              from the English, because a Persian screen reader would read out an English sentence.
            </p>
          </div>

          <ImageUploadField<IndexCardFormValues>
            name="coverImage"
            label="Column picture"
            itemLabel="picture"
            description="Fills the whole column behind the title, cropped to it, under the same vignette as the drawing."
          />

          <LocaleFieldPair<IndexCardFormValues>
            label="Picture description"
            en="coverAltEn"
            fa="coverAltFa"
            description="What the photograph shows — read aloud in place of it. Required once there is a picture."
          />
        </section>
      </RecordForm>
    </div>
  );
}
