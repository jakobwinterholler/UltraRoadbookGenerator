import { Component, type ErrorInfo, type ReactNode } from "react";

interface RoutePreviewErrorBoundaryProps {
  label: string;
  children: ReactNode;
}

interface RoutePreviewErrorBoundaryState {
  error: Error | null;
  componentStack: string | null;
}

export default class RoutePreviewErrorBoundary extends Component<
  RoutePreviewErrorBoundaryProps,
  RoutePreviewErrorBoundaryState
> {
  state: RoutePreviewErrorBoundaryState = {
    error: null,
    componentStack: null,
  };

  static getDerivedStateFromError(error: Error): Partial<RoutePreviewErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[RoutePreview] ${this.props.label} crashed`, error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <section className="overflow-hidden rounded-2xl border border-red-500/40 bg-[#1a0a0a] p-6 text-left shadow-card">
        <h2 className="text-lg font-semibold text-red-300">{this.props.label} crashed</h2>
        <p className="mt-2 text-sm text-red-200">{this.state.error.message}</p>
        <pre className="mt-4 max-h-64 overflow-auto rounded-lg bg-black/60 p-4 text-xs leading-relaxed text-red-100">
          {this.state.error.stack}
        </pre>
        {this.state.componentStack ? (
          <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-black/40 p-4 text-xs leading-relaxed text-white/70">
            {this.state.componentStack}
          </pre>
        ) : null}
      </section>
    );
  }
}
