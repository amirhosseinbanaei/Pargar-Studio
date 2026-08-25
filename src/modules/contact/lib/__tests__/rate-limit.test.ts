// @vitest-environment node
/**
 * The window over the contact form. Three properties matter and each has a failure that is
 * invisible until somebody floods the inbox.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { rateLimit, resetRateLimit } from '../rate-limit';

const MAX = 5;
const WINDOW_MS = 10 * 60 * 1000;
const NOW = 1_700_000_000_000;

beforeEach(() => resetRateLimit());

describe('rateLimit', () => {
  it('allows up to the limit and refuses the next', () => {
    for (let i = 0; i < MAX; i += 1) {
      expect(rateLimit('1.2.3.4', NOW).allowed).toBe(true);
    }
    expect(rateLimit('1.2.3.4', NOW)).toEqual({ allowed: false, remaining: 0 });
  });

  it('counts each key separately', () => {
    for (let i = 0; i < MAX; i += 1) rateLimit('1.2.3.4', NOW);
    // One visitor being noisy must not lock out everyone else behind a different address.
    expect(rateLimit('5.6.7.8', NOW).allowed).toBe(true);
  });

  it('SLIDES: an attempt outside the window no longer counts', () => {
    for (let i = 0; i < MAX; i += 1) rateLimit('1.2.3.4', NOW);
    expect(rateLimit('1.2.3.4', NOW + WINDOW_MS + 1).allowed).toBe(true);
  });

  it('does not record a REFUSED attempt', () => {
    // If a rejected attempt extended the window, a reader who hit the limit once could
    // never get back in by waiting — every retry would push the boundary forward.
    for (let i = 0; i < MAX; i += 1) rateLimit('1.2.3.4', NOW);
    rateLimit('1.2.3.4', NOW + 1000);
    rateLimit('1.2.3.4', NOW + 2000);
    // The window is measured from the ALLOWED attempts, all of which sit at NOW.
    expect(rateLimit('1.2.3.4', NOW + WINDOW_MS + 1).allowed).toBe(true);
  });

  it('reports how many remain', () => {
    expect(rateLimit('1.2.3.4', NOW).remaining).toBe(MAX - 1);
    expect(rateLimit('1.2.3.4', NOW).remaining).toBe(MAX - 2);
  });
});
