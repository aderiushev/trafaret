import { randomSeed, type AiNodeType } from '@trafaret/core';
import { useWorkflowStore } from '@/entities/workflow';

/** Rolls a new seed for a Generate or Edit node: a new cache key, so its next run renders a new image. */
export function useRegenerateNode(): (nodeId: string, type: AiNodeType) => void {
  const update = useWorkflowStore((state) => state.updateNodeData);
  return (nodeId, type) => update(nodeId, type, { seed: randomSeed() });
}
