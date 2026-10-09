import { describe, expect, it } from 'vitest';
import { PORT_TYPES } from './ports.ts';

describe('PORT_TYPES', () => {
  it('has exactly two port types, text and image', () => {
    expect(PORT_TYPES).toEqual(['text', 'image']);
  });
});
