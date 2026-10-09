import { TEMPLATE_IDS, TEMPLATES } from '../model/templates';
import { useLoadTemplate } from '../model/use-load-template';
import styles from './TemplateButtons.module.css';

/** The templates as large buttons, for the empty canvas. */
export function TemplateButtons() {
  const { load, ready } = useLoadTemplate();
  return (
    <ul className={styles.templates}>
      {TEMPLATE_IDS.map((id) => (
        <li key={id}>
          <button type="button" className={styles.template} disabled={!ready} onClick={() => load(id)}>
            <span className={styles.name}>{TEMPLATES[id].name}</span>
            <span className={styles.description}>{TEMPLATES[id].description}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
