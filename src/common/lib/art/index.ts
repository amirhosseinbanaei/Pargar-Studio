// src/common/lib/art/index.ts
/**
 * The generated-artwork layer. The site has zero image files; everything you
 * see is emitted from here as an SVG string built from a project's slug.
 *
 * SERVER-SAFE BY CONTRACT. Nothing in this folder touches `document`,
 * `window`, `Date` or `Math.random`, which is what lets a React Server
 * Component call `draw()` and render the result with
 * `dangerouslySetInnerHTML`: the markup becomes part of the cached HTML, no
 * generator JavaScript reaches the browser, there is no hydration cost and no
 * layout shift. Adding 'use client' to any file here would undo all of that at
 * once, silently.
 */
export { hash, rng, n, type Rng } from './rng';
export {
  palette,
  mix,
  shade,
  MATERIALS,
  SKIES,
  type Material,
  type Sky,
  type Palette,
} from './palette';
export {
  elevation,
  massing,
  court,
  section,
  plan,
  screen,
  contour,
  portrait,
  draw,
  drawingSet,
  kindFor,
  KIND_NAMES,
  type DrawKind,
  type ProjectKind,
  type Generator,
} from './draw';
