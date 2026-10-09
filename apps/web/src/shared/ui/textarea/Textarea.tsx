import type { ComponentProps } from 'react';
import { cx } from '@/shared/lib';
import styles from './Textarea.module.css';

/** Grows with its content where the browser supports it (field-sizing), and can be resized everywhere. */
export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cx(styles.textarea, className)} {...props} />;
}
