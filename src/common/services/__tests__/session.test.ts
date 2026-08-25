// @vitest-environment node
/**
 * The signature, the expiry and the password check — the three things that ARE the
 * authentication on a single-cookie design.
 *
 * The whole architecture rests on one claim: a client cannot MINT a session cookie. There is
 * no auth server to ask, no session table to look up and no refresh token to rotate, so if
 * `verifySession` accepts something it should not, there is no second line of defence
 * anywhere. That is what these test.
 */
import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ADMIN_PASSWORD = 'a-correct-horse-battery-staple';
const SESSION_SECRET = 'test-secret-at-least-thirty-two-characters-long';

vi.mock('@/common/config/server-env', () => ({
  serverEnv: {
    ADMIN_PASSWORD,
    SESSION_SECRET,
    TURSO_DATABASE_URL: 'file:./test.db',
    TURSO_AUTH_TOKEN: undefined,
  },
}));

const jar = new Map<string, string>();
const headerBag = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (init: { name: string; value: string }) => jar.set(init.name, init.value),
    delete: (init: { name: string }) => jar.delete(init.name),
  }),
  headers: async () => ({ get: (key: string) => headerBag.get(key) ?? null }),
}));

const {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSession,
  destroySession,
  isSecureRequest,
  isSignedIn,
  readSession,
  serializeSession,
  verifyAdminPassword,
  verifySession,
} = await import('../session');

const now = () => Math.floor(Date.now() / 1000);

beforeEach(() => {
  jar.clear();
  headerBag.clear();
});

describe('verifyAdminPassword', () => {
  it('accepts the configured password and refuses everything else', () => {
    expect(verifyAdminPassword(ADMIN_PASSWORD)).toBe(true);
    expect(verifyAdminPassword('wrong')).toBe(false);
    expect(verifyAdminPassword('')).toBe(false);
    // A prefix of the real password, which a naive early-exit comparison would leak the
    // length of through timing. The comparison hashes both sides to a fixed 32 bytes first.
    expect(verifyAdminPassword(ADMIN_PASSWORD.slice(0, -1))).toBe(false);
    // One character longer. `timingSafeEqual` THROWS on a length mismatch, which is why the
    // hash is not optional — without it this case is an exception, not a `false`.
    expect(verifyAdminPassword(`${ADMIN_PASSWORD}x`)).toBe(false);
  });
});

describe('verifySession', () => {
  it('accepts a payload it signed itself', () => {
    const issued = { sub: 'admin' as const, iat: now(), exp: now() + 3600 };
    const result = verifySession(serializeSession(issued));

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') throw new Error('unreachable');
    expect(result.session).toEqual(issued);
  });

  it('REFUSES A FORGED SIGNATURE — the claim the whole design rests on', () => {
    const raw = serializeSession({ sub: 'admin', iat: now(), exp: now() + 3600 });
    const [payload] = raw.split('.');

    // A well-formed payload with a made-up tag. Without the HMAC this is a valid session
    // that anyone can write into their own browser.
    const result = verifySession(`${payload}.not-a-real-signature`);
    expect(result).toEqual({ status: 'invalid', reason: 'bad-signature' });
  });

  it('refuses a payload edited after signing, even by one character', () => {
    const raw = serializeSession({ sub: 'admin', iat: now(), exp: now() + 3600 });
    const [payload, signature] = raw.split('.');

    // The attack the expiry check alone would not stop: keep the tag, extend the payload.
    const tampered = Buffer.from(
      JSON.stringify({ sub: 'admin', iat: now(), exp: now() + 999_999_999 }),
      'utf8',
    ).toString('base64url');
    expect(tampered).not.toBe(payload);

    expect(verifySession(`${tampered}.${signature}`)).toEqual({
      status: 'invalid',
      reason: 'bad-signature',
    });
  });

  it('refuses an expired session even though the signature is genuine', () => {
    // The `exp` is inside the signed payload, so this cookie is authentically ours and still
    // must not be accepted. The browser's own `maxAge` is enforced by the party being
    // authenticated; this check is enforced by the party that matters.
    const raw = serializeSession({ sub: 'admin', iat: now() - 7200, exp: now() - 1 });
    expect(verifySession(raw)).toEqual({ status: 'expired' });
  });

  it('refuses malformed input without throwing', () => {
    // Everything here is attacker-controlled. A throw would surface as a 500 on a page that
    // should simply have shown the login form.
    for (const raw of ['', '.', 'nodot', 'a.', '.b', 'not.base64url!!', 'a.b.c']) {
      expect(() => verifySession(raw)).not.toThrow();
      expect(verifySession(raw).status).not.toBe('valid');
    }
  });

  /**
   * Sign an arbitrary payload with the real secret, the way the module does.
   *
   * The tests below need cookies that PASS the signature check and still must be refused,
   * and `serializeSession` cannot produce them — its parameter type is `AdminSession`, which
   * is exactly the shape under test. Re-implementing the two lines here is the honest way to
   * reach that branch; casting past the type would test nothing.
   */
  const signRaw = (payloadJson: string) => {
    const payload = Buffer.from(payloadJson, 'utf8').toString('base64url');
    const signature = createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
    return `${payload}.${signature}`;
  };

  it('refuses a GENUINELY SIGNED payload of the wrong shape', () => {
    // The tag verifies — this cookie really was signed with our secret — and it is still not
    // a session. That is the branch a duck-typed guard covers and a cast would not:
    // `JSON.parse(...) as AdminSession` would let `sub: 'root'` through with the compiler
    // agreeing, and `sub` is the only thing saying who this is.
    expect(verifySession(signRaw(JSON.stringify({ sub: 'root', iat: 1, exp: 2 }))).status).toBe(
      'invalid',
    );
    // Missing fields, and wrong types for the ones present.
    expect(verifySession(signRaw(JSON.stringify({ sub: 'admin' }))).status).toBe('invalid');
    expect(
      verifySession(signRaw(JSON.stringify({ sub: 'admin', iat: '1', exp: '2' }))).status,
    ).toBe('invalid');
    expect(verifySession(signRaw(JSON.stringify(null))).status).toBe('invalid');
    expect(verifySession(signRaw('[]')).status).toBe('invalid');
  });

  it('reports a genuinely-signed but unparseable payload as malformed, not as a bad signature', () => {
    // The tag was fine; the bytes under it were not. The distinction matters to whoever is
    // reading the server logs: `bad-signature` means somebody is guessing, `malformed` means
    // the secret is shared with something writing a different format.
    expect(verifySession(signRaw('{not json'))).toEqual({
      status: 'invalid',
      reason: 'malformed',
    });
  });
});

