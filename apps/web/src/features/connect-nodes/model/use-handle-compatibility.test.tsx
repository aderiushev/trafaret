import { act, renderHook } from '@testing-library/react';
import { Position, ReactFlowProvider, useStoreApi, type ReactFlowState } from '@xyflow/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { generateNode, promptNode } from '@trafaret/core/testing';
import { useWorkflowStore } from '@/entities/workflow';
import { useHandleCompatibility } from './use-handle-compatibility';

type DragStart = { nodeId: string; id: string; type: 'source' | 'target' };

/** React Flow's state while a wire is dragged from `handle` — only the fields the hook and React Flow read. */
const dragFrom = (handle: DragStart) =>
  ({
    inProgress: true,
    to: { x: 0, y: 0 },
    fromHandle: { ...handle, x: 0, y: 0, width: 12, height: 12, position: Position.Right },
  }) as unknown as ReactFlowState['connection'];

function renderCompatibility(nodeId: string, handleId: string, type: 'source' | 'target') {
  let flow: ReturnType<typeof useStoreApi> | undefined;
  const hook = renderHook(
    () => {
      flow = useStoreApi();
      return useHandleCompatibility(nodeId, handleId, type);
    },
    { wrapper: ReactFlowProvider },
  );
  const drag = (handle: DragStart) =>
    act(() => {
      flow?.setState({ connection: dragFrom(handle) });
    });
  return { ...hook, drag };
}

beforeEach(() => {
  useWorkflowStore.setState({ nodes: [], edges: [], issues: [], needsStarter: false });
  useWorkflowStore.getState().replaceGraph({ nodes: [promptNode('p'), generateNode('g')], edges: [] });
});

describe('useHandleCompatibility', () => {
  it('has no verdict while no wire is dragged', () => {
    expect(renderCompatibility('g', 'prompt', 'target').result.current).toBeNull();
  });

  it('follows the graph: an input stops lighting up once it is connected', () => {
    const { result, drag } = renderCompatibility('g', 'prompt', 'target');
    drag({ nodeId: 'p', id: 'out', type: 'source' });
    expect(result.current).toBe(true);
    act(() => {
      useWorkflowStore
        .getState()
        .connect({ source: 'p', sourceHandle: 'out', target: 'g', targetHandle: 'prompt' });
    });
    expect(result.current).toBe(false);
  });

  it('has no verdict for the handle the wire starts from', () => {
    const { result, drag } = renderCompatibility('g', 'prompt', 'target');
    drag({ nodeId: 'g', id: 'prompt', type: 'target' });
    expect(result.current).toBeNull();
  });
});
