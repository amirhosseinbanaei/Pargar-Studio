import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { Form } from './Form';
import { FormButton } from './FormButton';
import { FormCheckbox } from './FormCheckbox';
import { FormInput } from './FormInput';
import { FormSelect } from './FormSelect';
import { FormTextarea } from './FormTextarea';

interface Values {
  title: string;
  status: string;
  blurb: string;
  published: boolean;
}

const EMPTY: Values = { title: '', status: '', blurb: '', published: false };
const STATUS = [
  { value: 'built', label: 'Built' },
  { value: 'ongoing', label: 'Ongoing' },
];

function Harness({
  onSubmit = vi.fn(),
  defaultValues = EMPTY,
}: {
  onSubmit?: (v: Values) => void;
  defaultValues?: Values;
}) {
  const form = useForm<Values>({ defaultValues, mode: 'onChange' });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormInput<Values> name="title" label="Title" description="Shown on the card" required />
        <FormSelect<Values> name="status" label="Status" options={STATUS} placeholder="Any" />
        <FormTextarea<Values> name="blurb" label="Blurb" />
        <FormCheckbox<Values> name="published" label="Published" />
        <FormButton>Save</FormButton>
      </form>
    </Form>
  );
}

describe('the form tier', () => {
  it('has no axe violations across every bound control', async () => {
    const { container } = render(<Harness />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('labels every control through its own generated id', () => {
    render(<Harness />);
    expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Blurb/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Status/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Published')).toBeInTheDocument();
  });

  it('points a control at its description through aria-describedby', () => {
    render(<Harness />);
    const input = screen.getByLabelText(/Title/);
    const id = input.getAttribute('aria-describedby');
    expect(id).toBeTruthy();
    expect(document.getElementById(id!.split(' ')[0])).toHaveTextContent('Shown on the card');
  });

  it('keeps inputs CONTROLLED from mount — never handed undefined', () => {
    render(<Harness />);
    // An empty string is a controlled "nothing yet". `undefined` would mount the
    // input uncontrolled and flip it on the first reset, which React warns about.
    expect(screen.getByLabelText(/Title/)).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: 'Published' })).toHaveAttribute(
      'data-state',
      'unchecked',
    );
  });

  it('disables submit on a pristine form, so an untouched form cannot post', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('enables submit once the form is dirty and valid, and submits the values', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/Title/), 'Qeytarieh 08');
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeEnabled();

    await user.click(save);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ title: 'Qeytarieh 08' });
  });

  it('binds a checkbox through onCheckedChange, not onChange', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/Title/), 'X');
    await user.click(screen.getByText('Published'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit.mock.calls[0][0]).toMatchObject({ published: true });
  });
});
