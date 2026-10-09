import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ImageModel, Preset } from '@trafaret/core';
import { edge, editNode, generateNode, imageInputNode, promptNode, resultNode } from '@trafaret/core/testing';
import { samplesQuery } from '@/entities/asset';
import { catalogQuery } from '@/entities/catalog';
import { presetsQuery } from '@/entities/preset';
import { useWorkflowStore } from '@/entities/workflow';
import { WorkflowCanvas } from './WorkflowCanvas';

/** jsdom has no layout: React Flow's documented test shims, so nodes count as measured and render. */
function mockReactFlow(): void {
  class ResizeObserver {
    private readonly callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element): void {
      this.callback([{ target, contentRect: target.getBoundingClientRect() } as ResizeObserverEntry], this);
    }
    unobserve(): void {}
    disconnect(): void {}
  }
  class DOMMatrixReadOnly {
    m22: number;
    constructor(transform?: string) {
      const scale = /scale\(([\d.]+)\)/.exec(transform ?? '')?.[1];
      this.m22 = scale === undefined ? 1 : Number(scale);
    }
  }
  Object.assign(globalThis, { ResizeObserver, DOMMatrixReadOnly });
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: {
      get(this: HTMLElement) {
        return parseFloat(this.style.height) || 1;
      },
    },
    offsetWidth: {
      get(this: HTMLElement) {
        return parseFloat(this.style.width) || 1;
      },
    },
  });
}

const mock: ImageModel = {
  id: 'mock',
  label: 'Mock',
  provider: 'mock',
  default: true,
  enabled: true,
  unavailableReason: null,
  supportsEdit: true,
  supportsNegativePrompt: true,
  supportsSeed: true,
  maxReferenceImages: 14,
  aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
  costPerImageUsd: 0,
};
const premium: Preset = {
  id: 'premium-3d',
  name: 'Premium 3D',
  mainPrompt: '',
  negativePrompt: '',
  references: [],
};

function renderCanvas() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(catalogQuery.queryKey, [mock]);
  queryClient.setQueryData(presetsQuery.queryKey, [premium]);
  queryClient.setQueryData(samplesQuery.queryKey, []);
  return render(
    <QueryClientProvider client={queryClient}>
      <ReactFlowProvider>
        <div style={{ width: 1200, height: 800 }}>
          <WorkflowCanvas />
        </div>
      </ReactFlowProvider>
    </QueryClientProvider>,
  );
}

beforeAll(mockReactFlow);
beforeEach(() => useWorkflowStore.setState({ nodes: [], edges: [], issues: [], needsStarter: false }));

describe('WorkflowCanvas', () => {
  it('renders a card for every node type, showing its settings', async () => {
    useWorkflowStore.getState().replaceGraph({
      nodes: [
        promptNode('prompt', 'A paper boat'),
        generateNode('generate', { presetId: 'premium-3d' }),
        imageInputNode('photo', null),
        editNode('edit'),
        resultNode('result'),
      ],
      edges: [
        edge('prompt', 'generate', 'prompt'),
        edge('photo', 'edit', 'image'),
        edge('generate', 'result', 'image'),
      ],
    });
    renderCanvas();
    const generate = await screen.findByRole('article', { name: 'Generate Image' });
    expect(within(generate).getByRole('combobox', { name: /^Preset/ })).toHaveValue('premium-3d');
    expect(screen.getByRole('textbox', { name: 'Prompt' })).toHaveValue('A paper boat');
    expect(screen.getByRole('article', { name: 'Image Input' })).toHaveTextContent('Drop an image here');
    expect(screen.getByRole('article', { name: 'Edit Image' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Result' })).toHaveTextContent(
      'Run the workflow to see the image here.',
    );
  });

  it('offers the templates on an empty canvas', () => {
    renderCanvas();
    expect(screen.getByRole('heading', { name: 'Start from a template or add a node' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /One prompt, two styles/ })).toBeEnabled();
  });
});
