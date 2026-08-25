// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, isLocale, localeHref, resolveLocale, switchLocale } from '../routing';

describe('localeHref', () => {
  it('prefixes a path', () => {
    expect(localeHref('fa', '/projects')).toBe('/fa/projects');
  });

  it('produces a bare prefix for the index, not a trailing slash', () => {
    // `/en/` and `/en` are two URLs for one page.
    expect(localeHref('en')).toBe('/en');
    expect(localeHref('en', '/')).toBe('/en');
  });
});

describe('switchLocale', () => {
  it('swaps the prefix and keeps everything after it', () => {
    expect(switchLocale('/en/projects/qeytarieh-08-residence', 'fa')).toBe(
      '/fa/projects/qeytarieh-08-residence',
    );
  });

  it('prefixes a path that carries no locale', () => {
    expect(switchLocale('/projects', 'fa')).toBe('/fa/projects');
  });

  it('handles the index', () => {
    expect(switchLocale('/en', 'fa')).toBe('/fa');
  });
});

describe('resolveLocale', () => {
  it('honours a Persian browser, as navigator.language did', () => {
    expect(resolveLocale('fa-IR,fa;q=0.9,en;q=0.8')).toBe('fa');
    expect(resolveLocale('fa')).toBe('fa');
    // `pe` is the obsolete tag for Persian and is still emitted.
    expect(resolveLocale('pe-IR')).toBe('fa');
  });

  it('respects quality order rather than document order', () => {
    expect(resolveLocale('en;q=0.2,fa;q=0.9')).toBe('fa');
    expect(resolveLocale('fa;q=0.2,en;q=0.9')).toBe('en');
  });

  it('ignores a range explicitly refused with q=0', () => {
    expect(resolveLocale('fa;q=0,en')).toBe('en');
  });

  it('returns null rather than a guess when nothing matches', () => {
    // The caller falls back to DEFAULT_LOCALE; conflating the two would hide the case
    // where a reader asked for a language the site does not have.
    expect(resolveLocale('de-DE,de;q=0.9')).toBeNull();
    expect(resolveLocale(null)).toBeNull();
    expect(resolveLocale('')).toBeNull();
  });

  it('does not match a language that merely starts with the same letters', () => {
    expect(resolveLocale('fan')).toBeNull();
  });
});

describe('isLocale / DEFAULT_LOCALE', () => {
  it('narrows an arbitrary segment', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fa')).toBe(true);
    expect(isLocale('projects')).toBe(false);
  });

  it('defaults to English, matching legacy/js/core/i18n.js:97', () => {
    expect(DEFAULT_LOCALE).toBe('en');
  });
});
