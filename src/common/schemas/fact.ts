// src/common/schemas/fact.ts
/**
 * The `{ k, v }` pair used by the fact tables on design works and media records.
 *
 * Its own module because two resources share it and neither owns it — importing
 * `factSchema` from `design-work.ts` into `media.ts` would make an unrelated dependency
 * between two resources that a later split would have to unpick.
 *
 * The one-letter keys are the legacy spelling (`{ k: 'Edition', v: 'In use since 2021' }`)
 * and are kept verbatim: the seed copies these objects straight out of `legacy/data/`, and
 * renaming them here would mean a transform in the seed that could silently drop a pair.
 */
import { z } from 'zod';
import { looseString } from './helpers';

/** READ: tolerant leaves — a fact row with a null value costs one line, not the page. */
export const factSchema = z.object({
  k: looseString,
  v: looseString,
});

export type Fact = z.infer<typeof factSchema>;

/** WRITE: exact. Tolerance on a write body silently stores an empty label. */
export const factWriteSchema = z.object({
  k: z.string().min(1),
  v: z.string().min(1),
});
