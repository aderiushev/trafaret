import type { Edge, Node } from '@xyflow/react';
import type { GraphNodeOf, NodeType } from '@trafaret/core';

export type NodeDataOf<T extends NodeType> = GraphNodeOf<T>['data'];

/** A graph node as React Flow holds it: the same id, type and data, plus selection, size and drag state. */
export type FlowNodeOf<T extends NodeType> = Node<NodeDataOf<T>, T> & { type: T };
export type FlowNode = { [T in NodeType]: FlowNodeOf<T> }[NodeType];
export type FlowEdge = Edge;
