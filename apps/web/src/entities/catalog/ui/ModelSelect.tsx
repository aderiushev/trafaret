import type { ComponentProps } from 'react';
import type { ImageModel } from '@trafaret/core';
import { Select } from '@/shared/ui';

type ModelSelectProps = Omit<ComponentProps<'select'>, 'value' | 'onChange' | 'children'> & {
  models: readonly ImageModel[];
  value: string;
  onChange: (modelId: string) => void;
  /** Lists only the models that can edit images. */
  editOnly?: boolean;
};

/** Every model is listed; the ones the server can't use are disabled and say why. */
export function ModelSelect({ models, value, onChange, editOnly = false, ...props }: ModelSelectProps) {
  const options = editOnly ? models.filter((model) => model.supportsEdit) : models;
  const listed = options.some((model) => model.id === value);
  return (
    <Select {...props} value={value} onChange={(event) => onChange(event.target.value)}>
      {!listed && (
        <option value={value} disabled>
          {models.length === 0 ? value : `${value} (not available)`}
        </option>
      )}
      {options.map((model) => (
        <option key={model.id} value={model.id} disabled={!model.enabled}>
          {model.enabled ? model.label : `${model.label} — ${model.unavailableReason ?? 'unavailable'}`}
        </option>
      ))}
    </Select>
  );
}