describe('createSession / readSession / destroySession', () => {
  it('round-trips through the cookie jar', async () => {
    await createSession();

    expect(jar.has(SESSION_COOKIE)).toBe(true);
    expect((await readSession()).status).toBe('valid');
    expect(await isSignedIn()).toBe(true);
  });

  it('issues an expiry matching the declared policy', async () => {
    const session = await createSession();
    // Seven days, recorded in AGENTS.md. Asserted against the exported constant rather than
    // a literal, so the number and the documentation cannot drift apart silently.
    expect(session.exp - session.iat).toBe(SESSION_MAX_AGE_SECONDS);
  });

  it('reports anonymous with no cookie at all', async () => {
    expect(await readSession()).toEqual({ status: 'anonymous' });
    expect(await isSignedIn()).toBe(false);
  });

  it('distinguishes a forged cookie from no cookie', async () => {
    jar.set(SESSION_COOKIE, 'garbage.garbage');
    const result = await readSession();

    // Both are "not signed in" to a caller, and the server keeps the distinction: collapsing
    // them into one `null` makes a forgery attempt indistinguishable from a first visit.
    expect(result.status).toBe('invalid');
    expect(await isSignedIn()).toBe(false);
  });

  it('clears the cookie', async () => {
    await createSession();
    await destroySession();

    expect(jar.has(SESSION_COOKIE)).toBe(false);
    expect((await readSession()).status).toBe('anonymous');
  });
});

describe('isSecureRequest', () => {
  const headers = (entries: Record<string, string>) => new Headers(entries);

  it('reads x-forwarded-proto first, taking the first hop of a chain', () => {
    expect(isSecureRequest(headers({ 'x-forwarded-proto': 'https' }))).toBe(true);
    expect(isSecureRequest(headers({ 'x-forwarded-proto': 'http' }))).toBe(false);
    expect(isSecureRequest(headers({ 'x-forwarded-proto': 'https,http' }))).toBe(true);
    expect(isSecureRequest(headers({ 'x-forwarded-proto': ' HTTPS ' }))).toBe(true);
  });

  it('falls back to origin, then referer — headers the browser itself sends', () => {
    // Covers a TLS terminator that forwards no `x-forwarded-*` at all.
    expect(isSecureRequest(headers({ origin: 'https://kavan.studio' }))).toBe(true);
    expect(isSecureRequest(headers({ referer: 'https://kavan.studio/dashboard' }))).toBe(true);
    expect(isSecureRequest(headers({ origin: 'http://localhost:3000' }))).toBe(false);
  });

  it('omits Secure when there is nothing to go on', () => {
    // Prefer a working session over a stricter one: the cookie is httpOnly + SameSite=Lax
    // either way, and a `Secure` cookie over http is silently discarded by the browser.
    expect(isSecureRequest(headers({}))).toBe(false);
  });

  it('cannot be downgraded by a client on a real HTTPS connection', () => {
    // A browser cannot set `x-forwarded-proto`, and a browser on HTTPS always sends an
    // `https://` origin — so the proxy's header wins and, failing that, the origin does.
    expect(
      isSecureRequest(headers({ 'x-forwarded-proto': 'https', origin: 'http://evil.example' })),
    ).toBe(true);
  });
});
