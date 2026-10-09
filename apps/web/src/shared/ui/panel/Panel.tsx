import type { ReactNode } from 'react';
import { cx } from '@/shared/lib';
import styles from './Panel.module.css';

type PanelProps = { title: string; actions?: ReactNode; className?: string; children: ReactNode };

export function Panel({ title, actions, className, children }: PanelProps) {
  return (
    <section className={cx(styles.panel, className)} aria-label={title}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {actions}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
