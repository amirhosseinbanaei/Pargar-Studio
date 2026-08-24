import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Input } from './Input';
import { Field } from './Field';

describe('Input', () => {
  it('has no axe violations when labelled through Field, in default and error states', async () => {
    const { container } = render(
      <>
        <Field label="Title">{aria => <Input {...aria} defaultValue="Qeytarieh 08" />}</Field>
        <Field label="Slug" error="Already taken">
          {aria => <Input {...aria} error="Already taken" defaultValue="q-08" />}
        </Field>
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('sets aria-invalid from `error`, so styling and a11y state cannot drift apart', () => {
    render(<Input aria-label="Slug" error="Already taken" />);
    expect(screen.getByLabelText('Slug')).toHaveAttribute('aria-invalid', 'true');
  });

  it('leaves aria-invalid off when there is no error', () => {
    render(<Input aria-label="Slug" />);
    expect(screen.getByLabelText('Slug')).not.toHaveAttribute('aria-invalid');
  });

  it('pads for a leading icon on the INLINE start, so RTL mirrors without a second rule', () => {
    render(<Input aria-label="Search" slots={{ leftIcon: <span>i</span> }} />);
    expect(screen.getByLabelText('Search').className).toContain('ps-9');
  });
});
