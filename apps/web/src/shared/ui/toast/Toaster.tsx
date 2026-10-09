import { useEffect } from 'react';
import { cx } from '@/shared/lib';
import { useToastStore, type Toast } from './toast-store';
import styles from './Toaster.module.css';

const VISIBLE_MS = 6000;

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  return (
    <div className={styles.region}>
      {toasts.map((toast) => (
        <ToastMessage key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastMessage({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((state) => state.dismiss);
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [dismiss, toast.id]);
  return (
    <div role={toast.tone === 'error' ? 'alert' : 'status'} className={cx(styles.toast, styles[toast.tone])}>
      <div className={styles.text}>
        <p className={styles.title}>{toast.title}</p>
        {toast.details.length > 0 && (
          <ul className={styles.details}>
            {toast.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" className={styles.close} aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
        ×
      </button>
    </div>
  );
}
