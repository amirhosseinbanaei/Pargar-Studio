// @vitest-environment node
/**
 * Sign-in and sign-out, tested against the REAL session module.
 *
 * `@/common/services/session` is deliberately NOT mocked here — only `next/headers` is,
 * with a cookie jar and a header bag standing in for the request. That is the whole point:
 * the thing worth asserting about a login is that a wrong password SETS NO COOKIE, and
 * mocking the module that writes the cookie would assert nothing at all.
 *
 * `@/common/config/server-env` is mocked because it validates at import time and the test
 * runner does not load `.env.local`. The values it returns are the credential under test.
 */
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

/** A cookie jar with the slice of the `cookies()` API the session module actually uses. */
const jar = new Map<string, { value: string; options: Record<string, unknown> }>();
const headerBag = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const entry = jar.get(name);
      return entry ? { name, value: entry.value } : undefined;
    },
    set: (init: { name: string; value: string } & Record<string, unknown>) => {
      const { name, value, ...options } = init;
      jar.set(name, { value, options });
    },
    delete: (init: { name: string }) => {
      jar.delete(init.name);
    },
  }),
  headers: async () => ({ get: (key: string) => headerBag.get(key) ?? null }),
}));

/**
 * `redirect()` throws by design — that is how it signals. The mock reproduces that so
 * `logoutAction` can be asserted on: a mock that returned normally would let a bug where
 * the redirect never fires pass silently.
 */
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
vi.mock('next/navigation', () => ({ redirect: (path: string) => redirect(path) }));

const { loginAction, logoutAction } = await import('../actions/session-actions');
const { resetLoginRateLimit } = await import('../lib/login-rate-limit');
const { SESSION_COOKIE, readSession } = await import('@/common/services/session');

beforeEach(() => {
  vi.clearAllMocks();
  jar.clear();
  headerBag.clear();
  resetLoginRateLimit();
  headerBag.set('x-forwarded-for', '10.0.0.7');
});

describe('loginAction', () => {
  it('SETS NO COOKIE when the password is wrong, and answers 401', async () => {
    const result = await loginAction({ password: 'not-the-password' });

    expect(result).toEqual({ ok: false, status: 401 });
    // The assertion this whole file exists for.
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });

  it('answers a bare 401 with no body — nothing about why it was refused', async () => {
    const result = await loginAction({ password: 'wrong' });

    if (result.ok) throw new Error('unreachable');
    // No field errors, no message, no distinction between "empty" and "wrong". There is one
    // credential here; every extra word helps somebody guessing and helps nobody else.
    expect(result).not.toHaveProperty('body');
  });

  it('signs in with the right password and writes an httpOnly, SameSite=Lax cookie', async () => {
    const result = await loginAction({ password: ADMIN_PASSWORD });

    expect(result.ok).toBe(true);
    const cookie = jar.get(SESSION_COOKIE);
    expect(cookie).toBeDefined();
    // Not readable from client JavaScript, and not sent on a cross-site POST. An XSS cannot
    // steal what it cannot read — which is the entire reason no action returns this value.
    expect(cookie?.options.httpOnly).toBe(true);
    expect(cookie?.options.sameSite).toBe('lax');
    expect(cookie?.options.path).toBe('/');
  });

  it('writes a cookie the session module accepts back', async () => {
    await loginAction({ password: ADMIN_PASSWORD });

    // Round-trip through the real verifier: signed with the real secret, parsed by the real
    // parser. A cookie that is written but does not verify is a login that appears to work
    // and leaves every subsequent request anonymous.
    const session = await readSession();
    expect(session.status).toBe('valid');
  });

  it('omits Secure on a plain-http request and sets it behind an https proxy', async () => {
    // Derived from the REQUEST, never from NODE_ENV: a `Secure` cookie delivered over plain
    // http is silently DISCARDED by the browser, so sign-in "succeeds" and the next request
    // is anonymous — a failure that passes review because localhost is exempt.
    await loginAction({ password: ADMIN_PASSWORD });
    expect(jar.get(SESSION_COOKIE)?.options.secure).toBe(false);

    jar.clear();
    resetLoginRateLimit();
    headerBag.set('x-forwarded-proto', 'https');
    await loginAction({ password: ADMIN_PASSWORD });
    expect(jar.get(SESSION_COOKIE)?.options.secure).toBe(true);
  });

  it('takes the FIRST hop of a comma-separated x-forwarded-proto chain', async () => {
    headerBag.set('x-forwarded-proto', 'https,http');
    await loginAction({ password: ADMIN_PASSWORD });
    expect(jar.get(SESSION_COOKIE)?.options.secure).toBe(true);
  });

  it('returns the validated return path, refusing an off-site one', async () => {
    const offsite = await loginAction({
      password: ADMIN_PASSWORD,
      next: 'https://evil.example/steal',
    });
    if (!offsite.ok) throw new Error('unreachable');
    // An unchecked `?next=` makes the login form an open redirect.
    expect(offsite.data.redirectTo).toBe('/dashboard');

    jar.clear();
    resetLoginRateLimit();
    const inside = await loginAction({ password: ADMIN_PASSWORD, next: '/dashboard/projects' });
    if (!inside.ok) throw new Error('unreachable');
    expect(inside.data.redirectTo).toBe('/dashboard/projects');
  });

  it('answers 422 for a payload the form could never produce, and sets no cookie', async () => {
    const result = await loginAction({ password: 123 });

    if (result.ok) throw new Error('unreachable');
    expect(result.status).toBe(422);
    expect(result.body).toHaveProperty('password');
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });

  it('rejects an unknown key rather than tolerating it', async () => {
    const result = await loginAction({ password: ADMIN_PASSWORD, role: 'superuser' });

    expect(result.ok).toBe(false);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });
});

