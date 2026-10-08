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

export type ConnectFailureCode = 'DANGLING_EDGE' | 'PORT_TYPE_MISMATCH' | 'INPUT_ALREADY_CONNECTED' | 'CYCLE';

export type ConnectResult = { ok: true } | { ok: false; code: ConnectFailureCode; reason: string };

export const nodeLabel = (type: NodeType): string => NODE_DEFINITIONS[type].label;

export const describeTypeMismatch = (from: PortType, to: PortType): string =>
  `${from === 'text' ? 'Text' : 'Image'} output can't feed ${to === 'image' ? 'an image' : 'a text'} input.`;

/** The single wiring rule. The canvas calls it while a wire is dragged; on the server, validateGraph replays every edge through it. */
export function canConnect(index: GraphIndex, connection: Connection): ConnectResult {
  const source = index.nodes.get(connection.source);
  const target = index.nodes.get(connection.target);
  if (!source || !target) {
    return { ok: false, code: 'DANGLING_EDGE', reason: 'Both ends must be nodes on the canvas.' };
  }
  if (source.id === target.id) return { ok: false, code: 'CYCLE', reason: "A node can't connect to itself." };

  const output = NODE_DEFINITIONS[source.type].output;
  if (!output || connection.sourceHandle !== output.handle) {
    return { ok: false, code: 'DANGLING_EDGE', reason: `${nodeLabel(source.type)} has no such output.` };
  }
  const input = NODE_DEFINITIONS[target.type].inputs.find((port) => port.handle === connection.targetHandle);
  if (!input)
    return { ok: false, code: 'DANGLING_EDGE', reason: `${nodeLabel(target.type)} has no such input.` };
  if (input.type !== output.type) {
    return { ok: false, code: 'PORT_TYPE_MISMATCH', reason: describeTypeMismatch(output.type, input.type) };
  }

  const occupied = (index.incoming.get(target.id) ?? []).some((edge) => edge.targetHandle === input.handle);
  if (occupied) {
    return {
      ok: false,
      code: 'INPUT_ALREADY_CONNECTED',
      reason: `The ${input.label} input is already connected.`,
    };
  }
  if (wouldCreateCycle(index, source.id, target.id)) {
    return { ok: false, code: 'CYCLE', reason: 'This connection would create a loop.' };
  }
  return { ok: true };
}
