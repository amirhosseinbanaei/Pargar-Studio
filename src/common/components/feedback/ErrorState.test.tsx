import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import type { NormalizedError } from '@/common/errors';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';
import { TableSkeleton } from '@/common/components/loader';

const ERROR: NormalizedError = {
  status: 422,
  code: 'validation_failed',
  message: 'That slug is already in use.',
  fieldErrors: { slug: 'Already taken' },
};

describe('ErrorState', () => {
  it('has no axe violations, with and without a retry', async () => {
    const { container } = render(
      <>
        <ErrorState error={ERROR} title="Projects could not be saved" />
        <ErrorState error={ERROR} onRetry={() => {}} />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is an alert, so a failure ANNOUNCES itself instead of silently changing the screen', () => {
    render(<ErrorState error={ERROR} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders the normalized shape: message, field errors, status and code', () => {
    render(<ErrorState error={ERROR} title="Projects could not be saved" />);
    expect(screen.getByText('Projects could not be saved')).toBeInTheDocument();
    expect(screen.getByText('That slug is already in use.')).toBeInTheDocument();
    expect(screen.getByText('Already taken')).toBeInTheDocument();
    expect(screen.getByText(/Error 422/)).toHaveTextContent('validation_failed');
  });

  it('says "Network error" for status 0, which means no response ever arrived', () => {
    render(
      <ErrorState
        error={{ status: 0, code: null, message: 'Could not reach the server.', fieldErrors: {} }}
      />,
    );
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('falls back to the generic message when there is no error object at all', () => {
    render(<ErrorState />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading')).toHaveTextContent('Something went wrong');
  });

  it('calls onRetry when the retry button is pressed', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState error={ERROR} onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows no retry button when no handler is given, rather than a dead one', () => {
    render(<ErrorState error={ERROR} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('LoadingState', () => {
  it('has no axe violations wrapping a shape-matched skeleton', async () => {
    const { container } = render(
      <LoadingState label="Loading projects">
        <TableSkeleton columns={3} rows={4} />
      </LoadingState>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('is a polite status, so a non-visual user is not left in silence during a load', () => {
    render(<LoadingState />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('hides the skeleton boxes from assistive tech, which the status already covers', () => {
    const { container } = render(
      <LoadingState>
        <TableSkeleton />
      </LoadingState>,
    );
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});
