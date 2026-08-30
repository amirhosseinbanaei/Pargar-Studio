// src/common/components/layout/index.ts
/**
 * The site chrome: the document shell, the masthead, the footer bar, and the single client
 * boundary that owns the motion layer.
 *
 * These are `common/` and not a module because they belong to no feature — every route in
 * the site renders them, and a module that owned them would have to be imported by every
 * other module, which is exactly the inversion the layering rule exists to prevent.
 *
 * EIGHT of these carry `'use client'`, and each is a leaf with one reason:
 *   `Stage`, `SkipLink`, `LanguageSwitch`, `SectionEscape` — read the pathname
 *   `MarkStepper`  — measures a box
 *   `LiveClock`    — ticks
 *   `SiteMotion`   — owns the cursor and the preloader
 *   `ShellTransition` — drives the FLIP
 * Everything else here is a Server Component, including the one that emits 40KB of SVG.
 */
export { ColumnShell, type ColumnShellProps } from './ColumnShell';
export { Footbar, type FootbarProps } from './Footbar';
export { GlyphText, type GlyphTextProps } from './GlyphText';
export { LanguageSwitch, type LanguageSwitchProps } from './LanguageSwitch';
export { Lat, type LatProps } from './Lat';
export { LiveClock, type LiveClockProps } from './LiveClock';
export { MarkStepper, type MarkStepperProps } from './MarkStepper';
export { Masthead, type MastheadProps } from './Masthead';
export { SectionEscape, type SectionEscapeProps } from './SectionEscape';
export { ShellTransition, type ShellStrings, type ShellTransitionProps } from './ShellTransition';
export { SkipLink, type SkipLinkProps } from './SkipLink';
export { SiteMotion, useCursor, useSmoothScroll, type SiteMotionProps } from './SiteMotion';
export { Stage, sectionSegment, type StageProps } from './Stage';
export { TehranClock, type TehranClockProps } from './TehranClock';
