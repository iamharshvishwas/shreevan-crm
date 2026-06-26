import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** When this value changes, the boundary resets (e.g. on screen navigation). */
  resetKey?: unknown;
  /** 'screen' = inline panel (sidebar stays usable); 'app' = full-screen. */
  variant?: 'screen' | 'app';
}
interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render/runtime crashes in its subtree so one broken component shows a
 * recovery panel instead of blanking the whole app. Resets automatically when
 * `resetKey` changes (so navigating to another screen clears the error).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props): void {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const fullScreen = this.props.variant === 'app';
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: fullScreen ? '100vh' : '100%', minHeight: 280, padding: 24,
          background: fullScreen ? 'var(--sw-forest-900)' : 'var(--sw-sand-050)',
          fontFamily: 'var(--font-body)',
        }}
      >
        <div style={{ maxWidth: 380, textAlign: 'center', background: '#fff', border: '1px solid var(--sw-line-soft)', borderRadius: 14, padding: '28px 26px', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 17, color: 'var(--sw-ink-900)' }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: 'var(--sw-stone-600)', marginTop: 6, lineHeight: 1.5 }}>
            This section hit an unexpected error. The rest of the app is still working — try again, or reload.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid var(--sw-forest-900)', background: 'var(--sw-forest-900)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '8px 16px', borderRadius: 999, border: '1px solid var(--sw-line-soft)', background: '#fff', color: 'var(--sw-forest-700)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
