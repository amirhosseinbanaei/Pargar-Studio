// @vitest-environment node
/**
 * The form schema and the submission schema must judge every payload the same way.
 *
 * ─── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────────
 * Prompt 5 shipped exactly this bug once: `modules/contact/schemas/contact-form.ts` carried
 * `min(10)` on the message body and the action behind it inherited `min(1)`, so a
 * nine-character message was accepted by the server the form had just refused. Nothing
 * errored. The two schemas simply disagreed, and the disagreement was invisible because each
 * one was correct on its own.
 *
 * Two schemas are still the right design — a form schema carries user-facing copy and a wire
 * schema must not — so the answer is not to merge them but to assert they agree. This is the
 * assertion.
 *
 * They are allowed to differ in exactly two places, and both are asserted separately below
 * rather than waived:
 *
 *  - **The year.** The form validates the STRING a number input holds; the submission schema
 *    converts it to the number the column holds. They must still accept and reject the same
 *    SET of years.
 *  - **Unknown keys.** The submission schema is `strictObject` and refuses them, because on
 *    the server an unexpected key is a mass-assignment attempt. The form schema strips them,
 *    because on the client it is not a security boundary and failing a whole form over a key
 *    react-hook-form added itself would break the form with no visible cause.
 */
import { describe, expect, it } from 'vitest';
import { projectTypeValues } from '@/common/schemas/enums';
import { PROJECT_YEAR_MAX, PROJECT_YEAR_MIN } from '@/common/schemas/project';
import {
  EMPTY_PROJECT_FORM,
  PROJECT_FORM_FIELDS,
  PROJECT_LOCALE_FIELDS,
  projectFormSchema,
  projectSubmissionSchema,
  withPersianFallback,
} from '../schemas/project-form';

/**
 * `status` and `scale` are spelled out here rather than inherited from `EMPTY_PROJECT_FORM`,
 * which leaves them blank since prompt 9: the options are `taxonomy_terms` rows now and there
 * is no hardcoded first value to seed them from — the create form fills them from the first
 * available term. Both schemas require a non-empty string, so a valid payload has to name one.
 */
const VALID = {
  ...EMPTY_PROJECT_FORM,
  slug: 'qeytarieh-08-residence',
  types: ['Residential'] as const,
  status: 'Completed',
  scale: 'Medium',
  titleEn: 'Qeytarieh 08 Residence',
  year: '2021',
};

/** Does each schema accept this payload? They must always answer identically. */
const verdicts = (payload: unknown) => ({
  form: projectFormSchema.safeParse(payload).success,
  submission: projectSubmissionSchema.safeParse(payload).success,
});

describe('the two schemas agree', () => {
  const cases: Array<[string, unknown]> = [
    ['a complete valid record', VALID],
    ['an empty slug', { ...VALID, slug: '' }],
    ['a slug with spaces', { ...VALID, slug: 'not a slug' }],
    ['a slug with capitals', { ...VALID, slug: 'Qeytarieh-08' }],
    ['a slug with a trailing hyphen', { ...VALID, slug: 'qeytarieh-' }],
    ['a slug with a double hyphen', { ...VALID, slug: 'a--b' }],
    ['an empty English title', { ...VALID, titleEn: '' }],
    ['an empty PERSIAN title', { ...VALID, titleFa: '' }],
    ['every Persian field empty', { ...VALID, titleFa: '', blurbFa: '', descriptionFa: '' }],
    ['no types at all', { ...VALID, types: [] }],
    // Prompt 9: these three are ACCEPTED by both schemas now, and the agreement is still the
    // thing being asserted. The taxonomy stopped being a `z.enum` when it became editable
    // rows — see `unknownTermErrors` below, which is where an unknown value is actually
    // refused. What the schemas still judge identically is that all three are non-empty
    // strings; what they must never do is disagree about it.
    ['a type outside the taxonomy', { ...VALID, types: ['Submarine'] }],
    ['a status outside the taxonomy', { ...VALID, status: 'Demolished' }],
    ['a scale outside the taxonomy', { ...VALID, scale: 'Enormous' }],
    ['an empty status', { ...VALID, status: '' }],
    ['an empty scale', { ...VALID, scale: '' }],
    ['a type that is an empty string', { ...VALID, types: [''] }],
    [`the year ${PROJECT_YEAR_MIN}`, { ...VALID, year: String(PROJECT_YEAR_MIN) }],
    [`the year ${PROJECT_YEAR_MIN - 1}`, { ...VALID, year: String(PROJECT_YEAR_MIN - 1) }],
    [`the year ${PROJECT_YEAR_MAX}`, { ...VALID, year: String(PROJECT_YEAR_MAX) }],
    [`the year ${PROJECT_YEAR_MAX + 1}`, { ...VALID, year: String(PROJECT_YEAR_MAX + 1) }],
    ['an empty year', { ...VALID, year: '' }],
    ['a non-numeric year', { ...VALID, year: 'MMXXI' }],
    ['a decimal year', { ...VALID, year: '2021.5' }],
    ['a missing key', { slug: 'a-house' }],
  ];

  for (const [name, payload] of cases) {
    it(`judges ${name} the same way`, () => {
      const { form, submission } = verdicts(payload);
      expect({ form, submission }).toEqual({ form: submission, submission });
    });
  }

  it('accepts every type the archive was seeded with, on both sides', () => {
    // A value the seed writes as a term but a schema rejects would make a whole category of
    // project uncreatable, and the only symptom would be a 422 on a checkbox the form
    // offered. `projectTypeValues` is no longer the enforcement point — it is what
    // `scripts/seed-taxonomy.ts` writes into `taxonomy_terms` — so this asserts the schemas
    // stay out of the way of every term the studio starts with.
    for (const type of projectTypeValues) {
      const { form, submission } = verdicts({ ...VALID, types: [type] });
      expect({ type, form, submission }).toEqual({ type, form: true, submission: true });
    }
  });

  it('neither schema enforces the taxonomy any more, and that is deliberate', () => {
    // Pinning the MOVE, not just its consequence. Re-adding a `z.enum` here would make a term
    // the studio added five minutes ago un-saveable, and this test is what would fail —
    // rather than a 422 nobody can explain, on a value the form itself offered.
    const invented = { ...VALID, status: 'Mothballed', scale: 'Enormous', types: ['Submarine'] };
    expect(projectFormSchema.safeParse(invented).success).toBe(true);
    expect(projectSubmissionSchema.safeParse(invented).success).toBe(true);
  });
});

