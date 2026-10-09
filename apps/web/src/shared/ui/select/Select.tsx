import type { ComponentProps } from 'react';
import { cx } from '@/shared/lib';
import styles from './Select.module.css';

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cx(styles.select, className)} {...props} />;
}
