import styles from './EditorPage.module.css';

export function EditorPage() {
  return (
    <div className={styles.page}>
      <header className={styles.toolbar}>
        <h1 className={styles.logo}>Trafaret</h1>
      </header>
      <main className={styles.main} />
    </div>
  );
}
