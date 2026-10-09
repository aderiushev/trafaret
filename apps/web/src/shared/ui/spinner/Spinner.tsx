import { cx } from '@/shared/lib';
import styles from './Spinner.module.css';

type SpinnerProps = { label?: string; size?: 'sm' | 'md' };

/** With a label it announces itself as a status; without one it is decoration. */
export function Spinner({ label, size = 'md' }: SpinnerProps) {
  const className = cx(styles.spinner, styles[size]);
  return label ? (
    <span role="status" aria-label={label} className={className} />
  ) : (
    <span aria-hidden="true" className={className} />
  );
}
