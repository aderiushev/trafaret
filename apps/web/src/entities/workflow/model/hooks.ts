import type { Graph, InputHandle, Issue } from '@trafaret/core';
import { useShallow } from 'zustand/shallow';
import { toGraph } from '../lib/graph-mapping';
import { useWorkflowStore } from './store';
import type { FlowNode } from './types';

/** The current graph, read once (for a run, an export or a wiring check) without subscribing. */
export function getWorkflowGraph(): Graph {
  const { nodes, edges } = useWorkflowStore.getState();
  return toGraph(nodes, edges);
}

export const useWorkflowNode = (nodeId: string | null): FlowNode | undefined =>
  useWorkflowStore((state) => state.nodes.find((node) => node.id === nodeId));

export const useSelectedNodeIds = (): string[] =>
  useWorkflowStore(useShallow((state) => state.nodes.filter((node) => node.selected).map((node) => node.id)));

export const useNodeIssues = (nodeId: string): Issue[] =>
  useWorkflowStore(useShallow((state) => state.issues.filter((issue) => issue.nodeId === nodeId)));

/** The node wired into one of a node's inputs, or null. */
export const useUpstreamNodeId = (nodeId: string, handle: InputHandle): string | null =>
  useWorkflowStore(
    (state) =>
      state.edges.find((edge) => edge.target === nodeId && edge.targetHandle === handle)?.source ?? null,
  );
