import { z } from 'zod';
import {
  editImageDataSchema,
  generateImageDataSchema,
  imageInputDataSchema,
  INPUT_HANDLES,
  promptDataSchema,
  resultDataSchema,
  type NodeType,
} from './nodes.ts';

const id = z.string().min(1).max(64);
const position = z.object({ x: z.number(), y: z.number() }).optional();

export const graphNodeSchema = z.discriminatedUnion('type', [
  z.object({ id, type: z.literal('prompt'), data: promptDataSchema, position }),
  z.object({ id, type: z.literal('imageInput'), data: imageInputDataSchema, position }),
  z.object({ id, type: z.literal('generateImage'), data: generateImageDataSchema, position }),
  z.object({ id, type: z.literal('editImage'), data: editImageDataSchema, position }),
  z.object({ id, type: z.literal('result'), data: resultDataSchema, position }),
]);

export const graphEdgeSchema = z.object({
  id,
  source: id,
  sourceHandle: z.literal('out'),
  target: id,
  targetHandle: z.enum(INPUT_HANDLES),
});

export const graphSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

export type GraphNode = z.infer<typeof graphNodeSchema>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;
export type Graph = z.infer<typeof graphSchema>;
export type GraphNodeOf<T extends NodeType> = Extract<GraphNode, { type: T }>;
