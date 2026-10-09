import { create } from 'zustand';
import type { Graph } from '@trafaret/core';

type RunSessionState = {
  activeRunId: string | null;
  /** The graph the active run was started with: it tells which nodes were edited since. */
  submittedGraph: Graph | null;
  start: (runId: string, graph: Graph) => void;
  clear: () => void;
};

/** The run the editor is showing. Not saved: after a reload, Run again — unchanged nodes come from the cache. */
export const useRunSession = create<RunSessionState>()((set) => ({
  activeRunId: null,
  submittedGraph: null,
  start: (activeRunId, submittedGraph) => set({ activeRunId, submittedGraph }),
  clear: () => set({ activeRunId: null, submittedGraph: null }),
}));
