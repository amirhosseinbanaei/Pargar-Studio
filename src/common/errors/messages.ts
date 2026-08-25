// src/common/errors/messages.ts
/**
 * The default user-facing error copy, and the app's ONLY localization seam for it.
 *
 * These tables must NEVER be bypassed by a component hardcoding "Something went wrong":
 * hardcoded copy is invisible to translation and to copy review, and drifts into five
 * slightly different sentences across five screens.
 *
 * The failure it prevents: an empty or untranslated error. `GENERIC_MESSAGE` is the
 * unconditional last rung of the precedence chain in `mapError`, which is what guarantees
 * no UI ever renders "Error: " or an empty toast.
 *
 * LOCALIZATION SEAM — THIS PROJECT'S DECISION, since the site itself is bilingual:
 * these tables stay ENGLISH LITERALS, because their only reader is the admin dashboard
 * (prompt 6), which is single-admin and English-only. The PUBLIC site's copy — including
 * anything a visitor could see fail — is resolved through the bilingual content layer
 * ported in prompt 4, not through this file. If a visitor-facing surface ever renders a
 * `mapError` message, convert these values to message keys and give `mapError` a locale
 * argument, per the generic guidance below.
 *
 * Generic guidance:
 *  - Single-locale app: keep these as literals, written in YOUR app's language. They are
 *    in English here only because this template has to pick one.
 *  - Multi-locale app: make the values message KEYS resolved by your i18n runtime, and
 *    give `mapError` a locale argument. Do not localize inside call sites — that is how
 *    the seam is lost.
 *  - Backend strings are already-localized-or-not and you cannot tell from the outside.
 *    That is exactly why backend-derived messages rank BELOW per-call overrides in
 *    `mapError`: a call site that knows the endpoint answers in the wrong language pins
 *    a `byStatus` override and wins.
 */

/** Keyed by HTTP status. `0` means "no response at all" (network, timeout, JS throw). */
export const DEFAULT_BY_STATUS: Record<number, string> = {
  0: 'Network error. Check your connection.',
  400: 'The submitted data is not valid.',
  401: 'Please sign in to continue.',
  403: 'You do not have permission to do that.',
  404: 'Not found.',
  409: 'That item already exists.',
  422: 'The submitted data is not valid.',
  429: 'Too many requests. Try again shortly.',
  500: 'Server error. Please try again.',
  503: 'The service is temporarily unavailable. Please try again.',
};

/**
 * Keyed by a custom error `code` — the highest-priority default, because a code is the
 * only part of an error body that is stable enough to attach meaning to.
 *
 * EMPTY ON PURPOSE, and that is the decision rather than an unfinished list. A code earns
 * a row here when SEVERAL call sites need the same sentence for it; a code with one call
 * site belongs in that call site's `overrides.byCode`, where the copy sits next to the
 * flow it describes. Nothing in this app has a second call site yet — the dashboard's
 * write actions (prompt 6) are the first place codes get emitted, and the row is added
 * then, with the second consumer.
 */
export const DEFAULT_BY_CODE: Record<string, string> = {};

/** Absolute fallback when nothing else resolves — never returned empty. */
export const GENERIC_MESSAGE = 'Something went wrong. Please try again.';
