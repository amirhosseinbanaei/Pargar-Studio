import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('has no axe violations when labelled, in default and error states', async () => {
    const { container } = render(
      <>
        <Field label="Blurb">{aria => <Textarea {...aria} />}</Field>
        <Field label="Description" error="Too long">
          {aria => <Textarea {...aria} error="Too long" />}
        </Field>
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('sets aria-invalid from `error`', () => {
    render(<Textarea aria-label="Blurb" error="Too long" />);
    expect(screen.getByLabelText('Blurb')).toHaveAttribute('aria-invalid', 'true');
  });
});
