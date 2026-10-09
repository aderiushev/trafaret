import type { ComponentProps } from 'react';
import type { Preset } from '@trafaret/core';
import { Select } from '@/shared/ui';

type PresetSelectProps = Omit<ComponentProps<'select'>, 'value' | 'onChange' | 'children'> & {
  presets: readonly Preset[];
  value: string | null;
  onChange: (presetId: string | null) => void;
};

export function PresetSelect({ presets, value, onChange, ...props }: PresetSelectProps) {
  const listed = value === null || presets.some((preset) => preset.id === value);
  return (
    <Select {...props} value={value ?? ''} onChange={(event) => onChange(event.target.value || null)}>
      <option value="">No preset</option>
      {!listed && (
        <option value={value} disabled>
          {presets.length === 0 ? value : `${value} (not available)`}
        </option>
      )}
      {presets.map((preset) => (
        <option key={preset.id} value={preset.id}>
          {preset.name}
        </option>
      ))}
    </Select>
  );
}
