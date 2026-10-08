import { describe, expect, it } from 'vitest';
import { canonicalJson } from './canonical-json.ts';

describe('canonicalJson', () => {
  it('sorts object keys recursively', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [{ f: 1, e: 0 }] } })).toBe(
      '{"a":{"c":[{"e":0,"f":1}],"d":2},"b":1}',
    );
  });

  it('produces the same string for equal values written in a different order', () => {
    expect(canonicalJson({ x: 1, y: [1, 2] })).toBe(canonicalJson({ y: [1, 2], x: 1 }));
  });

  it('drops undefined properties', () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });
});
