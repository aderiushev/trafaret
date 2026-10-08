import { describe, expect, it } from 'vitest';
import { PORT_TYPES } from './ports.ts';

describe('PORT_TYPES', () => {
  it('has exactly the two port types from the brief', () => {
    expect(PORT_TYPES).toEqual(['text', 'image']);
  });
});
