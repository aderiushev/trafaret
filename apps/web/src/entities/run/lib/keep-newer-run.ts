import { replaceEqualDeep } from '@tanstack/react-query';
import type { Run } from '@trafaret/core';

/**
 * Responses can overtake each other, so an older snapshot of a run never replaces a newer one. A newer snapshot
 * keeps the objects that did not change, so only the nodes whose job changed re-render.
 */
export function keepNewerRun(previous: Run | undefined, next: Run): Run {
  if (previous?.id === next.id && previous.version > next.version) return previous;
  return replaceEqualDeep(previous, next);
}
