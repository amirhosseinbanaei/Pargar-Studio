// @vitest-environment node
/**
 * The page-level gate, and the rule that every dashboard page uses it.
 *
 * ─── THE BUG THIS PINS ────────────────────────────────────────────────────────────
 * Found during prompt 6's own verification, with `curl` rather than a browser. A request to
 * `/dashboard/projects` carrying a FORGED session cookie came back 200 with all 76 project
 * rows in the RSC payload, alongside `NEXT_REDIRECT;replace;/dashboard/login`.
 *
 * The cause is that a layout and the page inside it render CONCURRENTLY: the `(shell)`
 * layout's `redirect()` fired, and the page had already awaited its service call and
 * produced its payload. The client router honours the redirect, so nobody ever SEES that
 * screen — the bytes still went over the wire.
 *
 * For projects the exposure is nil, because every one of those rows is already public at
 * `/en/projects`. That is luck. Prompt 7 puts `contact_messages` — an inbox of messages
 * strangers sent the studio — behind the same chrome, and the identical pattern there leaks
 * something that has never been public.
 *
 * So there are two tests here, and the second matters more than the first: one asserts the
 * helper redirects, and one asserts every dashboard page actually CALLS it. A helper nobody
 * calls is the shape this bug takes when it comes back.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const readSession = vi.fn();
vi.mock('@/common/services/session', () => ({ readSession: () => readSession() }));

const redirect = vi.fn((path: string) => {
  // `redirect()` signals by THROWING. A mock that returned normally would let a bug where
  // the redirect never fires pass silently — the page would carry on to its read.
  throw new Error(`NEXT_REDIRECT:${path}`);
});
vi.mock('next/navigation', () => ({ redirect: (path: string) => redirect(path) }));

const { requireDashboardSession } = await import('../lib/require-session');

beforeEach(() => vi.clearAllMocks());

describe('requireDashboardSession', () => {
  it('returns the session when it is valid, so the page may read', async () => {
    const session = { sub: 'admin' as const, iat: 1, exp: 2 };
    readSession.mockResolvedValue({ status: 'valid', session });

    await expect(requireDashboardSession()).resolves.toEqual(session);
    expect(redirect).not.toHaveBeenCalled();
  });

  /**
   * Every non-valid status, because they must all redirect. A cookie that is present but
   * expired or forged is the case the proxy structurally cannot catch — it only checks
   * presence — so if any of these fell through, that is precisely the request that would
   * reach the read.
   */
  const refused = [
    { status: 'anonymous' },
    { status: 'expired' },
    { status: 'invalid', reason: 'bad-signature' },
    { status: 'invalid', reason: 'malformed' },
  ] as const;

  for (const session of refused) {
    it(`redirects, by throwing, on a ${session.status} session`, async () => {
      readSession.mockResolvedValue(session);

      // The THROW is the assertion. If it resolved, the calling page would continue to its
      // service call and put the answer in the payload.
      await expect(requireDashboardSession()).rejects.toThrow('NEXT_REDIRECT:/dashboard/login');
      expect(redirect).toHaveBeenCalledWith('/dashboard/login');
    });
  }
});

describe('every dashboard page calls it', () => {
  const PAGES_ROOT = 'src/app/(dashboard)';

  /** Every `page.tsx` under the dashboard route group. */
  const pages = (function walk(dir: string): string[] {
    return readdirSync(dir).flatMap(entry => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return walk(path);
      return entry === 'page.tsx' ? [path] : [];
    });
  })(PAGES_ROOT);

  it('finds the pages at all, so this suite cannot pass by scanning nothing', () => {
    // Without this, a moved route folder turns the loop below into zero assertions and the
    // whole guard reports green while checking nothing.
    expect(pages.length).toBeGreaterThanOrEqual(4);
  });

  for (const page of pages) {
    // The login page is the one route inside the private prefix that an anonymous visitor
    // MUST reach. It does its own `readSession()` for the opposite purpose — bouncing a
    // visitor who is ALREADY signed in — and gating it would be a redirect loop.
    const isLogin = page.includes(join('dashboard', 'login'));

    it(`${page} ${isLogin ? 'is the login page and correctly does not gate' : 'awaits requireDashboardSession'}`, () => {
      const source = readFileSync(page, 'utf8');
      expect(source.includes('requireDashboardSession')).toBe(!isLogin);
    });
  }
});
