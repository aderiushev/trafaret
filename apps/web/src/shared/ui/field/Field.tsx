import type { ReactNode } from 'react';
import styles from './Field.module.css';

/** A caption above one form control; the wrapping label gives the control its accessible name. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
    </label>
  );
}
