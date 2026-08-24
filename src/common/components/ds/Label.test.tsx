import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Label } from './Label';

describe('Label', () => {
  it('has no axe violations when bound to a control', async () => {
    const { container } = render(
      <>
        <Label htmlFor="title">Title</Label>
        <input id="title" />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('hides the asterisk from assistive tech and spells the word out instead', () => {
    render(
      <>
        <Label htmlFor="slug" required>
          Slug
        </Label>
        <input id="slug" />
      </>,
    );
    // The glyph is decoration and must not be read out…
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
    // …and the word is what carries the meaning, visually hidden but present.
    // Asserted on the label's own content rather than through `getByLabelText`:
    // that query reads the label's raw textContent, asterisk included, so it
    // would be testing the string concatenation and not the a11y behaviour.
    const required = screen.getByText('(required)', { exact: false });
    expect(required).toHaveClass('sr-only');
    expect(screen.getByLabelText(/Slug/)).toBeInTheDocument();
  });
});
