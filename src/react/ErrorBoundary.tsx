import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { IssueReporter } from '../core/reporter.js';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * The reporter to file caught errors with. Passed explicitly rather than
   * read from context because a class component cannot use hooks, and this
   * boundary must work even when it wraps the provider itself.
   */
  reporter?: IssueReporter | null;
  /** Custom fallback. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/**
 * Catches render and lifecycle errors and files them with the component stack.
 *
 * Note what this does NOT catch: rejections from event handlers and async
 * callbacks never reach a boundary. Those need the global handlers that
 * HelpProvider installs -- the two mechanisms are complementary, and relying
 * on the boundary alone leaves the larger category uncovered.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.reporter?.logError('react-error-boundary', error, {
      componentStack: info.componentStack ?? undefined,
    });
    this.props.onError?.(error, info);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div role="alert" style={fallbackStyle}>
        <h2 style={{ margin: '0 0 0.5rem' }}>Something went wrong</h2>
        <p style={{ margin: '0 0 1rem', opacity: 0.8 }}>{error.message}</p>
        <button type="button" onClick={this.reset} style={buttonStyle}>
          Try again
        </button>
      </div>
    );
  }
}

const fallbackStyle: React.CSSProperties = {
  padding: '1.5rem',
  fontFamily: 'system-ui, sans-serif',
};

const buttonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: 8,
  border: 'none',
  background: '#4f7cff',
  color: '#fff',
  font: 'inherit',
  cursor: 'pointer',
};
