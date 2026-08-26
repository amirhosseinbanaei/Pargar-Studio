// @vitest-environment node
/**
 * The inbox actions — mark read and delete. No write schema to re-validate against (both
 * take only the record's own id) and, deliberately, NO CACHE TAG: `contact_messages` is
 * never cached and no public page reads it (`contact-message-service.ts`). The structural
 * test at the bottom pins that by reading the action file's own source, the same technique
 * `require-session.test.ts` uses to pin that every page calls the session gate — a purge
 * added here later without updating this test would fail it immediately.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContactMessage } from '@/common/schemas/contact-message';

const markContactMessageRead = vi.fn();
const deleteContactMessage = vi.fn();
const readSession = vi.fn();

vi.mock('@/common/services/contact-message-service', () => ({
  markContactMessageRead: (...args: unknown[]) => markContactMessageRead(...args),
  deleteContactMessage: (...args: unknown[]) => deleteContactMessage(...args),
}));
vi.mock('@/common/services/session', () => ({ readSession: () => readSession() }));

const { deleteContactMessageAction, markContactMessageReadAction } =
  await import('../actions/contact-message-actions');

const message = (overrides: Partial<ContactMessage> = {}): ContactMessage =>
  ({
    id: 9,
    name: 'A visitor',
    email: 'visitor@example.com',
    subject: 'A question',
    body: 'Hello.',
    createdAt: new Date('2024-01-01'),
    readAt: null,
    ...overrides,
  }) as ContactMessage;

beforeEach(() => {
  vi.clearAllMocks();
  readSession.mockResolvedValue({ status: 'valid', session: { sub: 'admin', iat: 0, exp: 0 } });
  markContactMessageRead.mockResolvedValue(message({ readAt: new Date('2024-01-02') }));
  deleteContactMessage.mockResolvedValue(true);
});

describe('authorization', () => {
  it('refuses both writes with 401 when unauthenticated, and touches nothing', async () => {
    readSession.mockResolvedValue({ status: 'anonymous' });

    const results = await Promise.all([
      markContactMessageReadAction(9),
      deleteContactMessageAction(9),
    ]);

    for (const result of results) expect(result).toEqual({ ok: false, status: 401 });
    expect(markContactMessageRead).not.toHaveBeenCalled();
    expect(deleteContactMessage).not.toHaveBeenCalled();
  });
});

describe('validation', () => {
  it('rejects a non-positive id without touching the database', async () => {
    const result = await markContactMessageReadAction(0);
    expect(result.ok).toBe(false);
    expect(markContactMessageRead).not.toHaveBeenCalled();
  });
});

describe('markContactMessageReadAction', () => {
  it('marks the row read', async () => {
    const result = await markContactMessageReadAction(9);
    expect(result).toEqual({ ok: true, data: undefined });
    expect(markContactMessageRead).toHaveBeenCalledWith(9);
  });

  it('answers 404 for an id that no longer exists', async () => {
    markContactMessageRead.mockResolvedValue(null);
    const result = await markContactMessageReadAction(9);
    expect(result).toEqual({ ok: false, status: 404 });
  });
});

describe('deleteContactMessageAction', () => {
  it('deletes the row', async () => {
    const result = await deleteContactMessageAction(9);
    expect(result).toEqual({ ok: true, data: undefined });
    expect(deleteContactMessage).toHaveBeenCalledWith(9);
  });

  it('answers 404 for an id that is already gone', async () => {
    deleteContactMessage.mockResolvedValue(false);
    const result = await deleteContactMessageAction(9);
    expect(result).toEqual({ ok: false, status: 404 });
  });
});

it('purges no cache tag — contact_messages has none to purge', () => {
  const source = readFileSync('src/modules/dashboard/actions/contact-message-actions.ts', 'utf8');
  // The word appears in the file's own doc comment, explaining exactly why it is absent —
  // so this checks for an actual IMPORT or CALL, not just the substring.
  expect(source.includes('next/cache')).toBe(false);
  expect(source.includes('updateTag(')).toBe(false);
});
