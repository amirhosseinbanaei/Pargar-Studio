// Target path in a real project: <repo-root>/.storybook/preview.tsx
import type { Decorator, Preview } from '@storybook/nextjs';
// The app's real stylesheet — theme tokens, base layer, utilities. Without it every
// story renders unstyled, and reviewers start "fixing" components that are fine.
import '../src/app/globals.css';

/**
 * Writing-direction toggle.
 *
 * Absolutely-positioned slot icons, chevrons, popover alignment, and any hardcoded
 * `left`/`right` are the usual direction breakages — and they are INVISIBLE if stories
 * only ever render one direction. The toolbar control makes both a one-click check.
 *
 * Locale-sensitive: set `defaultValue` below to your app's primary direction, and give
 * `lang` a value that matches, so font stacks and locale-aware formatting resolve the way
 * they will in production.
 */
const withDirection: Decorator = (Story, context) => {
  const dir: 'ltr' | 'rtl' = context.globals.direction === 'rtl' ? 'rtl' : 'ltr';
  return (
    <div dir={dir} lang={dir === 'rtl' ? 'ar' : 'en'} style={{ padding: '1.5rem' }}>
      <Story />
    </div>
  );
};

const preview: Preview = {
  parameters: {
    // Infers color/date controls from prop names so the Controls panel is useful without
    // hand-writing `argTypes` for every component.
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },

    // Accessibility violations FAIL the story rather than annotating a panel. A panel is
    // not a gate: nobody opens one in CI, so violations ship. This is the workshop half —
    // the CI half is a jest-axe assertion in the test suite (see test-setup.ts).
    a11y: { test: 'error' },
  },

  globalTypes: {
    direction: {
      description: 'Writing direction',
      defaultValue: 'ltr', // set to your app's primary direction
      toolbar: {
        title: 'Direction',
        icon: 'transfer',
        items: [
          { value: 'ltr', title: 'LTR' },
          { value: 'rtl', title: 'RTL' },
        ],
        dynamicTitle: true,
      },
    },
  },

  decorators: [withDirection],
};

export default preview;
