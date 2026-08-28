// @vitest-environment node
/**
 * The two schemas that guard one submission must agree on what a message is.
 *
 * They cannot be one schema: the form's carries localized copy and the action's must not
 * (a wire-facing schema's messages end up in a 422 body and in logs). So they are two
 * files reading one set of bounds, and this is the test that keeps them honest.
 *
 * The failure it catches is asymmetric and the bad direction is the quiet one: a form that
 * is stricter than the action merely refuses something the server would have taken, while
 * an ACTION that is stricter accepts nothing the form warned about — the reader submits a
 * valid-looking message and gets an error bound to a field with no visible problem. That
 * is precisely what a `min(10)` in one file and a `min(1)` in the other produced.
 */
import { describe, expect, it } from 'vitest';
import { getIntl } from '@/common/i18n';
import { createContactFormSchema } from '../contact-form';
import { contactSubmissionSchema } from '../contact-submission';
import { CONTACT_LIMITS } from '../limits';

const formSchema = createContactFormSchema(getIntl('en').t);

const VALID = {
  name: 'Roya Kamalvand',
  email: 'roya@example.com',
  subject: 'A house in Qeytarieh',
  body: 'We are looking for an architect for a small renovation.',
  company: '',
};

/** Each case is a value both schemas must judge the same way. */
const CASES: ReadonlyArray<{ label: string; input: Record<string, unknown>; valid: boolean }> = [
  { label: 'a well-formed message', input: VALID, valid: true },
  { label: 'an empty name', input: { ...VALID, name: '' }, valid: false },
  { label: 'a whitespace-only name', input: { ...VALID, name: '   ' }, valid: false },
  { label: 'a malformed email', input: { ...VALID, email: 'not-an-address' }, valid: false },
  { label: 'an empty subject', input: { ...VALID, subject: '' }, valid: false },
  {
    label: 'a body one character under the minimum',
    input: { ...VALID, body: 'x'.repeat(CONTACT_LIMITS.bodyMin - 1) },
    valid: false,
  },
  {
    label: 'a body exactly at the minimum',
    input: { ...VALID, body: 'x'.repeat(CONTACT_LIMITS.bodyMin) },
    valid: true,
  },
  {
    label: 'a name one character over the maximum',
    input: { ...VALID, name: 'x'.repeat(CONTACT_LIMITS.nameMax + 1) },
    valid: false,
  },
  {
    label: 'a body one character over the maximum',
    input: { ...VALID, body: 'x'.repeat(CONTACT_LIMITS.bodyMax + 1) },
    valid: false,
  },
  { label: 'a filled honeypot', input: { ...VALID, company: 'Acme Ltd' }, valid: true },
];

describe.each(CASES)('$label', ({ input, valid }) => {
  it(`is ${valid ? 'accepted' : 'rejected'} by BOTH schemas`, () => {
    expect(formSchema.safeParse(input).success).toBe(valid);
    expect(contactSubmissionSchema.safeParse(input).success).toBe(valid);
  });
});

describe('the localized schema', () => {
  it('carries the reader’s language, which is why it cannot be the wire schema', () => {
    const fa = createContactFormSchema(getIntl('fa').t);
    const issue = fa.safeParse({ ...VALID, email: 'nope' });
    expect(issue.success).toBe(false);
    if (issue.success) throw new Error('unreachable');
    // Persian copy, not an English zod default. The action's schema must never do this.
    expect(issue.error.issues[0]?.message).toBe(getIntl('fa').t('form.errEmail'));
  });
});

describe('the wire-facing schema', () => {
  it('rejects an unknown key, so a crafted POST cannot smuggle a column', () => {
    expect(contactSubmissionSchema.safeParse({ ...VALID, readAt: '2020-01-01' }).success).toBe(
      false,
    );
  });
});
