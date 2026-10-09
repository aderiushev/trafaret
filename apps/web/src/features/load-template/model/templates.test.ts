import { describe, expect, it } from 'vitest';
import { validateGraph, type Graph } from '@trafaret/core';
import { instantiateTemplate, TEMPLATE_IDS, type TemplateContext } from './templates';

const context: TemplateContext = {
  modelId: 'flux-2-klein',
  editModelId: 'mock',
  sampleAssetId: 'a'.repeat(64),
};
const seeds = (graph: Graph) => graph.nodes.flatMap((node) => ('seed' in node.data ? [node.data.seed] : []));

describe('templates', () => {
  it('build workflows that pass validation as they are', () => {
    for (const id of TEMPLATE_IDS) expect(validateGraph(instantiateTemplate(id, context))).toEqual([]);
  });

  it('give every node a fresh id and seed on each load', () => {
    const first = instantiateTemplate('two-styles', context);
    const second = instantiateTemplate('two-styles', context);
    const firstIds = new Set(first.nodes.map((node) => node.id));
    expect(second.nodes.some((node) => firstIds.has(node.id))).toBe(false);
    expect(seeds(second)).not.toEqual(seeds(first));
  });

  it('use the given models and sample photo', () => {
    const graph = instantiateTemplate('product-two-styles', context);
    for (const node of graph.nodes) {
      if (node.type === 'editImage') expect(node.data.modelId).toBe('mock');
      if (node.type === 'imageInput') expect(node.data.assetId).toBe(context.sampleAssetId);
    }
    const generate = instantiateTemplate('text-to-image', context).nodes.find(
      (node) => node.type === 'generateImage',
    );
    expect(generate?.data).toMatchObject({ modelId: 'flux-2-klein' });
  });

  it('leave the photo empty when the server has no sample', () => {
    const graph = instantiateTemplate('edit-photo', { ...context, sampleAssetId: null });
    expect(validateGraph(graph)).toEqual([
      expect.objectContaining({ code: 'MISSING_VALUE', message: 'Upload an image.' }),
    ]);
  });

  it('cover the branching scenario: one prompt into two Generate nodes with different presets', () => {
    const graph = instantiateTemplate('two-styles', context);
    const presets = graph.nodes.flatMap((node) =>
      node.type === 'generateImage' ? [node.data.presetId] : [],
    );
    expect(presets).toEqual(['premium-3d', 'lifestyle']);
    expect(graph.edges.filter((edge) => edge.targetHandle === 'prompt')).toHaveLength(2);
  });
});
