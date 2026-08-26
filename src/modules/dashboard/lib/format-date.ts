// src/modules/dashboard/lib/format-date.ts
/**
 * One formatter for the one place this module prints a timestamp to a human — the messages
 * inbox. The dashboard's interface language is English (AGENTS.md), so this is not locale-
 * aware the way the public site's `common/i18n/tehran-time.ts` is; that module formats a
 * clock for a bilingual visitor, this one is a label for the one administrator.
 */
export function formatReceivedAt(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
