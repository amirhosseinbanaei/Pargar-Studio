import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';
import { Input } from './Input';

describe('Field', () => {
  it('has no axe violations across label, description and error', async () => {
    const { container } = render(
      <>
        <Field label="Title" description="Shown on the project card">
          {aria => <Input {...aria} />}
        </Field>
        <Field label="Slug" error="Already taken" required>
          {aria => <Input {...aria} />}
        </Field>
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('binds the label to the control it generated an id for', () => {
    render(<Field label="Title">{aria => <Input {...aria} />}</Field>);
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
  });

  it('points aria-describedby at BOTH the description and the message', () => {
    render(
      <Field label="Slug" description="Lowercase and hyphens" error="Already taken">
        {aria => <Input {...aria} />}
      </Field>,
    );
    const input = screen.getByLabelText(/Slug/);
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
    expect(ids).toHaveLength(2);
    for (const id of ids) expect(document.getElementById(id)).toBeInTheDocument();
  });

  it('renders NOTHING for the message when there is no error, rather than an empty box', () => {
    const { container } = render(<Field label="Title">{aria => <Input {...aria} />}</Field>);
    expect(container.querySelector('p')).toBeNull();
  });

  it('announces "required" in words, not only with an asterisk glyph', () => {
    render(
      <Field label="Title" required>
        {aria => <Input {...aria} />}
      </Field>,
    );
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('(required)', { exact: false })).toHaveClass('sr-only');
    expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
  });
});
