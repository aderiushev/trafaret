import type { GraphIndex, GraphNode } from '@trafaret/core';
import { canonicalJson } from '../lib/canonical-json.ts';
import { sha256Hex } from '../lib/hash.ts';

/** Bump to invalidate every cached result (e.g. after changing how requests are built). */
export const CACHE_VERSION = 1;

/**
 * Input-addressed keys (Nix/Bazel style): a node's key depends on its own settings and on its upstream *keys*,
 * never on outputs — so every cache hit is known before anything runs.
 */
export function computeCacheKeys(
  index: GraphIndex,
  order: readonly string[],
  presetHash: (presetId: string) => string | undefined,
): Map<string, string> {
  const keys = new Map<string, string>();
  for (const nodeId of order) {
    const node = index.nodes.get(nodeId);
    if (!node) continue;
    const inputs: Record<string, string | undefined> = {};
    for (const edge of index.incoming.get(nodeId) ?? []) inputs[edge.targetHandle] = keys.get(edge.source);
    const presetId = 'presetId' in node.data ? node.data.presetId : null;
    const preset = presetId ? (presetHash(presetId) ?? `missing:${presetId}`) : null;
    keys.set(
      nodeId,
      sha256Hex(
        canonicalJson({
          v: CACHE_VERSION,
          type: node.type,
          data: relevantData(node, inputs),
          preset,
          inputs,
        }),
      ),
    );
  }
  return keys;
}

function relevantData(node: GraphNode, inputs: Record<string, string | undefined>): unknown {
  switch (node.type) {
    case 'prompt':
      return { text: node.data.text };
    case 'imageInput':
      return { assetId: node.data.assetId };
    case 'generateImage':
      return { modelId: node.data.modelId, aspectRatio: node.data.aspectRatio, seed: node.data.seed };
    case 'editImage':
      return {
        modelId: node.data.modelId,
        seed: node.data.seed,
        instruction: inputs.prompt === undefined ? node.data.instruction : null,
      };
    case 'result':
      return {};
  }
}
