import { nanoid } from 'nanoid';
import { randomSeed, type Graph, type GraphEdge, type GraphNode, type InputHandle } from '@trafaret/core';

export const TEMPLATE_IDS = ['text-to-image', 'edit-photo', 'two-styles', 'product-two-styles'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];
export const isTemplateId = (value: unknown): value is TemplateId => TEMPLATE_IDS.some((id) => id === value);

/** What a template takes from the server: models for its AI nodes and the pinned sample photo. */
export type TemplateContext = { modelId: string; editModelId: string; sampleAssetId: string | null };

type Template = { name: string; description: string; build: (context: TemplateContext) => Graph };

// Typed parameters, so each node literal is checked against its own node type.
const graph = (nodes: GraphNode[], edges: GraphEdge[]): Graph => ({ nodes, edges });

const wire = (source: string, target: string, targetHandle: InputHandle): GraphEdge => ({
  id: nanoid(),
  source,
  sourceHandle: 'out',
  target,
  targetHandle,
});

/** Every build gives fresh node ids and seeds, so a template can be loaded again and again. */
export const TEMPLATES: Readonly<Record<TemplateId, Template>> = {
  'text-to-image': {
    name: 'Text → Image',
    description: 'A prompt, one Generate Image node and its result.',
    build: ({ modelId }) => {
      const [prompt, generate, result] = [nanoid(), nanoid(), nanoid()];
      return graph(
        [
          {
            id: prompt,
            type: 'prompt',
            position: { x: 0, y: 40 },
            data: { text: 'A white sneaker on a stone pedestal, soft morning light' },
          },
          {
            id: generate,
            type: 'generateImage',
            position: { x: 340, y: 0 },
            data: { modelId, presetId: null, aspectRatio: '1:1', seed: randomSeed() },
          },
          { id: result, type: 'result', position: { x: 680, y: 0 }, data: {} },
        ],
        [wire(prompt, generate, 'prompt'), wire(generate, result, 'image')],
      );
    },
  },
  'edit-photo': {
    name: 'Edit a photo',
    description: 'The sample photo, one Edit Image node and its result.',
    build: ({ editModelId, sampleAssetId }) => {
      const [photo, edit, result] = [nanoid(), nanoid(), nanoid()];
      return graph(
        [
          { id: photo, type: 'imageInput', position: { x: 0, y: 0 }, data: { assetId: sampleAssetId } },
          {
            id: edit,
            type: 'editImage',
            position: { x: 340, y: 0 },
            data: {
              instruction: 'Put the product on a sunlit marble kitchen counter',
              modelId: editModelId,
              presetId: null,
              seed: randomSeed(),
            },
          },
          { id: result, type: 'result', position: { x: 680, y: 0 }, data: {} },
        ],
        [wire(photo, edit, 'image'), wire(edit, result, 'image')],
      );
    },
  },
  'two-styles': {
    name: 'One prompt, two styles',
    description: 'One prompt rendered twice in parallel, with the Premium 3D and Lifestyle presets.',
    build: ({ modelId }) => {
      const [prompt, generateA, generateB, resultA, resultB] = [
        nanoid(),
        nanoid(),
        nanoid(),
        nanoid(),
        nanoid(),
      ];
      return graph(
        [
          {
            id: prompt,
            type: 'prompt',
            position: { x: 0, y: 220 },
            data: { text: 'A ceramic coffee mug with steam rising, on a wooden table' },
          },
          {
            id: generateA,
            type: 'generateImage',
            position: { x: 340, y: 0 },
            data: { modelId, presetId: 'premium-3d', aspectRatio: '1:1', seed: randomSeed() },
          },
          {
            id: generateB,
            type: 'generateImage',
            position: { x: 340, y: 480 },
            data: { modelId, presetId: 'lifestyle', aspectRatio: '1:1', seed: randomSeed() },
          },
          { id: resultA, type: 'result', position: { x: 680, y: 0 }, data: {} },
          { id: resultB, type: 'result', position: { x: 680, y: 480 }, data: {} },
        ],
        [
          wire(prompt, generateA, 'prompt'),
          wire(prompt, generateB, 'prompt'),
          wire(generateA, resultA, 'image'),
          wire(generateB, resultB, 'image'),
        ],
      );
    },
  },
  'product-two-styles': {
    name: 'Product shot → two styles',
    description: 'Clean up the sample photo once, then restyle it twice: Premium 3D and Paper Craft.',
    build: ({ editModelId, sampleAssetId }) => {
      const [photo, clean, editA, editB, resultA, resultB] = [
        nanoid(),
        nanoid(),
        nanoid(),
        nanoid(),
        nanoid(),
        nanoid(),
      ];
      const restyle = (presetId: string) => ({
        instruction: 'Keep the product exactly as it is and restyle the scene around it',
        modelId: editModelId,
        presetId,
        seed: randomSeed(),
      });
      return graph(
        [
          { id: photo, type: 'imageInput', position: { x: 0, y: 220 }, data: { assetId: sampleAssetId } },
          {
            id: clean,
            type: 'editImage',
            position: { x: 340, y: 220 },
            data: {
              instruction: 'Place the product on a seamless white studio background',
              modelId: editModelId,
              presetId: null,
              seed: randomSeed(),
            },
          },
          { id: editA, type: 'editImage', position: { x: 680, y: 0 }, data: restyle('premium-3d') },
          { id: editB, type: 'editImage', position: { x: 680, y: 480 }, data: restyle('paper-craft') },
          { id: resultA, type: 'result', position: { x: 1020, y: 0 }, data: {} },
          { id: resultB, type: 'result', position: { x: 1020, y: 480 }, data: {} },
        ],
        [
          wire(photo, clean, 'image'),
          wire(clean, editA, 'image'),
          wire(clean, editB, 'image'),
          wire(editA, resultA, 'image'),
          wire(editB, resultB, 'image'),
        ],
      );
    },
  },
};

export const instantiateTemplate = (id: TemplateId, context: TemplateContext): Graph =>
  TEMPLATES[id].build(context);