describe('the login rate limit', () => {
  it('answers 429 once the window of FAILURES is spent', async () => {
    for (let i = 0; i < 10; i += 1) {
      await expect(loginAction({ password: 'wrong' })).resolves.toEqual({
        ok: false,
        status: 401,
      });
    }

    const result = await loginAction({ password: 'wrong' });
    expect(result).toEqual({ ok: false, status: 429 });
  });

  it('refuses even the CORRECT password once the window is spent', async () => {
    for (let i = 0; i < 10; i += 1) await loginAction({ password: 'wrong' });

    // The limit is on attempts, not on wrongness — otherwise a guesser who eventually
    // succeeds is let straight in.
    const result = await loginAction({ password: ADMIN_PASSWORD });
    expect(result).toEqual({ ok: false, status: 429 });
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });

  it('does NOT count a successful sign-in against the window', async () => {
    for (let i = 0; i < 20; i += 1) {
      jar.clear();
      await expect(loginAction({ password: ADMIN_PASSWORD })).resolves.toMatchObject({ ok: true });
    }
    // An administrator who signs in correctly all afternoon must never be locked out of
    // their own dashboard. Only failures are recorded.
  });

  it('clears the window after a success, so a mistyped password is not rationed later', async () => {
    for (let i = 0; i < 9; i += 1) await loginAction({ password: 'wrong' });
    await loginAction({ password: ADMIN_PASSWORD });

    // Nine failures then a success. Without the clear, one more mistype would lock them out.
    for (let i = 0; i < 9; i += 1) {
      await expect(loginAction({ password: 'wrong' })).resolves.toEqual({
        ok: false,
        status: 401,
      });
    }
  });

  it('keys the limit on the FIRST address in x-forwarded-for', async () => {
    headerBag.set('x-forwarded-for', '203.0.113.9, 70.41.3.18');
    for (let i = 0; i < 10; i += 1) await loginAction({ password: 'wrong' });

    // Same client, different proxy chain: still the same window. Keying on the last entry
    // would key on the proxy and ration every visitor together.
    headerBag.set('x-forwarded-for', '203.0.113.9, 198.51.100.4');
    await expect(loginAction({ password: 'wrong' })).resolves.toEqual({ ok: false, status: 429 });

    // A genuinely different client is unaffected.
    headerBag.set('x-forwarded-for', '198.51.100.77');
    await expect(loginAction({ password: 'wrong' })).resolves.toEqual({ ok: false, status: 401 });
  });
});

describe('logoutAction', () => {
  it('deletes the cookie and redirects to the login page', async () => {
    await loginAction({ password: ADMIN_PASSWORD });
    expect(jar.has(SESSION_COOKIE)).toBe(true);

    // `redirect()` signals by throwing; the mock reproduces that.
    await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT:/dashboard/login');

    expect(jar.has(SESSION_COOKIE)).toBe(false);
    expect(redirect).toHaveBeenCalledWith('/dashboard/login');
  });

  it('is harmless when there was no session to begin with', async () => {
    // Clicking sign out twice, or a stale tab. The delete is unconditional, which is what
    // makes a half-present state recoverable rather than stuck.
    await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT:/dashboard/login');
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });
});
