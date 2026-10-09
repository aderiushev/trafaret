import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ImageModel } from '@trafaret/core';
import { ModelSelect } from './ModelSelect';

const base: Omit<ImageModel, 'id' | 'label'> = {
  provider: 'mock',
  default: false,
  enabled: true,
  unavailableReason: null,
  supportsEdit: true,
  supportsNegativePrompt: true,
  supportsSeed: true,
  maxReferenceImages: 4,
  aspectRatios: ['1:1'],
  costPerImageUsd: 0,
};
const models: ImageModel[] = [
  {
    ...base,
    id: 'seedream-4.5',
    label: 'Seedream 4.5',
    provider: 'byteplus',
    enabled: false,
    unavailableReason: 'Set ARK_API_KEY on the server to enable this model.',
  },
  { ...base, id: 'mock', label: 'Mock' },
  { ...base, id: 'text-only', label: 'Text only', supportsEdit: false },
];

describe('ModelSelect', () => {
  it('lists unusable models as disabled, with the reason', () => {
    render(<ModelSelect aria-label="Model" models={models} value="mock" onChange={() => undefined} />);
    const option = screen.getByRole('option', { name: /Seedream 4\.5/ });
    expect(option).toBeDisabled();
    expect(option).toHaveTextContent('Set ARK_API_KEY on the server to enable this model.');
  });

  it('reports the chosen model id', async () => {
    const onChange = vi.fn();
    render(<ModelSelect aria-label="Model" models={models} value="mock" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText('Model'), 'Text only');
    expect(onChange).toHaveBeenCalledWith('text-only');
  });

  it('offers only edit-capable models to Edit nodes', () => {
    render(
      <ModelSelect aria-label="Model" models={models} value="mock" onChange={() => undefined} editOnly />,
    );
    expect(screen.queryByRole('option', { name: 'Text only' })).not.toBeInTheDocument();
  });
});
