import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Broken(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('shows a way back instead of a blank page', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something broke.');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
