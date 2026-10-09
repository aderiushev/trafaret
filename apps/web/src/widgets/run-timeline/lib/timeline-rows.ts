import {
  indexGraph,
  nodeLabel,
  topologicalOrder,
  type Graph,
  type GraphNode,
  type ImageModel,
  type Preset,
} from '@trafaret/core';

export type TimelineRowInfo = { nodeId: string; label: string };

/** One row per Generate or Edit node of the run, in execution order, named after its preset (or model). */
export function timelineRows(
  graph: Graph,
  presets: readonly Preset[],
  models: readonly ImageModel[],
): TimelineRowInfo[] {
  const order = topologicalOrder(indexGraph(graph)) ?? graph.nodes.map((node) => node.id);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  return order.flatMap((id) => {
    const node = byId.get(id);
    return node ? row(node, presets, models) : [];
  });
}

function row(node: GraphNode, presets: readonly Preset[], models: readonly ImageModel[]): TimelineRowInfo[] {
  if (node.type !== 'generateImage' && node.type !== 'editImage') return [];
  const style =
    presets.find((preset) => preset.id === node.data.presetId)?.name ??
    models.find((model) => model.id === node.data.modelId)?.label ??
    node.data.modelId;
  return [{ nodeId: node.id, label: `${nodeLabel(node.type)} · ${style}` }];
}
