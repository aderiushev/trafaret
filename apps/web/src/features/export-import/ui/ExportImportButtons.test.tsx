import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { Toaster } from '@/shared/ui';
import { ExportImportButtons } from './ExportImportButtons';

describe('ExportImportButtons', () => {
  it('says so when the chosen file cannot be read', async () => {
    render(
      <ReactFlowProvider>
        <ExportImportButtons />
        <Toaster />
      </ReactFlowProvider>,
    );
    const file = new File(['{}'], 'workflow.json', { type: 'application/json' });
    // As when the file is moved or deleted after it was chosen.
    file.text = () => Promise.reject(new DOMException('The file could not be read.', 'NotReadableError'));
    await userEvent.upload(screen.getByLabelText('Workflow file to import'), file);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't read that file.");
    expect(alert).toHaveTextContent('Choose the file again.');
  });
});
