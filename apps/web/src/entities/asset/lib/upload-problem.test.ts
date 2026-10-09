import { describe, expect, it } from 'vitest';
import { uploadProblem } from './upload-problem';

describe('uploadProblem', () => {
  it('accepts PNG, JPEG and WebP images', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(uploadProblem(new File(['x'], 'photo', { type }))).toBeNull();
    }
  });

  it('refuses other formats with the same words as the server', () => {
    const gif = new File(['x'], 'cat.gif', { type: 'image/gif' });
    expect(uploadProblem(gif)).toBe('Only PNG, JPEG and WebP images are supported.');
  });

  it('refuses files over 10 MB', () => {
    const huge = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' });
    expect(uploadProblem(huge)).toBe('Images must be 10 MB or smaller.');
  });
});
