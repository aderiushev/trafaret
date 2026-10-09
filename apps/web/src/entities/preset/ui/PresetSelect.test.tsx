import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Preset } from '@trafaret/core';
import { PresetReferences } from './PresetReferences';
import { PresetSelect } from './PresetSelect';

const premium: Preset = {
  id: 'premium-3d',
  name: 'Premium 3D',
  mainPrompt: 'premium minimal 3D render',
  negativePrompt: 'clutter',
  references: ['/api/assets/one', '/api/assets/two'],
};

describe('PresetSelect', () => {
  it('maps "No preset" to null and back', async () => {
    const onChange = vi.fn();
    render(<PresetSelect aria-label="Preset" presets={[premium]} value="premium-3d" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText('Preset'), 'No preset');
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('reports the chosen preset id', async () => {
    const onChange = vi.fn();
    render(<PresetSelect aria-label="Preset" presets={[premium]} value={null} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText('Preset'), 'Premium 3D');
    expect(onChange).toHaveBeenCalledWith('premium-3d');
  });
});

describe('PresetReferences', () => {
  it('shows a thumbnail per reference image', () => {
    render(<PresetReferences preset={premium} />);
    const list = screen.getByRole('list', { name: 'Premium 3D reference images' });
    expect(list.querySelectorAll('img')).toHaveLength(2);
  });
});
