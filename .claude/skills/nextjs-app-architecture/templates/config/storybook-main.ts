// Target path in a real project: <repo-root>/.storybook/main.ts
import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  // Stories live BESIDE the component they document (`Button.stories.tsx` next to
  // `Button.tsx`), with page/flow-level compositions in `src/common/stories/`. A single
  // recursive glob is what makes that possible — do not list folders individually, or
  // adding a story becomes a two-file change and half of them are silently never built.
  stories: ['../src/**/*.stories.@(ts|tsx)'],

  addons: [
    '@storybook/addon-docs', // autodocs from the JSDoc above `meta` and from prop types
    '@storybook/addon-a11y', // axe per story — see the `test: 'error'` setting in preview
  ],

  // The framework preset wires the app's bundler, path aliases, CSS pipeline, font
  // handling and image component. Without it, `@/…` imports fail to resolve inside
  // stories and every story that renders an optimized image throws.
  framework: { name: '@storybook/nextjs', options: {} },

  // Serves the same static assets as the app, so a story referencing `/logo.svg` shows
  // the real asset instead of a broken image.
  staticDirs: ['../public'],
};

export default config;
