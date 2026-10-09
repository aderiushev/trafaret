import { useReactFlow } from '@xyflow/react';
import { useWorkflowStore, type FlowEdge, type FlowNode } from '@/entities/workflow';
import { Button } from '@/shared/ui';

/** The toolbar twin of the Delete key, for touch screens and for discoverability. */
export function DeleteSelectionButton() {
  const { deleteElements } = useReactFlow<FlowNode, FlowEdge>();
  const count = useWorkflowStore(
    (state) =>
      state.nodes.filter((node) => node.selected).length + state.edges.filter((edge) => edge.selected).length,
  );
  const deleteSelection = (): void => {
    const { nodes, edges } = useWorkflowStore.getState();
    // Through React Flow, so the wires of deleted nodes go too.
    void deleteElements({
      nodes: nodes.filter((node) => node.selected),
      edges: edges.filter((edge) => edge.selected),
    });
  };
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={count === 0}
      title="Delete the selection (Delete or Backspace)"
      onClick={deleteSelection}
    >
      Delete{count > 0 && ` (${count})`}
    </Button>
  );
}
