import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import { graphSchema, type Graph, type Issue, type NodeType } from '@trafaret/core';
import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { fromGraph, toGraph } from '../lib/graph-mapping';
import type { FlowEdge, FlowNode, NodeDataOf } from './types';

export type WorkflowState = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  /** Issues from the last attempt to run. A node's issues clear once it is edited, rewired or removed. */
  issues: Issue[];
  /**
   * True until a usable saved graph is loaded or a workflow is placed,
   * so the editor places a starter workflow.
   */
  needsStarter: boolean;
};

type WorkflowActions = {
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void;
  connect: (connection: Connection) => void;
  addNode: (node: FlowNode) => void;
  updateNodeData: <T extends NodeType>(id: string, type: T, patch: Partial<NodeDataOf<T>>) => void;
  replaceGraph: (graph: Graph) => void;
  clearSelection: () => void;
  setIssues: (issues: readonly Issue[]) => void;
};

export const STORAGE_KEY = 'trafaret:graph:v1';

const removedIds = (changes: ReadonlyArray<{ type: string; id?: string }>): Set<string> =>
  new Set(changes.flatMap((change) => (change.type === 'remove' && change.id ? [change.id] : [])));

/** `issues` without the dropped ones — the same array when nothing is dropped, so subscribers stay quiet. */
const keepIssues = (issues: Issue[], drop: (issue: Issue) => boolean): Issue[] => {
  const kept = issues.filter((issue) => !drop(issue));
  return kept.length === issues.length ? issues : kept;
};

const savedGraph = (persisted: unknown): Graph | null => {
  const graph =
    typeof persisted === 'object' && persisted !== null && 'graph' in persisted ? persisted.graph : undefined;
  const parsed = graphSchema.safeParse(graph);
  return parsed.success ? parsed.data : null;
};

/** The workflow on the canvas. React Flow is fully controlled by it; the graph part is saved in localStorage. */
export const useWorkflowStore = create<WorkflowState & WorkflowActions>()(
  persist(
    immer((set, get) => ({
      nodes: [],
      edges: [],
      issues: [],
      needsStarter: true,

      onNodesChange: (changes) => {
        const removed = removedIds(changes);
        set({
          nodes: applyNodeChanges(changes, get().nodes),
          issues: keepIssues(
            get().issues,
            (issue) => issue.nodeId !== undefined && removed.has(issue.nodeId),
          ),
        });
      },
      onEdgesChange: (changes) => {
        const removed = removedIds(changes);
        set({
          edges: applyEdgeChanges(changes, get().edges),
          issues: keepIssues(
            get().issues,
            (issue) => issue.edgeId !== undefined && removed.has(issue.edgeId),
          ),
        });
      },
      connect: (connection) =>
        set({
          // An id of our own: React Flow's default joins both node ids and can pass the API's 64-character limit.
          edges: addEdge({ ...connection, id: nanoid() }, get().edges),
          issues: keepIssues(get().issues, (issue) => issue.nodeId === connection.target),
        }),
      addNode: (node) =>
        set((state) => {
          for (const existing of state.nodes) if (existing.selected) existing.selected = false;
          state.nodes.push({ ...node, selected: true });
          state.needsStarter = false;
        }),
      updateNodeData: (id, type, patch) =>
        set((state) => {
          const node = state.nodes.find((candidate) => candidate.id === id);
          if (node?.type !== type) return;
          Object.assign(node.data, patch);
          state.issues = keepIssues(state.issues, (issue) => issue.nodeId === id);
        }),
      replaceGraph: (graph) => set({ ...fromGraph(graph), issues: [], needsStarter: false }),
      clearSelection: () =>
        set((state) => {
          for (const node of state.nodes) if (node.selected) node.selected = false;
          for (const edge of state.edges) if (edge.selected) edge.selected = false;
        }),
      setIssues: (issues) => set({ issues: [...issues] }),
    })),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Only the graph is saved, in the shape the API takes: never selection, sizes or issues.
      partialize: (state) => ({ graph: toGraph(state.nodes, state.edges) }),
      merge: (persisted, current) => {
        const graph = savedGraph(persisted);
        return graph
          ? { ...current, ...fromGraph(graph), needsStarter: false }
          : { ...current, needsStarter: true };
      },
    },
  ),
);
