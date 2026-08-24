import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from './Checkbox';

describe('Checkbox', () => {
  it('has no axe violations, labelled and unlabelled', async () => {
    const { container } = render(
      <>
        <Checkbox label="Published" />
        <Checkbox aria-label="Featured" />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('binds its label to the control, so clicking the TEXT toggles the box', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Published" onCheckedChange={onCheckedChange} />);
    await user.click(screen.getByText('Published'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('keeps a caller-supplied id, so a form wrapper stays bound to its own', () => {
    render(<Checkbox id="published-field" label="Published" />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('id', 'published-field');
  });

  it('sets aria-invalid from `error`', () => {
    render(<Checkbox aria-label="Terms" error="Required" />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
  });
});
