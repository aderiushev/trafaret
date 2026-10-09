import { isAiNodeType, NODE_DEFINITIONS, NODE_TYPES, type NodeCategory } from '@trafaret/core';
import { Button } from '@/shared/ui';
import { useAddNode } from '../model/use-add-node';
import styles from './NodePalette.module.css';

const GROUPS: ReadonlyArray<{ category: NodeCategory; label: string }> = [
  { category: 'input', label: 'Input' },
  { category: 'generation', label: 'Generation' },
  { category: 'output', label: 'Output' },
];

export function NodePalette() {
  const { addNode, modelsReady } = useAddNode();
  return (
    <div role="group" aria-label="Add a node" className={styles.palette}>
      {GROUPS.map((group) => (
        <div key={group.category} role="group" aria-label={group.label} className={styles.group}>
          <span className={styles.caption} aria-hidden="true">
            {group.label}
          </span>
          {NODE_TYPES.filter((type) => NODE_DEFINITIONS[type].category === group.category).map((type) => (
            <Button
              key={type}
              size="sm"
              aria-label={`Add ${NODE_DEFINITIONS[type].label}`}
              disabled={isAiNodeType(type) && !modelsReady}
              onClick={() => addNode(type)}
            >
              <span aria-hidden="true">+</span>
              {NODE_DEFINITIONS[type].label}
            </Button>
          ))}
        </div>
      ))}
    </div>
  );
}
