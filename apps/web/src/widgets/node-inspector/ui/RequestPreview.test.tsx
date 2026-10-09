import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RequestPreview as Request } from '@trafaret/core';
import { RequestPreview } from './RequestPreview';

const request: Request = {
  modelId: 'flux-2-klein',
  prompt: 'A ceramic mug. premium minimal 3D render. Avoid: clutter.',
  negativePrompt: 'clutter',
  negativeMode: 'folded',
  references: [
    { assetId: 'a'.repeat(64), url: '/api/assets/source', role: 'source' },
    { assetId: 'b'.repeat(64), url: '/api/assets/preset', role: 'preset' },
  ],
  aspectRatio: '1:1',
  seed: null,
  warnings: ['FLUX.2 klein 4B takes 4 reference images; 1 was left out.'],
};

describe('RequestPreview', () => {
  it('shows the final prompt and how the negative prompt was sent', () => {
    render(<RequestPreview request={request} />);
    const section = screen.getByRole('region', { name: 'Request sent to AI' });
    expect(section).toHaveTextContent('A ceramic mug. premium minimal 3D render. Avoid: clutter.');
    expect(section).toHaveTextContent('added to the prompt as “Avoid: …”');
  });

  it('lists the reference images with their roles, and the warnings', () => {
    render(<RequestPreview request={request} />);
    const references = screen.getByRole('list', { name: 'Reference images' });
    expect(references).toHaveTextContent('Source');
    expect(references).toHaveTextContent('Preset');
    expect(screen.getByText('FLUX.2 klein 4B takes 4 reference images; 1 was left out.')).toBeInTheDocument();
  });

  it('says when the model takes no seed', () => {
    render(<RequestPreview request={request} />);
    expect(screen.getByText('not supported by this model')).toBeInTheDocument();
  });
});
