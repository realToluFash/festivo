import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The shell's error state.
 *
 * A thrown render error otherwise unmounts the whole tree and leaves a white
 * page, which is indistinguishable from the application never having loaded.
 * This keeps the shell and replaces only the part that failed.
 */
interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Kept to the console rather than swallowed. A boundary that hides the
    // stack makes the one class of bug it exists for the hardest to diagnose.
    console.error('Unhandled render error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error != null) {
      return <ErrorPanel error={this.state.error} onRetry={() => this.setState({ error: null })} />;
    }

    return this.props.children;
  }
}

function ErrorPanel({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="panel panel-error" role="alert">
      <h2>{t('error.title')}</h2>
      <p>{t('error.body')}</p>
      <button type="button" onClick={onRetry}>
        {t('error.retry')}
      </button>
      <details>
        <summary>{t('error.details')}</summary>
        <pre>{error.message}</pre>
      </details>
    </div>
  );
}
