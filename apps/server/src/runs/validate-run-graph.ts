import { validateGraph, type Graph, type Issue } from '@trafaret/core';
import type { AssetStore } from '../assets/asset-store.ts';
import type { ModelCatalog } from '../catalog/catalog.ts';
import type { PresetRepository } from '../library/preset-repository.ts';

export type RunGraphContext = { catalog: ModelCatalog; presets: PresetRepository; assets: AssetStore };

/** The shared graph rules plus what only the server knows: models, presets and stored images. */
export function validateRunGraph(graph: Graph, context: RunGraphContext): Issue[] {
  const issues = validateGraph(graph);
  for (const node of graph.nodes) {
    if (node.type === 'generateImage' || node.type === 'editImage') {
      const model = context.catalog.get(node.data.modelId);
      if (!model) {
        issues.push({
          code: 'UNKNOWN_MODEL',
          message: `Unknown model "${node.data.modelId}".`,
          nodeId: node.id,
        });
      } else if (!model.enabled) {
        issues.push({
          code: 'MODEL_UNAVAILABLE',
          message: model.unavailableReason ?? 'This model is not available.',
          nodeId: node.id,
        });
      } else if (node.type === 'editImage' && !model.supportsEdit) {
        issues.push({
          code: 'MODEL_CANNOT_EDIT',
          message: `${model.label} can't edit images. Pick another model.`,
          nodeId: node.id,
        });
      }
      if (node.data.presetId && !context.presets.get(node.data.presetId)) {
        issues.push({
          code: 'UNKNOWN_PRESET',
          message: `Unknown preset "${node.data.presetId}".`,
          nodeId: node.id,
        });
      }
    }
    if (node.type === 'imageInput' && node.data.assetId && !context.assets.has(node.data.assetId)) {
      issues.push({
        code: 'UNKNOWN_ASSET',
        message: 'This image is no longer on the server. Upload it again.',
        nodeId: node.id,
      });
    }
  }
  return issues;
}
