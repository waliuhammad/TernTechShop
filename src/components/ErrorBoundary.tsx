import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render errors so a single broken component cannot white-screen the
 * whole storefront.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Replace with your error reporting service when one is wired up.
    console.error('Unhandled render error:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md space-y-6 text-center">
          <p className="font-mono text-[10px] tracking-[0.3em] text-slate-400 uppercase">
            // SYSTEM_FAULT_DETECTED
          </p>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase italic">
            Unexpected <span className="text-primary not-italic">Error</span>
          </h1>
          <p className="leading-relaxed font-medium text-slate-500">
            A component failed to render. Reloading usually clears it.
          </p>
          <button
            type="button"
            onClick={() => window.location.assign('/')}
            className="primary-btn"
          >
            Return to Base
          </button>
        </div>
      </div>
    );
  }
}
