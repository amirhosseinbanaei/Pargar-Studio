// src/common/errors/types.ts
/**
 * The one error shape every layer converges on, plus the per-call override map.
 *
 * This file must NEVER import a runtime module — it is types only, so it can be imported
 * from a server render, a client component, a proxy/middleware file, or a test without
 * dragging anything into a bundle.
 *
 * The failure it prevents: without a single normalized shape, every toast, every form,
 * and every boundary re-implements its own guess at the backend's error union
 * (`err.response?.data?.detail ?? err.body?.errors?.[0]`). Each guess rots independently,
 * and the day the backend adds a new error shape, only the call sites someone remembered
 * to update display it.
 */

/**
 * Per-field messages, ready for a form `setError` loop: one message per field name.
 *
 * Note the difference from the WIRE shape (`{ email: ["already taken"] }`, an array per
 * field — see `@/common/schemas/envelopes`): this is the flattened, first-message-wins
 * form the UI actually binds. Flattening once, centrally, is what keeps
 * `errors.email?.[0]` out of every component.
 */
export type FieldErrors = Record<string, string>;

/**
 * Any thrown value — a transport error, an error re-thrown after crossing the Server
 * Action boundary, a backend body, a plain `Error`, or an unknown — is mapped to this by
 * `mapError`, so UI and logs branch on one predictable structure.
 */
export interface NormalizedError {
  /** HTTP status when known; `0` for a network/JS failure that never got a response. */
  status: number;
  /** Machine-readable code for branching (from `body.code`), else `null`. */
  code: string | null;
  /** User-facing, localized message — guaranteed non-empty. */
  message: string;
  /** Per-field messages for form binding, keyed by field name. */
  fieldErrors: FieldErrors;
}

/**
 * Per-call message overrides, checked before the default tables.
 *
 * A call site knows things the tables cannot: that a 400 on this particular endpoint
 * means "that address is already taken", or that this endpoint answers in a language
 * your users do not read. Overriding here keeps that knowledge next to the flow instead
 * of polluting the app-wide tables with endpoint-specific copy.
 */
export interface ErrorOverrides {
  byStatus?: Record<number, string>;
  byCode?: Record<string, string>;
}
