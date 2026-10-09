import type { Preset } from '@trafaret/core';
import styles from './PresetReferences.module.css';

/** Thumbnails of the reference images a preset sends along with every request. */
export function PresetReferences({ preset }: { preset: Preset | undefined }) {
  if (!preset || preset.references.length === 0) return null;
  return (
    <ul className={styles.references} aria-label={`${preset.name} reference images`}>
      {preset.references.map((url) => (
        <li key={url}>
          <img src={url} alt="" width={36} height={36} loading="lazy" className={styles.thumbnail} />
        </li>
      ))}
    </ul>
  );
}
