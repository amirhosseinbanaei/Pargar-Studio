// @vitest-environment node
/** The one write to the `contact` singleton. Same shape as `studio-actions.test.ts`. */
import { beforeEach, expect, it, vi } from 'vitest';
import { CACHE_TAGS } from '@/common/services/cache-tags';
import type { ContactRow } from '@/common/schemas/contact';

const updateTag = vi.fn();
const updateContact = vi.fn();
const readSession = vi.fn();

vi.mock('next/cache', () => ({ updateTag: (...args: unknown[]) => updateTag(...args) }));
vi.mock('@/common/services/contact-service', () => ({
  updateContact: (...args: unknown[]) => updateContact(...args),
}));
vi.mock('@/common/services/session', () => ({ readSession: () => readSession() }));

const { updateContactAction } = await import('../actions/contact-actions');

const VALID = {
  postcode: '19899',
  phone: '+98 21 000 0000',
  phoneHref: '982100000000',
  email: 'studio@example.com',
  press: 'press@example.com',
  lat: '35.8112',
  lng: '51.4383',
  addressEn: 'Dezashib, Tehran',
  addressFa: '',
  districtEn: '',
  districtFa: '',
  cityEn: '',
  cityFa: '',
  countryEn: '',
  countryFa: '',
  hoursEn: '',
  hoursFa: '',
  careersEn: '',
  careersFa: '',
  socialsEn: [{ name: 'Instagram', handle: '@kavan' }],
  socialsFa: [],
};

const row = (overrides: Partial<ContactRow> = {}): ContactRow =>
  ({
    id: 1,
    postcode: '19899',
    phone: '+98 21 000 0000',
    phoneHref: '982100000000',
    email: 'studio@example.com',
    press: 'press@example.com',
    lat: '35.8112',
    lng: '51.4383',
    addressEn: '',
    addressFa: '',
    districtEn: '',
    districtFa: '',
    cityEn: '',
    cityFa: '',
    countryEn: '',
    countryFa: '',
    hoursEn: '',
    hoursFa: '',
    careersEn: '',
    careersFa: '',
    socialsEn: [],
    socialsFa: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }) as ContactRow;

beforeEach(() => {
  vi.clearAllMocks();
  readSession.mockResolvedValue({ status: 'valid', session: { sub: 'admin', iat: 0, exp: 0 } });
  updateContact.mockResolvedValue(row());
});

it('refuses an unauthenticated save with 401 and touches nothing', async () => {
  readSession.mockResolvedValue({ status: 'anonymous' });

  const result = await updateContactAction(VALID);

  expect(result).toEqual({ ok: false, status: 401 });
  expect(updateContact).not.toHaveBeenCalled();
  expect(updateTag).not.toHaveBeenCalled();
});

it('rejects a malformed email rather than storing it', async () => {
  const result = await updateContactAction({ ...VALID, email: 'not an email' });
  expect(result.ok).toBe(false);
  expect(updateContact).not.toHaveBeenCalled();
});

it('rejects a phoneHref that is not digits-only', async () => {
  const result = await updateContactAction({ ...VALID, phoneHref: '+98 21 000 0000' });
  expect(result.ok).toBe(false);
});

it('rejects a non-decimal latitude', async () => {
  const result = await updateContactAction({ ...VALID, lat: 'north-ish' });
  expect(result.ok).toBe(false);
});

it('duplicates an empty Persian address from the English one', async () => {
  await updateContactAction(VALID);
  const [payload] = updateContact.mock.calls[0] as [Record<string, unknown>];
  expect(payload.addressFa).toBe(VALID.addressEn);
  expect(payload.socialsFa).toEqual(VALID.socialsEn);
});

it('saves and purges only the contact tag', async () => {
  const result = await updateContactAction(VALID);

  expect(result).toEqual({ ok: true, data: undefined });
  expect(updateTag).toHaveBeenCalledWith(CACHE_TAGS.contact);
  expect(updateTag).toHaveBeenCalledTimes(1);
});

it('answers 404 rather than a false success when the database has not been seeded', async () => {
  updateContact.mockResolvedValue(null);

  const result = await updateContactAction(VALID);

  expect(result).toEqual({ ok: false, status: 404 });
  expect(updateTag).not.toHaveBeenCalled();
});
