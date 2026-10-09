import { describe, expect, it } from 'vitest';
import { freePosition } from './free-position';

const size = { width: 264, height: 240 };

describe('freePosition', () => {
  it('uses the desired spot when nothing is in the way', () => {
    expect(freePosition({ x: 100, y: 100 }, size, [])).toEqual({ x: 100, y: 100 });
    expect(freePosition({ x: 100, y: 100 }, size, [{ x: 400, y: 100, width: 264, height: 300 }])).toEqual({
      x: 100,
      y: 100,
    });
  });

  it('steps down and to the right until the new node clears the cards in the way', () => {
    const card = { x: 80, y: 80, width: 264, height: 300 };
    expect(freePosition({ x: 100, y: 100 }, size, [card])).toEqual({ x: 388, y: 388 });
  });

  it('gives up on a canvas too crowded to find room', () => {
    const wall = { x: -10_000, y: -10_000, width: 20_000, height: 20_000 };
    expect(freePosition({ x: 100, y: 100 }, size, [wall])).toEqual({ x: 100, y: 100 });
  });
});
