import type { ComponentProps } from 'react';
import { cx } from '@/shared/lib';
import styles from './Button.module.css';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md';
};

export function Button({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={cx(styles.button, styles[variant], styles[size], className)} {...props} />
  );
}
