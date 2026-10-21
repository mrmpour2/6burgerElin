import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Caught error:", error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex min-h-[50vh] items-center justify-center p-4 text-center">
          <div>
            <h2 className="text-2xl font-bold text-bun-text">Something went wrong</h2>
            <p className="mt-2 text-bun-muted">Please refresh the page</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}