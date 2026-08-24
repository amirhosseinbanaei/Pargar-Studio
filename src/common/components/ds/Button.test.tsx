import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('has no axe violations in its default and loading states', async () => {
    const { container } = render(
      <>
        <Button>Save</Button>
        <Button loading>Saving</Button>
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is disabled while loading, so a double-submit is impossible', () => {
    render(<Button loading>Saving</Button>);
    expect(screen.getByRole('button', { name: 'Saving' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Saving' })).toHaveAttribute('aria-busy', 'true');
  });

  it('defaults to type="button" so it cannot submit a form it merely sits in', () => {
    render(<Button>Filter</Button>);
    expect(screen.getByRole('button', { name: 'Filter' })).toHaveAttribute('type', 'button');
  });

  it('merges the caller className LAST, so an override actually wins', () => {
    render(<Button className="h-12">Tall</Button>);
    const button = screen.getByRole('button', { name: 'Tall' });
    expect(button.className).toContain('h-12');
    expect(button.className).not.toContain('h-control');
  });

  it('asChild renders the child element instead of nesting <a> inside <button>', () => {
    const { container } = render(
      <Button asChild>
        <a href="/projects">Projects</a>
      </Button>,
    );
    expect(container.querySelector('button')).toBeNull();
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects');
  });
});
