// src/common/errors/index.ts
/**
 * The public surface of the error system. Everything outside this folder imports
 * `@/common/errors` and nothing deeper, so the internal split (types / parse-body /
 * messages / map-error) can be reorganized without touching a single call site.
 *
 * This barrel must NEVER re-export a module that has side effects or a heavy dependency:
 * it is imported by client components, server renders and the dev logger alike, and a
 * side-effecting import here would run in all of them.
 */
export type { NormalizedError, FieldErrors, ErrorOverrides } from './types';
export { mapError, errorMessage, fieldErrors } from './map-error';
export { parseBody } from './parse-body';
export type { ParsedBody } from './parse-body';
export { DEFAULT_BY_STATUS, DEFAULT_BY_CODE, GENERIC_MESSAGE } from './messages';
