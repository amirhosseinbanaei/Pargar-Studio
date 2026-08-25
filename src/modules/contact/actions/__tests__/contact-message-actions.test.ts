// @vitest-environment node
/**
 * The site's only write, tested at the trust boundary.
 *
 * The action is a public HTTP endpoint: everything it is handed is caller-controlled, and
 * every assertion here is about what it does with input the form would never produce. The
 * service and the request headers are mocked, so this is the action's own logic and
 * nothing below it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createContactMessage = vi.fn();
const headerBag = new Map<string, string>();

vi.mock('@/common/services/contact-message-service', () => ({
  createContactMessage: (...args: unknown[]) => createContactMessage(...args),
}));

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (key: string) => headerBag.get(key) ?? null }),
}));

const { sendContactMessageAction } = await import('../contact-message-actions');
const { resetRateLimit } = await import('../../lib/rate-limit');

const VALID = {
  name: 'Roya Kamalvand',
  email: 'roya@example.com',
  subject: 'A house in Qeytarieh',
  body: 'We are looking for an architect for a small renovation and would like to talk.',
  company: '',
};

beforeEach(() => {
  resetRateLimit();
  headerBag.clear();
  createContactMessage.mockReset();
  createContactMessage.mockResolvedValue({ id: 1 });
  // One address for every test; `resetRateLimit()` above is what keeps the windows from
  // leaking between them.
  headerBag.set('x-forwarded-for', '10.0.0.7');
});

describe('sendContactMessageAction', () => {
  it('stores a valid message and returns a success result', async () => {
    const result = await sendContactMessageAction(VALID);

    expect(result).toEqual({ ok: true, data: undefined });
    expect(createContactMessage).toHaveBeenCalledTimes(1);
    // The honeypot is stripped: the table has no column for it, and a strict insert would
    // fail on the extra key.
    expect(createContactMessage).toHaveBeenCalledWith({
      name: VALID.name,
      email: VALID.email,
      subject: VALID.subject,
      body: VALID.body,
    });
  });

  it('answers 422 with FIELD-KEYED errors for an invalid email, and writes nothing', async () => {
    const result = await sendContactMessageAction({ ...VALID, email: 'not-an-address' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(422);
    // The shape the form binds against — one key per field, which is what lets the message
    // land on the input instead of in a toast.
    expect(result.body).toHaveProperty('email');
    expect(createContactMessage).not.toHaveBeenCalled();
  });

  it('rejects an over-long body rather than truncating it', async () => {
    const result = await sendContactMessageAction({ ...VALID, body: 'x'.repeat(5001) });

    expect(result.ok).toBe(false);
    expect(createContactMessage).not.toHaveBeenCalled();
  });

  it('rejects an unknown key — a crafted POST cannot smuggle a column in', async () => {
    const result = await sendContactMessageAction({ ...VALID, readAt: '2020-01-01' });

    expect(result.ok).toBe(false);
    expect(createContactMessage).not.toHaveBeenCalled();
  });

  it('SILENTLY accepts a filled honeypot and writes nothing', async () => {
    // Success, deliberately: a 422 would tell a script which field to stop filling.
    const result = await sendContactMessageAction({ ...VALID, company: 'Acme Ltd' });

    expect(result).toEqual({ ok: true, data: undefined });
    expect(createContactMessage).not.toHaveBeenCalled();
  });

  it('does not spend the rate limit on a bot', async () => {
    for (let i = 0; i < 10; i += 1) {
      await sendContactMessageAction({ ...VALID, company: 'Acme Ltd' });
    }
    // The honeypot is checked BEFORE the limiter, so a real reader behind the same address
    // is still let through.
    await expect(sendContactMessageAction(VALID)).resolves.toEqual({ ok: true, data: undefined });
  });

  it('answers 429 once the window is spent, and stops writing', async () => {
    for (let i = 0; i < 5; i += 1) {
      await expect(sendContactMessageAction(VALID)).resolves.toEqual({ ok: true, data: undefined });
    }

    const result = await sendContactMessageAction(VALID);
    expect(result).toEqual({ ok: false, status: 429 });
    // Status only. The client owns the sentence, because this site is bilingual and a
    // message chosen here would be right in one language and wrong in the other.
    expect(createContactMessage).toHaveBeenCalledTimes(5);
  });

  it('RETURNS a failure when the write throws, instead of throwing', async () => {
    // A throw would be sanitized crossing the RPC boundary and the form would lose the
    // status it branches on.
    createContactMessage.mockRejectedValue(new Error('database is locked'));

    const result = await sendContactMessageAction(VALID);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(0);
  });

  it('keys the limit on the FIRST address in x-forwarded-for', async () => {
    headerBag.set('x-forwarded-for', '203.0.113.9, 70.41.3.18, 150.172.238.178');
    for (let i = 0; i < 5; i += 1) await sendContactMessageAction(VALID);

    // Same client, different proxy chain: still the same window. Keying on the last entry
    // would key on the proxy and rate-limit every visitor together.
    headerBag.set('x-forwarded-for', '203.0.113.9, 198.51.100.4');
    await expect(sendContactMessageAction(VALID)).resolves.toEqual({ ok: false, status: 429 });
  });
});
