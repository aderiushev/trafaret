import type { ReactNode } from 'react';
import { cx } from '@/shared/lib';
import styles from './Badge.module.css';

type BadgeProps = {
  tone?: 'neutral' | 'accent' | 'success' | 'error' | 'warning';
  title?: string;
  children: ReactNode;
};

export function Badge({ tone = 'neutral', title, children }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[tone])} title={title}>
      {children}
    </span>
  );
}
