import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from './Toaster';
import { toast, useToastStore } from './toast-store';

afterEach(() => {
  vi.useRealTimers();
  useToastStore.setState({ toasts: [] });
});

describe('Toaster', () => {
  it('announces an error with its details', () => {
    render(<Toaster />);
    act(() => toast.error('Fix 2 issues to run.', ['Add a Generate Image node.']));
    expect(screen.getByRole('alert')).toHaveTextContent('Fix 2 issues to run.');
    expect(screen.getByRole('alert')).toHaveTextContent('Add a Generate Image node.');
  });

  it('can be dismissed', async () => {
    render(<Toaster />);
    act(() => toast.info('Workflow imported.'));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('goes away by itself', () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => toast.info('Workflow imported.'));
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps an error until it is dismissed', () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => toast.error("Couldn't read that file.", ['Choose the file again.']));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't read that file.");
  });

  it('keeps at most three on screen', () => {
    render(<Toaster />);
    act(() => ['one', 'two', 'three', 'four'].forEach((title) => toast.info(title)));
    expect(screen.getAllByRole('status').map((element) => element.textContent)).toEqual([
      'two×',
      'three×',
      'four×',
    ]);
  });
});
