import type { AiNodeType } from '@trafaret/core';
import { Button } from '@/shared/ui';
import { useRegenerateNode } from '../model/use-regenerate-node';

type RegenerateButtonProps = {
  nodeId: string;
  type: AiNodeType;
  disabled?: boolean;
  /** Called after the new seed is set; the card starts a run from here. */
  onRegenerated: () => void;
};

export function RegenerateButton({ nodeId, type, disabled = false, onRegenerated }: RegenerateButtonProps) {
  const regenerate = useRegenerateNode();
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label="Regenerate with a new seed"
      title="New seed, then run"
      disabled={disabled}
      onClick={() => {
        regenerate(nodeId, type);
        onRegenerated();
      }}
    >
      <span aria-hidden="true">🎲</span>
    </Button>
  );
}
