import { useWorkflowStore } from '@/entities/workflow';
import { Select } from '@/shared/ui';
import { isTemplateId, TEMPLATE_IDS, TEMPLATES } from '../model/templates';
import { useLoadTemplate } from '../model/use-load-template';
import styles from './TemplateMenu.module.css';

export function TemplateMenu() {
  const { load, ready } = useLoadTemplate();
  return (
    <Select
      aria-label="Load a template"
      className={styles.menu}
      value=""
      disabled={!ready}
      onChange={(event) => {
        const id = event.target.value;
        if (!isTemplateId(id)) return;
        const hasWork = useWorkflowStore.getState().nodes.length > 0;
        if (hasWork && !window.confirm('Replace the current workflow with this template?')) return;
        load(id);
      }}
    >
      <option value="" disabled>
        Templates…
      </option>
      {TEMPLATE_IDS.map((id) => (
        <option key={id} value={id}>
          {TEMPLATES[id].name}
        </option>
      ))}
    </Select>
  );
}
