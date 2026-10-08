import { z } from 'zod';
import type { PortType } from './ports.ts';

export const NODE_TYPES = ['prompt', 'imageInput', 'generateImage', 'editImage', 'result'] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const AI_NODE_TYPES = ['generateImage', 'editImage'] as const;
export type AiNodeType = (typeof AI_NODE_TYPES)[number];
export const isAiNodeType = (type: NodeType): type is AiNodeType =>
  type === 'generateImage' || type === 'editImage';

export const ASPECT_RATIOS = ['1:1', '4:3', '3:4', '16:9', '9:16'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const MAX_SEED = 2 ** 31 - 1;
export const randomSeed = (): number => Math.floor(Math.random() * (MAX_SEED + 1));

export const INPUT_HANDLES = ['prompt', 'image'] as const;
export type InputHandle = (typeof INPUT_HANDLES)[number];
export type OutputHandle = 'out';

export type InputPortSpec = { handle: InputHandle; type: PortType; required: boolean; label: string };
export type OutputPortSpec = { handle: OutputHandle; type: PortType; label: string };
export type NodeCategory = 'input' | 'generation' | 'output';

export type NodeDefinition = {
  type: NodeType;
  label: string;
  category: NodeCategory;
  inputs: readonly InputPortSpec[];
  output: OutputPortSpec | null;
};

const imageOutput: OutputPortSpec = { handle: 'out', type: 'image', label: 'Image' };

export const NODE_DEFINITIONS: Readonly<Record<NodeType, NodeDefinition>> = {
  prompt: {
    type: 'prompt',
    label: 'Prompt',
    category: 'input',
    inputs: [],
    output: { handle: 'out', type: 'text', label: 'Text' },
  },
  imageInput: {
    type: 'imageInput',
    label: 'Image Input',
    category: 'input',
    inputs: [],
    output: imageOutput,
  },
  generateImage: {
    type: 'generateImage',
    label: 'Generate Image',
    category: 'generation',
    inputs: [{ handle: 'prompt', type: 'text', required: true, label: 'Prompt' }],
    output: imageOutput,
  },
  editImage: {
    type: 'editImage',
    label: 'Edit Image',
    category: 'generation',
    inputs: [
      { handle: 'image', type: 'image', required: true, label: 'Image' },
      { handle: 'prompt', type: 'text', required: false, label: 'Prompt' },
    ],
    output: imageOutput,
  },
  result: {
    type: 'result',
    label: 'Result',
    category: 'output',
    inputs: [{ handle: 'image', type: 'image', required: true, label: 'Image' }],
    output: null,
  },
};

const seed = z.number().int().min(0).max(MAX_SEED);
const modelId = z.string().min(1);
const presetId = z.string().min(1).nullable();

export const promptDataSchema = z.object({ text: z.string() });
export const imageInputDataSchema = z.object({ assetId: z.string().min(1).nullable() });
export const generateImageDataSchema = z.object({
  modelId,
  presetId,
  aspectRatio: z.enum(ASPECT_RATIOS),
  seed,
});
export const editImageDataSchema = z.object({ instruction: z.string(), modelId, presetId, seed });
export const resultDataSchema = z.object({});

export type PromptData = z.infer<typeof promptDataSchema>;
export type ImageInputData = z.infer<typeof imageInputDataSchema>;
export type GenerateImageData = z.infer<typeof generateImageDataSchema>;
export type EditImageData = z.infer<typeof editImageDataSchema>;
export type ResultData = z.infer<typeof resultDataSchema>;
