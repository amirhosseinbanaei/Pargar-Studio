// src/common/schemas/envelopes.ts
/**
 * The backend's shared response wrappers, modelled ONCE as generic factories.
 *
 * An envelope is a transport accident, not a domain concept. It must NEVER leak past the
 * service that unwraps it: if it does, every component learns `.data.results[0]`, and the
 * day one endpoint returns its payload bare you rewrite twenty call sites instead of one
 * function.
 *
 * The failure it prevents: hand-writing `z.object({ message, data: invoiceSchema })` per
 * resource. Twenty near-identical copies drift, and the one that forgot `.nullable()` on
 * `message` throws on the first response that omits it.
 *
 * Non-uniform APIs are normal: real backends grow an envelope on some endpoints and not
 * others. Do not wrap the bare ones in a fake envelope to look tidy — model each endpoint
 * as it actually responds and note the split in the resource module's header. A schema
 * that lies fails at runtime, where lies cost most.
 *
 * Requires zod v4 (`z.record(keySchema, valueSchema)` takes both arguments).
 */
import { z } from 'zod';

/**
 * Field-keyed validation errors as they arrive on the WIRE: an array of messages per
 * field, `{ "email": ["already taken"] }`. Common to many backends.
 *
 * The flattened, one-message-per-field form the UI binds is `FieldErrors` in
 * `@/common/errors/types`; `mapError` performs the flattening. Keep the two names
 * distinct — conflating them is how `errors.email?.[0]` ends up in a component.
 */
export const fieldErrorsSchema = z.record(z.string(), z.array(z.string()));
export type WireFieldErrors = z.infer<typeof fieldErrorsSchema>;

/**
 * `{ message, data }` success wrapper. Pass the payload schema to type `data`.
 * `message` is optional AND nullable because backends emit all three forms (absent,
 * null, present) across endpoints of the same API.
 */
export function successEnvelope<S extends z.ZodTypeAny>(data: S) {
  return z.object({
    message: z.string().nullable().optional(),
    data,
  });
}

/** `{ message, errors }` failure wrapper. */
export const errorEnvelopeSchema = z.object({
  message: z.string().nullable().optional(),
  errors: fieldErrorsSchema.optional(),
});
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

/** Message-only acknowledgement (`data` absent) — e.g. a delete confirmation. */
export const messageEnvelopeSchema = errorEnvelopeSchema.pick({ message: true });
export type MessageEnvelope = z.infer<typeof messageEnvelopeSchema>;

/**
 * Offset pagination.
 *
 * `results` is `.catch([])` on purpose: one malformed row must not blank the entire
 * list route with a `ZodError` that propagates to the nearest error boundary. The
 * metadata fields get the same treatment because a missing `count` is not worth taking a
 * page down for — but note the tension with the rule "never `.catch()` an identity
 * field": these are display metadata, not identity. Never extend that leniency to an id,
 * an amount, or a permission flag.
 *
 * TODO(project): cursor APIs get the same treatment with their own factory —
 * `z.object({ items: z.array(item).catch([]), next_cursor: …, has_more: … })`.
 */
export function paginated<S extends z.ZodTypeAny>(item: S) {
  return z.object({
    count: z.number().int().nonnegative().catch(0),
    next: z.string().nullable().catch(null),
    previous: z.string().nullable().catch(null),
    results: z.array(item).catch([]),
  });
}

/**
 * The shape `paginated()` produces, for the rare signature that needs to name it without
 * an instantiated schema in scope. Prefer `z.infer<typeof invoicePageSchema>` where you
 * do have one — a derived type cannot drift from the factory.
 */
export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
