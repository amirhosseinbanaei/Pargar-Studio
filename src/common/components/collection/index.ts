/**
 * COLLECTION PRIMITIVES — the pieces every list-and-detail section is built from.
 *
 * Three modules render the same two screens against different records: `projects`,
 * `design` and `media`. What they share sits here rather than being imported sideways,
 * which lint bans and which would make any one of the three undeletable. What they do NOT
 * share — the card, the screen, the detail page, the field set — stays in the module,
 * because those differ in exactly the ways the sections differ.
 *
 * The line: a piece belongs here when its BEHAVIOUR is shared (the reveal observer, the
 * seed arithmetic, the empty-value rule), not merely when its markup rhymes.
 */
export { BackLink, type BackLinkProps } from './BackLink';
export { CardReveal } from './CardReveal';
export { DetailPlates, type DetailPlatesProps } from './DetailPlates';
export { SpecRow, type SpecRowProps } from './SpecRow';
