import type { ReactNode } from 'react';
import type { Issue, JobStatus, NodeCategory } from '@trafaret/core';
import { cx } from '@/shared/lib';
import { NODE_CARD_WIDTH } from '../config/layout';
import styles from './NodeShell.module.css';

const CATEGORY_LABEL: Readonly<Record<NodeCategory, string>> = {
  input: 'Input',
  generation: 'Generation',
  output: 'Output',
};

type NodeShellProps = {
  title: string;
  category: NodeCategory;
  /** Drives the outline: dashed while queued, an accent ring while running, red on error. */
  status: JobStatus;
  selected: boolean;
  /** Shown next to the title, e.g. the job's status badge. */
  badge?: ReactNode;
  edited?: boolean;
  issues?: readonly Issue[];
  /** The card's port handles; React Flow places them on its edges. */
  handles: ReactNode;
  children?: ReactNode;
};

/** The frame every node card shares. Layout only: the card's content comes from its widget. */
export function NodeShell({
  title,
  category,
  status,
  selected,
  badge,
  edited = false,
  issues = [],
  handles,
  children,
}: NodeShellProps) {
  return (
    <article
      aria-label={title}
      data-status={status}
      data-selected={selected}
      className={cx(styles.card, styles[status], selected && styles.selected)}
      style={{ width: NODE_CARD_WIDTH }}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.category}>{CATEGORY_LABEL[category]}</span>
          <h3 className={styles.title}>{title}</h3>
        </div>
        {edited && (
          <span className={styles.edited} title="Changed since the last run">
            ● edited
          </span>
        )}
        {badge}
      </header>
      {children && <div className={styles.body}>{children}</div>}
      {issues.length > 0 && (
        <ul className={styles.issues}>
          {issues.map((issue) => (
            <li key={`${issue.code}:${issue.message}`}>{issue.message}</li>
          ))}
        </ul>
      )}
      {handles}
    </article>
  );
}
