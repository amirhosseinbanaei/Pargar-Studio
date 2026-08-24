import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Select } from './Select';

const OPTIONS = [
  { value: 'built', label: 'Built' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'competition', label: 'Competition', disabled: true },
];

describe('Select', () => {
  it('has no axe violations on the closed trigger', async () => {
    // The listbox is PORTALLED and only mounts on open, so the closed trigger is
    // what CI can check cheaply — and `triggerProps` is the component's channel
    // for giving that trigger an accessible name.
    const { container } = render(
      <Select options={OPTIONS} placeholder="Status" triggerProps={{ 'aria-label': 'Status' }} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('names the trigger through triggerProps, so it is not an unlabelled combobox', () => {
    render(<Select options={OPTIONS} triggerProps={{ 'aria-label': 'Status' }} />);
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument();
  });

  it('shows the placeholder when nothing is selected', () => {
    render(
      <Select
        options={OPTIONS}
        placeholder="Any status"
        triggerProps={{ 'aria-label': 'Status' }}
      />,
    );
    expect(screen.getByRole('combobox')).toHaveTextContent('Any status');
  });

  it('renders the selected option label, not its value', () => {
    render(<Select value="ongoing" options={OPTIONS} triggerProps={{ 'aria-label': 'Status' }} />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Ongoing');
  });

  it('sets aria-invalid from `error`', () => {
    render(<Select options={OPTIONS} error="Pick one" triggerProps={{ 'aria-label': 'Status' }} />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
  });
});
