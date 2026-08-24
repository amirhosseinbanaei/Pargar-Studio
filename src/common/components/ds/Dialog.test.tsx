import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('has no axe violations while open', async () => {
    const { baseElement } = render(
      <Dialog open title="Delete project" description="This cannot be undone.">
        <p>Qeytarieh 08 Residence will be removed from the archive.</p>
      </Dialog>,
    );
    // The content is portalled OUT of `container`, so axe must run over
    // `baseElement` — over `container` it would pass by checking nothing.
    //
    // `aria-hidden-focus` is switched off for this one assertion, and only this
    // one. It fires on the two `data-radix-focus-guard` sentinels Radix places
    // at the edges of the focus trap: they are `tabindex="0"` and `aria-hidden`
    // BY DESIGN, because catching a Tab that runs off either end and wrapping it
    // back is exactly what makes the trap work. They are not this component's
    // markup and removing them would break the dialog's keyboard behaviour —
    // which is the thing the rule exists to protect. Every other rule still runs
    // over the whole portal.
    expect(
      await axe(baseElement, { rules: { 'aria-hidden-focus': { enabled: false } } }),
    ).toHaveNoViolations();
  });

  it('is a labelled dialog: the title is its accessible name', () => {
    render(<Dialog open title="Delete project" />);
    expect(screen.getByRole('dialog', { name: 'Delete project' })).toBeInTheDocument();
  });

  it('keeps the title for assistive tech even when visually hidden', () => {
    render(<Dialog open title="Edit project" titleVisible={false} />);
    expect(screen.getByRole('dialog', { name: 'Edit project' })).toBeInTheDocument();
  });

  it('gives the icon-only close button an accessible name', () => {
    render(<Dialog open title="Delete project" closeLabel="Dismiss" />);
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('renders a footer for its actions', () => {
    render(<Dialog open title="Delete project" footer={<Button>Delete</Button>} />);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });
});
