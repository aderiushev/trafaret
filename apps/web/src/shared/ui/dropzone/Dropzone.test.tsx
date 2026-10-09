import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dropzone } from './Dropzone';

const photo = () => new File(['png'], 'photo.png', { type: 'image/png' });

function renderDropzone(disabled = false) {
  const onFile = vi.fn();
  render(
    <Dropzone label="Upload image" accept="image/png" onFile={onFile} disabled={disabled}>
      Drop an image
    </Dropzone>,
  );
  return onFile;
}

describe('Dropzone', () => {
  it('hands over a chosen file', async () => {
    const onFile = renderDropzone();
    const file = photo();
    await userEvent.upload(screen.getByLabelText('Upload image'), file);
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('hands over a dropped file', () => {
    const onFile = renderDropzone();
    const file = photo();
    fireEvent.drop(screen.getByText('Drop an image'), { dataTransfer: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('ignores drops while disabled', () => {
    const onFile = renderDropzone(true);
    fireEvent.drop(screen.getByText('Drop an image'), { dataTransfer: { files: [photo()] } });
    expect(onFile).not.toHaveBeenCalled();
  });
});
