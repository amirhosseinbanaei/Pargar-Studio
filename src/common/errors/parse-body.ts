// src/common/errors/parse-body.ts
/**
 * Tolerant parsing of a backend error body into the four pieces `mapError` needs.
 *
 * This file must NEVER produce user-facing copy and must NEVER throw: it is handed the
 * least trustworthy bytes in the system (an HTML proxy page, a truncated stream, a
 * string, `undefined`) and has to return something usable for all of them.
 *
 * It understands the shapes most REST backends emit — several frameworks (Django REST
 * Framework, Laravel, pydantic-based stacks, and many hand-rolled APIs) converge on
 * these, and an app that talks to more than one backend meets all of them:
 *   - `{ detail: "..." }`                  -> a single message
 *   - `{ error: "..." }` / `{ message: "..." }` -> the same, other spellings
 *   - `{ non_field_errors: ["..."] }`      -> form-level validation
 *   - `{ email: ["already taken"], ... }`  -> per-field validation
 *   - `{ code: "already_registered" }`     -> a machine code, the only safe branch key
 *   - a bare string                        -> treated as `detail`
 *
 * The failure it prevents: treating every key of the body as a field error. An envelope
 * key like `error` then becomes a phantom field that (a) pollutes form `setError` loops
 * with a field the UI does not render, so the message can never be seen or cleared, and
 * (b) outranks the status default in the message chain, leaking a raw, untranslated
 * backend string to the user.
 */

export interface ParsedBody {
  code: string | null;
  detail: string | null;
  nonFieldErrors: string[];
  fieldErrors: Record<string, string>;
}

/**
 * This app's form-level validation key.
 *
 * There is no REST backend to match: every validation error in this project originates in
 * a zod parse inside a Server Action, and zod 4's `z.flattenError()` emits
 * `{ formErrors: string[], fieldErrors: {...} }`. Matching that spelling means an action
 * can hand its flattened error straight to `mapError` with no adapter in between.
 */
const NON_FIELD_KEY = 'formErrors';

/**
 * Keys that carry meta, not per-field validation, so they never become field errors.
 * They are folded into `detail` instead, which keeps a genuine backend message reachable
 * while ranking it below any explicit per-call override.
 *
 * `NON_FIELD_KEY` is included by reference, not spelled twice: renaming it in one place
 * only would silently turn form-level errors back into a phantom field.
 *
 * `fieldErrors` and `issues` are this project's additions: they are the other two keys of
 * a flattened / raw zod error. Without reserving them, a zod error object handed to
 * `mapError` would produce phantom fields literally named "fieldErrors" and "issues",
 * which no form renders — so the real message could never be seen or cleared.
 *
 * The rule that matters when adding to this set: any key that is not a real form field
 * must be reserved.
 */
const RESERVED_KEYS = new Set([
  'detail',
  'code',
  'message',
  'error',
  'fieldErrors',
  'issues',
  NON_FIELD_KEY,
]);

const EMPTY: ParsedBody = { code: null, detail: null, nonFieldErrors: [], fieldErrors: {} };

/** First usable string from a value that may be a string or an array of strings. */
function firstString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() ? value : null;
  if (Array.isArray(value)) {
    const found = value.find((v): v is string => typeof v === 'string' && v.trim().length > 0);
    return found ?? null;
  }
  return null;
}

export function parseBody(body: unknown): ParsedBody {
  if (body == null) return { ...EMPTY };
  // A plain-text or HTML error body (a gateway page, a stack trace) still carries the
  // only information available; treat it as the detail rather than discarding it.
  if (typeof body === 'string') return { ...EMPTY, detail: body.trim() ? body : null };
  if (typeof body !== 'object') return { ...EMPTY };

  const obj = body as Record<string, unknown>;

  const code = typeof obj.code === 'string' ? obj.code : null;
  const detail = firstString(obj.detail) ?? firstString(obj.error) ?? firstString(obj.message);
  const rawNonField = obj[NON_FIELD_KEY];
  const nonFieldErrors = Array.isArray(rawNonField)
    ? rawNonField.filter((v): v is string => typeof v === 'string')
    : [];

  const fieldErrors: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (RESERVED_KEYS.has(key)) continue;
    const message = firstString(value);
    if (message) fieldErrors[key] = message;
  }

  return { code, detail, nonFieldErrors, fieldErrors };
}
