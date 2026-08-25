// src/common/components/collection/SpecRow.tsx
/**
 * One row of a specification table — the label on the start edge, the value on the end.
 *
 * PROMOTED IN PROMPT 5 out of `modules/projects/components/ProjectDetail.tsx`. All three
 * detail pages print the same table (`legacy/js/ui/panel.js:82` built one `row()` for
 * every section), and the rule that a blank value prints NOTHING rather than an empty
 * line is the part worth having in one place: three copies is three chances for one of
 * them to render `Client —` for a work that has no client.
 *
 * `value` is a ReactNode, not a string, because a media outlet arrives wrapped in `<Lat>`
 * so it keeps its own direction inside Persian text.
 */
export interface SpecRowProps {
  label: string;
  /** Falsy or an empty string renders nothing at all. */
  value: React.ReactNode;
}

export function SpecRow({ label, value }: SpecRowProps) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="spec__row">
      <span className="spec__k">{label}</span>
      <span className="spec__v">{value}</span>
    </div>
  );
}
