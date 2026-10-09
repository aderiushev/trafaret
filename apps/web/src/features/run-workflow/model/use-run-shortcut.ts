import { useEffect, useEffectEvent } from 'react';

/** ⌘/Ctrl + Enter runs the workflow from anywhere on the page, even while typing a prompt. */
export function useRunShortcut(run: () => void): void {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    // A held key repeats ~30 times a second, and a fully reused run ends within a second: one press, one run.
    if (event.repeat) return;
    run();
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}
