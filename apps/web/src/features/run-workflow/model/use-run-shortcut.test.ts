import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRunShortcut } from './use-run-shortcut';

describe('useRunShortcut', () => {
  it('runs on ⌘ + Enter and on Ctrl + Enter', () => {
    const run = vi.fn();
    renderHook(() => useRunShortcut(run));
    fireEvent.keyDown(window, { key: 'Enter', metaKey: true });
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('runs once for a held shortcut: key repeats are ignored', () => {
    const run = vi.fn();
    renderHook(() => useRunShortcut(run));
    fireEvent.keyDown(window, { key: 'Enter', metaKey: true });
    fireEvent.keyDown(window, { key: 'Enter', metaKey: true, repeat: true });
    fireEvent.keyDown(window, { key: 'Enter', metaKey: true, repeat: true });
    expect(run).toHaveBeenCalledOnce();
  });
});
