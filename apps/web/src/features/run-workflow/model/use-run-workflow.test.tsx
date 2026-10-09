import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Graph } from '@trafaret/core';
import { branchingGraph, generateNode } from '@trafaret/core/testing';
import { useRunSession } from '@/entities/run';
import { getWorkflowGraph, useWorkflowStore } from '@/entities/workflow';
import { ApiError } from '@/shared/api';
import { Toaster, toast } from '@/shared/ui';
import { useRunWorkflow } from './use-run-workflow';

// Only the POST is replaced: TanStack Query, the run session and the workflow store are the real ones.
const createRun = vi.hoisted(() => vi.fn<(graph: Graph) => Promise<string>>());
vi.mock(import('@/entities/run'), async (importOriginal) => ({
  ...(await importOriginal()),
  startRunMutation: { mutationKey: ['runs', 'start'], mutationFn: createRun },
}));

function renderRunWorkflow() {
  const queryClient = new QueryClient();
  const hook = renderHook(() => useRunWorkflow(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
  return { ...hook, queryClient };
}

/** Clicks Run, then unmounts the host (say, a deleted card's 🎲) while the POST is still in flight. */
async function runThenUnmount(response: Promise<string>): Promise<void> {
  createRun.mockReturnValue(response);
  const { result, unmount } = renderRunWorkflow();
  act(() => result.current.run());
  await waitFor(() => expect(createRun).toHaveBeenCalledOnce());
  unmount();
}

beforeEach(() => {
  createRun.mockReset();
  toast.clearErrors(); // error toasts left by earlier tests
  useWorkflowStore.setState({ nodes: [], edges: [], issues: [], needsStarter: false });
  useRunSession.setState({ activeRunId: null, submittedGraph: null });
});

describe('useRunWorkflow', () => {
  it('never posts an invalid workflow: its issues go onto the nodes', () => {
    useWorkflowStore.getState().replaceGraph({ nodes: [generateNode('g')], edges: [] });
    const { result, queryClient } = renderRunWorkflow();
    act(() => result.current.run());
    // `mutate` marks its mutation pending at once, before the POST goes out a tick later.
    expect(queryClient.isMutating()).toBe(0);
    expect(createRun).not.toHaveBeenCalled();
    expect(useWorkflowStore.getState().issues).toEqual([
      { code: 'MISSING_INPUT', message: 'The Prompt input needs a connection.', nodeId: 'g' },
    ]);
  });

  it('tracks a started run even when the host unmounts before the server answers', async () => {
    useWorkflowStore.getState().replaceGraph(branchingGraph());
    const graph = getWorkflowGraph();
    const response = Promise.withResolvers<string>();
    await runThenUnmount(response.promise);
    response.resolve('run_1');
    await waitFor(() => expect(useRunSession.getState().activeRunId).toBe('run_1'));
    expect(useRunSession.getState().submittedGraph).toEqual(graph);
  });

  it('puts the issues the server finds onto the nodes, even after the host unmounts', async () => {
    useWorkflowStore.getState().replaceGraph(branchingGraph());
    const issue = { code: 'UNKNOWN_PRESET', message: 'Choose another preset.', nodeId: 'gen-a' } as const;
    const response = Promise.withResolvers<string>();
    await runThenUnmount(response.promise);
    response.reject(new ApiError(400, 'INVALID_GRAPH', 'Choose another preset.', [issue]));
    await waitFor(() => expect(useWorkflowStore.getState().issues).toEqual([issue]));
    expect(useRunSession.getState().activeRunId).toBeNull();
  });

  it('clears earlier error toasts once a run starts', async () => {
    render(<Toaster />);
    act(() => toast.error('Fix 2 issues to run.', ['Add a Generate Image node.']));
    expect(screen.getByRole('alert')).toHaveTextContent('Fix 2 issues to run.');

    useWorkflowStore.getState().replaceGraph(branchingGraph());
    createRun.mockResolvedValue('run_1');
    const { result } = renderRunWorkflow();
    act(() => result.current.run());
    await waitFor(() => expect(useRunSession.getState().activeRunId).toBe('run_1'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
