import { Component, type ErrorInfo, type ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';

type ErrorBoundaryState = { failed: boolean };

/** Replaces a crashed screen with a way back; the workflow itself is safe in local storage. */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className={styles.fallback}>
        <h1 className={styles.title}>Something broke.</h1>
        <p>Your workflow is saved in this browser. Reload the page to pick it up again.</p>
        <button type="button" className={styles.reload} onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
