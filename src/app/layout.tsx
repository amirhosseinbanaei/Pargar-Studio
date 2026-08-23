/**
 * PLACEHOLDER. Prompt 4 replaces this file with the real document shell — the five-column
 * layout, the language attribute driven by the locale, the head chrome that currently
 * lives inline in `legacy/index.html`.
 *
 * It exists now for exactly one reason: `npm run build` is not a meaningful gate without a
 * route to build, and the token layer is not proven live until something renders on it.
 * Nothing here is worth carrying forward — do not grow it.
 */
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kavan Studio',
  // Dark-only: the canvas is #0c0b0a and there is no light theme. Declaring it here means
  // the browser paints form controls and scrollbars to match before first paint.
  other: { 'color-scheme': 'dark' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
