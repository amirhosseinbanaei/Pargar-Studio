// src/common/schemas/helpers.ts
/**
 * Leaf-level tolerance helpers for READ schemas.
 *
 * The rule they encode, paid for in outages: **strict about the shape (which keys
 * exist), forgiving about the leaves (what a value holds).** A strict schema on a field
 * the backend can return `null` for takes down the entire page — validation failure is
 * not graceful degradation. The `ZodError` throws inside the service, propagates past
 * every component, and hits the nearest error boundary, so one null in one optional
 * field blanks a route.
 *
 * These must NEVER be used on WRITE payloads. A write body has to be exact: silently
 * turning a null into `''` on the way out overwrites real data with an empty string.
 *
 * Requires zod v4 (`ctx.addIssue({ code: 'custom' })`, `const` type parameters).
 */
import { z } from 'zod';

/**
 * `.nullable()`, deliberately NOT `.nullish()`.
 *
 * `.nullish()` also makes the object key OPTIONAL, which ripples a `?` through every
 * consumer and every write body derived from the schema. These accept a null value and
 * normalize it without changing the key's required-ness.
 */
export const looseString = z
  .string()
  .nullable()
  .transform(v => v ?? '');

export const looseBool = z
  .boolean()
  .nullable()
  .transform(v => v ?? false);

export const looseNumber = z
  .number()
  .nullable()
  .transform(v => v ?? 0);

/**
 * Decimal/money fields, which arrive as a string (`"18.50"`) from many backends to avoid
 * float rounding, sometimes as null, and sometimes with the key absent entirely. Accept
 * all three on read and keep the field OPTIONAL (outermost `.optional()`) so write
 * payloads may still omit it.
 */
export const looseDecimal = z
  .union([z.number(), z.string()])
  .transform(v => (typeof v === 'string' ? Number(v) : v))
  .nullable()
  .optional();

/**
 * Numeric strings from query parameters and form controls.
 *
 * Never use `z.coerce.number()` on wire data: `''`, `null`, `false` and `[]` all coerce
 * to `0`, so a missing total becomes a real-looking zero in a sum nobody questions. The
 * explicit regex rejects those instead.
 */
export const numberFromString = z
  .union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/, 'expected a number')])
  .transform(Number);

/**
 * Backends that use `''` for "unset": collapse both spellings into one absent-value
 * representation, so downstream code has a single emptiness check instead of
 * `value == null || value === ''` repeated everywhere.
 */
export const emptyToNull = z
  .string()
  .nullable()
  .transform(v => (v?.trim() ? v : null));

/**
 * `null` -> `undefined` without making the key optional. Useful when a value feeds an
 * API that distinguishes the two (a controlled input, a query builder that emits
 * `?field=null` for an explicit null).
 */
export const nullToUndefined = <S extends z.ZodTypeAny>(inner: S) =>
  inner.nullable().transform(v => (v === null ? undefined : v));

/**
 * Date string (or an already-parsed `Date`) -> `Date`.
 *
 * Fails LOUDLY rather than tolerantly, unlike its neighbours: `new Date('not a date')`
 * yields an Invalid Date that silently poisons every comparison, sort and format
 * downstream, and surfaces as "NaN" in the UI far from the cause.
 */
export const isoDate = z.union([z.string(), z.date()]).transform((v, ctx) => {
  const parsed = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(parsed.getTime())) {
    ctx.addIssue({ code: 'custom', message: 'invalid date' });
    return z.NEVER;
  }
  return parsed;
});

/**
 * An enum that degrades instead of throwing when the backend ships a value you do not
 * know yet.
 *
 * Adding a status is a routine backend release; without this, that release blanks every
 * list containing one row with the new value. Right for status enums, tags and
 * metadata — never for an identity field, an amount, or a permission flag, where a
 * fallback silently points at the wrong thing.
 */
export function tolerantEnum<const T extends readonly [string, ...string[]]>(
  values: T,
  fallback: T[number],
) {
  return z.enum(values).catch(fallback);
}

/**
 * A JSON-encoded column -> a real array.
 *
 * ADDED IN PROMPT 2. This project's data source is its own libSQL database rather than an
 * HTTP backend, and SQLite has no array type, so list-valued fields (`types`, `team`,
 * `facts`, `socials`…) are stored as TEXT holding a JSON string. This is the boundary that
 * turns that string back into data, and it is the reason nothing downstream ever writes
 * `JSON.parse(row.types) as string[]` — a cast is an unverifiable claim, and a row written
 * by a hand-run SQL statement is exactly the case that breaks it.
 *
 * Tolerant on both failure modes, per the leaf rule above: unparseable JSON and a payload
 * of the wrong shape both degrade to `[]` rather than throwing a `ZodError` that blanks the
 * whole route. An empty facts list costs a table; a thrown parse costs the page.
 *
 * The input is passed through untouched when it is not a string, so an already-decoded
 * array (a test fixture, a write payload) parses identically.
 */
export const jsonArray = <S extends z.ZodTypeAny>(item: S) =>
  z.preprocess(value => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }, z.array(item).catch([]));
