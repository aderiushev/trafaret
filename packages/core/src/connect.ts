import { wouldCreateCycle, type GraphIndex } from './graph-index.ts';
import { NODE_DEFINITIONS, type NodeType } from './nodes.ts';
import type { PortType } from './ports.ts';

/** Same shape as React Flow's Connection, so the canvas can pass it straight through. */
export type Connection = {
  source: string;
  sourceHandle: string | null;
  target: string;
  targetHandle: string | null;
};

export type ConnectResult = { ok: true } | { ok: false; reason: string };

export const nodeLabel = (type: NodeType): string => NODE_DEFINITIONS[type].label;

export const describeTypeMismatch = (from: PortType, to: PortType): string =>
  `${from === 'text' ? 'Text' : 'Image'} output can't feed ${to === 'image' ? 'an image' : 'a text'} input.`;

/** The single wiring rule: the canvas calls it while dragging, the server re-checks every edge. */
export function canConnect(index: GraphIndex, connection: Connection): ConnectResult {
  const source = index.nodes.get(connection.source);
  const target = index.nodes.get(connection.target);
  if (!source || !target) return { ok: false, reason: 'Both ends must be nodes on the canvas.' };
  if (source.id === target.id) return { ok: false, reason: "A node can't connect to itself." };

  const output = NODE_DEFINITIONS[source.type].output;
  if (!output || connection.sourceHandle !== output.handle) {
    return { ok: false, reason: `${nodeLabel(source.type)} has no such output.` };
  }
  const input = NODE_DEFINITIONS[target.type].inputs.find((port) => port.handle === connection.targetHandle);
  if (!input) return { ok: false, reason: `${nodeLabel(target.type)} has no such input.` };
  if (input.type !== output.type) return { ok: false, reason: describeTypeMismatch(output.type, input.type) };

  const occupied = (index.incoming.get(target.id) ?? []).some((edge) => edge.targetHandle === input.handle);
  if (occupied) return { ok: false, reason: `The ${input.label} input is already connected.` };
  if (wouldCreateCycle(index, source.id, target.id)) {
    return { ok: false, reason: 'This connection would create a loop.' };
  }
  return { ok: true };
}
