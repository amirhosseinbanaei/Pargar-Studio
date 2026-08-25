// src/common/components/layout/Lat.tsx
/**
 * A Latin run inside Persian text, kept in its own direction.
 *
 * Ported from `legacy/js/ui/panel.js:47`, where it was `lat()` — a one-line helper wrapped
 * around every outlet name, email address, phone number and coordinate pair the Persian
 * pages print. The rule it triggers is already in the ported stylesheet
 * (`common/styles/i18n.css`: `html.is-fa .lat { direction: ltr; unicode-bidi: isolate }`),
 * so this component exists to NAME the intent, not to restyle anything — inventing a
 * second class for it would leave the ported rule matching nothing.
 *
 * What goes wrong without it: the bidirectional algorithm reorders a Latin run against the
 * surrounding right-to-left text at a line boundary, so "ArchDaily، ۱۴۰۳" renders with the
 * comma on the wrong side, and "+98 21 2612 4180" comes apart into two reversed halves.
 * It is a no-op in English, which is why it is safe to apply unconditionally.
 */
export interface LatProps {
  children: React.ReactNode;
}

export function Lat({ children }: LatProps) {
  return <span className="lat">{children}</span>;
}
