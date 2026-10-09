import { useStoreApi } from '@xyflow/react';
import { isAiNodeType, type NodeType } from '@trafaret/core';
import { defaultModelId, useCatalog } from '@/entities/catalog';
import { NODE_CARD_WIDTH } from '@/entities/node';
import { createNode, useWorkflowStore } from '@/entities/workflow';
import { toast } from '@/shared/ui';
import { freePosition } from '../lib/free-position';

const GRID = 16;
/** A typical card height, for cards React Flow hasn't measured yet and for the card being added. */
const CARD_HEIGHT = 240;
const snap = (value: number): number => Math.round(value / GRID) * GRID;

/** Adds a node in the middle of the visible canvas, clear of the cards already there. */
export function useAddNode(): { addNode: (type: NodeType) => void; modelsReady: boolean } {
  const flow = useStoreApi();
  const { data: models } = useCatalog();
  const add = useWorkflowStore((state) => state.addNode);

  const addNode = (type: NodeType): void => {
    const modelId = defaultModelId(models ?? [], type === 'editImage' ? 'edit' : 'generate');
    if (isAiNodeType(type) && modelId === null) {
      toast.error('No image model is available.', ['Check that the server is running.']);
      return;
    }
    // The centre of the visible canvas, in canvas coordinates.
    const {
      width,
      height,
      transform: [panX, panY, zoom],
    } = flow.getState();
    const centre = {
      x: snap((width / 2 - panX) / zoom - NODE_CARD_WIDTH / 2),
      y: snap((height / 2 - panY) / zoom - CARD_HEIGHT / 2),
    };
    const taken = useWorkflowStore.getState().nodes.map((node) => ({
      ...node.position,
      width: node.measured?.width ?? NODE_CARD_WIDTH,
      height: node.measured?.height ?? CARD_HEIGHT,
    }));
    const position = freePosition(centre, { width: NODE_CARD_WIDTH, height: CARD_HEIGHT }, taken);
    // Only Generate and Edit nodes use the model id; for them it was checked above.
    add(createNode(type, position, modelId ?? ''));
  };

  return { addNode, modelsReady: models !== undefined };
}
