import { Component, type ReactNode } from 'react';
import type { Page } from '../../types';

type Props = {
  page: Page;
  onOpenConsole: () => void;
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string | null;
};

export class PageErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: null,
  };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.page !== this.props.page && this.state.hasError) {
      this.setState({ hasError: false, message: null });
    }
  }

  componentDidCatch(error: unknown) {
    console.error('Page render failure', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full p-6">
          <div className="glass-panel p-5 space-y-3 text-sm text-white/70">
            <h2 className="text-lg font-bold text-white">This page failed to render</h2>
            {this.state.message && (
              <pre className="text-xs text-red-200 bg-red-500/10 border border-red-500/20 p-3 rounded-lg overflow-auto">
                {this.state.message}
              </pre>
            )}
            <button onClick={this.props.onOpenConsole} className="glass-button-accent text-sm">
              Open OpenClaw Console Instead
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
