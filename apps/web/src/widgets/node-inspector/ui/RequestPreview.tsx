import type { RequestPreview as Request } from '@trafaret/core';
import styles from './NodeInspector.module.css';

const NEGATIVE_NOTE: Readonly<Record<Request['negativeMode'], string>> = {
  native: "Sent in the model's negative-prompt field.",
  folded: 'This model has no negative-prompt field, so it was added to the prompt as “Avoid: …”.',
  none: 'No negative prompt.',
};

/** Exactly what the server sent to the model: the merged prompt, the reference images and the settings. */
export function RequestPreview({ request }: { request: Request }) {
  return (
    <section aria-label="Request sent to AI" className={styles.section}>
      <h4 className={styles.sectionTitle}>Request sent to AI</h4>
      <p className={styles.prompt}>{request.prompt}</p>
      {request.negativePrompt && (
        <p className={styles.negative}>
          <span className={styles.term}>Negative</span> {request.negativePrompt}
        </p>
      )}
      <p className={styles.note}>{NEGATIVE_NOTE[request.negativeMode]}</p>
      {request.references.length > 0 && (
        <ul className={styles.references} aria-label="Reference images">
          {request.references.map((reference, index) => (
            <li key={index} className={styles.reference}>
              <img src={reference.url} alt="" width={56} height={56} className={styles.referenceImage} />
              <span>{reference.role === 'source' ? 'Source' : 'Preset'}</span>
            </li>
          ))}
        </ul>
      )}
      <dl className={styles.facts}>
        <dt>Model</dt>
        <dd>{request.modelId}</dd>
        <dt>Aspect ratio</dt>
        <dd>{request.aspectRatio ?? '—'}</dd>
        <dt>Seed</dt>
        <dd>{request.seed ?? 'not supported by this model'}</dd>
      </dl>
      {request.warnings.length > 0 && (
        <ul className={styles.warnings}>
          {request.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
