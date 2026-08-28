// src/modules/dashboard/index.ts
/**
 * THE DASHBOARD MODULE — the authenticated side of the app, and the only module that WRITES.
 *
 * This barrel is the module's entire public API. `app/` imports from here and never one level
 * deeper; a deep import would make every internal file de-facto public, so renaming a
 * component would become a repo-wide diff. The rule is machine-enforced —
 * `eslint.config.mjs` bans deep module specifiers from `src/app/**`, and `dashboard` went
 * into its `MODULES` array before this folder existed.
 *
 * ─── WHAT PROMPT 7 REUSES ─────────────────────────────────────────────────────────
 * Prompt 7 repeats this CRUD pattern for design, media, studio, contact and messages. These
 * five pieces are the ones written to be reused rather than copied, and each of them is the
 * answer to a question every one of those screens will ask:
 *
 *  - `RecordForm` — the form scaffold. Owns the submit lifecycle, the 401/422/404 branching,
 *    the binding of an `ActionResult`'s `fieldErrors` onto inputs, and the focus move. A new
 *    editor is a schema, a resolver, some fields and one `onSave`.
 *  - `RecordTable` + `sortRows` + `parseSortState` — the list table with URL-driven sorting.
 *  - `DeleteRecordDialog` — the confirmation, which names the record and keeps itself open on
 *    a failure.
 *  - `ResultRegion` — the inline outcome region, rendering the ONE normalized error shape.
 *  - `LocaleFieldPair` — English and Persian side by side. Every one of the five remaining
 *    areas has translated columns, so every one of them needs this.
 *
 * Prompt 9 added a sixth, `TaxonomyEditor`, on the same rule: three subjects need the same
 * term editor, and three copies would be three places to fix one bug.
 *
 * `FormCheckboxGroup` is deliberately NOT in that list: it has one consumer, and
 * `references/01-layering-and-boundaries.md` promotes on the second. If prompt 7 finds a
 * second, it moves to `common/components/form/` rather than being exported from here.
 *
 * ─── WHAT IS NOT HERE ─────────────────────────────────────────────────────────────
 *  - No database access and no query building. Everything comes from
 *    `@/common/services/project-service`, which the ROUTE calls and passes down.
 *  - No session cookie handling. `@/common/services/session` is the only module that touches
 *    it; the actions here call `readSession()` and nothing lower.
 *  - No cache tag literals. They come from `@/common/services/cache-tags`.
 */

/* ── The shell ─────────────────────────────────────────────────────────────────── */
export { DashboardShell, type DashboardShellProps } from './components/DashboardShell';
export { DashboardOverview, type DashboardOverviewProps } from './components/DashboardOverview';
export { LoginForm, type LoginFormProps } from './components/LoginForm';

/* ── Reusable CRUD pieces (prompt 7) ───────────────────────────────────────────── */
export { RecordForm, RecordFormCancel, type RecordFormProps } from './components/RecordForm';
export {
  RecordTable,
  parseSortState,
  sortRows,
  type RecordTableColumn,
  type RecordTableProps,
  type SortDirection,
  type SortState,
} from './components/RecordTable';
export { DeleteRecordDialog, type DeleteRecordDialogProps } from './components/DeleteRecordDialog';
export { ResultRegion, type ResultRegionProps } from './components/ResultRegion';
export { LocaleFieldPair, type LocaleFieldPairProps } from './components/LocaleFieldPair';
export { RowReorder, type RowReorderProps } from './components/RowReorder';
export {
  RepeatableListField,
  type RepeatableListFieldProps,
} from './components/RepeatableListField';
export {
  RepeatableGroupField,
  type RepeatableGroupColumn,
  type RepeatableGroupFieldProps,
} from './components/RepeatableGroupField';
/**
 * The term editor (prompt 9). ONE component, mounted three times with a different `subject`
 * — on `/dashboard/projects`, `/dashboard/design` and `/dashboard/media`, above each list.
 * It is on each subject's own page rather than on a settings page because that is what makes
 * the relationship between a term and the records using it visible, and what makes "can I
 * delete this?" answerable without leaving the screen.
 */
export { TaxonomyEditor, type TaxonomyEditorProps } from './components/TaxonomyEditor';

/* ── Projects ──────────────────────────────────────────────────────────────────── */
export { ProjectListScreen, type ProjectListScreenProps } from './components/ProjectListScreen';
export { ProjectForm, type ProjectFormProps } from './components/ProjectForm';

/* ── Design ────────────────────────────────────────────────────────────────────── */
export {
  DesignWorkListScreen,
  type DesignWorkListScreenProps,
} from './components/DesignWorkListScreen';
export { DesignWorkForm, type DesignWorkFormProps } from './components/DesignWorkForm';

/* ── Media ─────────────────────────────────────────────────────────────────────── */
export { MediaListScreen, type MediaListScreenProps } from './components/MediaListScreen';
export { MediaForm, type MediaFormProps, type MediaProjectOption } from './components/MediaForm';

/* ── Studio ────────────────────────────────────────────────────────────────────── */
export { StudioForm, type StudioFormProps } from './components/StudioForm';

/* ── Contact ───────────────────────────────────────────────────────────────────── */
export { ContactForm, type ContactFormProps } from './components/ContactForm';

/* ── Messages ──────────────────────────────────────────────────────────────────── */
export { MessageListScreen, type MessageListScreenProps } from './components/MessageListScreen';
export {
  MessageDetailScreen,
  type MessageDetailScreenProps,
} from './components/MessageDetailScreen';

/* ── The page-level gate ───────────────────────────────────────────────────────── */
/**
 * Called at the TOP of every dashboard page, before its service call. The layout's check
 * gates the CHROME; this one gates the FETCH, and only the second stops a page's rows
 * reaching the RSC payload of a request whose session turned out to be invalid — a layout
 * and its page render concurrently. See the file for the reproduction.
 */
export { requireDashboardSession } from './lib/require-session';

/* ── Areas ─────────────────────────────────────────────────────────────────────── */
export { DASHBOARD_AREAS, areaHref, currentArea, type DashboardArea } from './lib/areas';

/* ── Actions ───────────────────────────────────────────────────────────────────── */
export { loginAction, logoutAction, type LoginSuccess } from './actions/session-actions';
export {
  createProjectAction,
  deleteProjectAction,
  moveProjectAction,
  updateProjectAction,
} from './actions/project-actions';
export {
  createDesignWorkAction,
  deleteDesignWorkAction,
  moveDesignWorkAction,
  updateDesignWorkAction,
} from './actions/design-work-actions';
export {
  createMediaAction,
  deleteMediaAction,
  moveMediaAction,
  updateMediaAction,
} from './actions/media-actions';
export {
  createTaxonomyTermAction,
  deleteTaxonomyTermAction,
  moveTaxonomyTermAction,
  setTaxonomyTermVisibilityAction,
  updateTaxonomyTermAction,
} from './actions/taxonomy-actions';
export { updateStudioAction } from './actions/studio-actions';
export { updateContactAction } from './actions/contact-actions';
export {
  deleteContactMessageAction,
  markContactMessageReadAction,
} from './actions/contact-message-actions';

/* ── Query parsing, for the list route ─────────────────────────────────────────── */
export {
  filterProjectRows,
  hasAnyProjectFilter,
  parseProjectListQuery,
  projectListFacets,
  projectListHref,
  PROJECT_FILTER_KEYS,
  type ProjectFilterKey,
  type ProjectListQuery,
  type RawSearchParams,
} from './lib/project-list';
