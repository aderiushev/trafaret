import { describe, expect, it } from 'vitest';
import { branchingGraph } from '@trafaret/core/testing';
import { layoutByDepth } from './auto-layout';

describe('layoutByDepth', () => {
  it('puts each node one column right of its inputs, stacking siblings', () => {
    const positions = layoutByDepth(branchingGraph());
    expect(positions.get('prompt')).toEqual({ x: 0, y: 0 });
    expect(positions.get('gen-a')).toEqual({ x: 340, y: 0 });
    expect(positions.get('gen-b')).toEqual({ x: 340, y: 260 });
    expect(positions.get('result-a')).toEqual({ x: 680, y: 0 });
    expect(positions.get('result-b')).toEqual({ x: 680, y: 260 });
  });
});
