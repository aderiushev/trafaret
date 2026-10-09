import { useState, type ReactNode } from 'react';
import { cx } from '@/shared/lib';
import styles from './Dropzone.module.css';

type DropzoneProps = {
  /** Accessible name of the file input, e.g. "Upload image". */
  label: string;
  accept: string;
  onFile: (file: File) => void;
  disabled?: boolean;
  children: ReactNode;
};

/** Click (or press Enter on the focused input) to pick a file, or drop one onto the area. */
export function Dropzone({ label, accept, onFile, disabled = false, children }: DropzoneProps) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      className={cx(styles.dropzone, dragging && styles.dragging, disabled && styles.disabled)}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file && !disabled) onFile(file);
      }}
    >
      <input
        type="file"
        aria-label={label}
        accept={accept}
        disabled={disabled}
        className={styles.input}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = ''; // so choosing the same file again still fires a change
          if (file) onFile(file);
        }}
      />
      {children}
    </label>
  );
}
