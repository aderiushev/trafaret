import type { XYPosition } from '@xyflow/react';

export type Rect = XYPosition & { width: number; height: number };

const STEP = 48;
const MAX_STEPS = 40;
const GAP = 24;

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width + GAP &&
  b.x < a.x + a.width + GAP &&
  a.y < b.y + b.height + GAP &&
  b.y < a.y + a.height + GAP;

/**
 * `desired`, or the first spot down and to the right of it where a node of `size` overlaps no other node.
 * On a canvas too crowded for that it gives up and returns `desired`.
 */
export function freePosition(
  desired: XYPosition,
  size: { width: number; height: number },
  taken: readonly Rect[],
): XYPosition {
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const spot = { x: desired.x + step * STEP, y: desired.y + step * STEP };
    if (!taken.some((rect) => overlaps({ ...spot, ...size }, rect))) return spot;
  }
  return desired;
}