describe('unknown keys — the one asymmetry, and it is deliberate', () => {
  const withExtra = { ...VALID, sortOrder: -999 };

  it('the SUBMISSION schema REJECTS an unknown key', () => {
    // `strictObject`. An unexpected key on a write is tampering or a mass-assignment attempt,
    // not an additive release to tolerate — and `sortOrder` is the concrete case: it is
    // deliberately not a form field, because position belongs to the reorder control, so a
    // payload carrying one was hand-made.
    expect(projectSubmissionSchema.safeParse(withExtra).success).toBe(false);
  });

  it('the FORM schema strips it instead, and that is correct', () => {
    // `z.object`. A form schema is not a security boundary and must not behave like one:
    // react-hook-form's value object is assembled by the library, and a resolver that failed
    // the whole form over a key the library added would break the form with no visible cause.
    // Stripping is right on the client for the same reason rejecting is right on the server.
    const parsed = projectFormSchema.safeParse(withExtra);
    expect(parsed.success).toBe(true);
    expect(parsed.data).not.toHaveProperty('sortOrder');
  });
});

describe('the year, the one deliberate difference', () => {
  it('is a string in the form and a number after submission', () => {
    const form = projectFormSchema.parse(VALID);
    const submission = projectSubmissionSchema.parse(VALID);

    // The browser holds a string; the column holds an integer. Converting in the form schema
    // would make its input and output types differ, which every layer above it would have to
    // thread through — for a `Number()` call.
    expect(form.year).toBe('2021');
    expect(submission.year).toBe(2021);
  });

  it('accepts an already-numeric year on the submission side', () => {
    // The action is a public endpoint; a caller that is not the form may well send a number.
    expect(projectSubmissionSchema.safeParse({ ...VALID, year: 2021 }).success).toBe(true);
  });

  it('never coerces an empty year to 0', () => {
    // `z.coerce.number()` turns `''` into `0`, which then fails the range check and reports
    // "must be at least 1900" for a field that was simply left blank.
    const result = projectSubmissionSchema.safeParse({ ...VALID, year: '' });
    expect(result.success).toBe(false);
  });
});

describe('withPersianFallback', () => {
  const parsed = () => projectSubmissionSchema.parse({ ...VALID, titleFa: '', blurbEn: 'Blurb.' });

  it('fills an empty Persian column with its English counterpart', () => {
    const payload = withPersianFallback(parsed());
    // The read path has NO fallback (`pickLocale`), so a blank Persian column renders a hole
    // on the Persian page. The degradation belongs at author time, exactly as the seed does it.
    expect(payload.titleFa).toBe(VALID.titleEn);
    expect(payload.blurbFa).toBe('Blurb.');
  });

  it('leaves a real Persian value alone, including its zero-width characters', () => {
    // Several seeded Persian values carry meaningful zero-width non-joiners, and trimming
    // stored content is how those get quietly damaged. The trim is on the emptiness TEST only.
    const withZwnj = 'خانه‌ها';
    const payload = withPersianFallback(
      projectSubmissionSchema.parse({ ...VALID, titleFa: withZwnj }),
    );
    expect(payload.titleFa).toBe(withZwnj);
  });

  it('treats a whitespace-only Persian value as empty', () => {
    const payload = withPersianFallback(
      projectSubmissionSchema.parse({ ...VALID, titleFa: '   \n ' }),
    );
    expect(payload.titleFa).toBe(VALID.titleEn);
  });

  it('never emits sortOrder — position is not the form’s to set', () => {
    expect(withPersianFallback(parsed())).not.toHaveProperty('sortOrder');
  });
});

describe('the form’s own metadata', () => {
  it('lists every field the schema declares, so applyFieldErrors can bind all of them', () => {
    // A field missing from this list has its server error silently redirected to the
    // form-level region, where the reader cannot tell which input to fix.
    expect([...PROJECT_FORM_FIELDS].sort()).toEqual(Object.keys(projectFormSchema.shape).sort());
  });

  it('names both halves of every translated pair, and both are real fields', () => {
    // This is what makes it structurally impossible to add the English half of a translated
    // column and forget the Persian one.
    for (const pair of PROJECT_LOCALE_FIELDS) {
      expect(PROJECT_FORM_FIELDS).toContain(pair.en);
      expect(PROJECT_FORM_FIELDS).toContain(pair.fa);
      expect(pair.en.endsWith('En')).toBe(true);
      expect(pair.fa.endsWith('Fa')).toBe(true);
      expect(pair.en.slice(0, -2)).toBe(pair.fa.slice(0, -2));
    }
  });

  it('seeds every field with a non-undefined default, so no input mounts uncontrolled', () => {
    for (const field of PROJECT_FORM_FIELDS) {
      expect(EMPTY_PROJECT_FORM[field]).toBeDefined();
    }
  });
});
