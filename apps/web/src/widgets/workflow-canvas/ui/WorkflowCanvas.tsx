import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, type NodeTypes } from '@xyflow/react';
import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { useActiveRun } from '@/entities/run';
import { useWorkflowStore, type FlowEdge, type FlowNode } from '@/entities/workflow';
import { ConnectionLine, useConnectionRules } from '@/features/connect-nodes';
import { EmptyCanvas } from './EmptyCanvas';
import { EditImageNode } from './nodes/EditImageNode';
import { GenerateImageNode } from './nodes/GenerateImageNode';
import { ImageInputNode } from './nodes/ImageInputNode';
import { PromptNode } from './nodes/PromptNode';
import { ResultNode } from './nodes/ResultNode';
import styles from './WorkflowCanvas.module.css';

// Outside the component: React Flow expects the same object on every render.
const nodeTypes = {
  prompt: PromptNode,
  imageInput: ImageInputNode,
  generateImage: GenerateImageNode,
  editImage: EditImageNode,
  result: ResultNode,
} satisfies NodeTypes;

export function WorkflowCanvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, clearSelection } = useWorkflowStore(
    useShallow((state) => ({
      nodes: state.nodes,
      edges: state.edges,
      onNodesChange: state.onNodesChange,
      onEdgesChange: state.onEdgesChange,
      clearSelection: state.clearSelection,
    })),
  );
  const { isValidConnection, onConnect } = useConnectionRules();
  const run = useActiveRun();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clearSelection();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearSelection]);

  // Wires take the colour of the type they carry, and move while the node they feed is running.
  const shownEdges = edges.map((edge) => ({
    ...edge,
    className: edge.targetHandle === 'prompt' ? styles.textWire : styles.imageWire,
    animated: run?.jobs[edge.target]?.status === 'running',
  }));

  return (
    <div className={styles.canvas}>
      <h2 className={styles.heading}>Workflow</h2>
      <ReactFlow<FlowNode, FlowEdge>
        nodes={nodes}
        edges={shownEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        connectionLineComponent={ConnectionLine}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
        snapToGrid
        snapGrid={[16, 16]}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={1.5}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1.5} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable ariaLabel="Workflow overview" />
      </ReactFlow>
      {nodes.length === 0 && <EmptyCanvas />}
    </div>
  );
}
