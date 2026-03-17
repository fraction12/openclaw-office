import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  name: string;
  children: ReactNode;
  className?: string;
  resetKeys?: Array<string | number | boolean | null | undefined>;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
    componentStack: "",
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      error,
      componentStack: "",
    };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? "" });
    console.error(`[ErrorBoundary] ${this.props.name} crashed`, error, info.componentStack);
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && this.haveResetKeysChanged(prevProps.resetKeys, this.props.resetKeys)) {
      this.reset();
    }
  }

  private haveResetKeysChanged(
    prevKeys: ErrorBoundaryProps["resetKeys"],
    nextKeys: ErrorBoundaryProps["resetKeys"],
  ): boolean {
    if (!prevKeys && !nextKeys) return false;
    if (!prevKeys || !nextKeys) return true;
    if (prevKeys.length !== nextKeys.length) return true;
    return prevKeys.some((key, index) => !Object.is(key, nextKeys[index]));
  }

  private reset = () => {
    this.setState({ error: null, componentStack: "" });
  };

  override render() {
    const { error, componentStack } = this.state;

    if (!error) {
      return this.props.children;
    }

    const isDev = import.meta.env.DEV;

    return (
      <div
        className={
          this.props.className ??
          "flex h-full min-h-[12rem] w-full flex-col items-start justify-center gap-3 rounded-xl border border-red-200 bg-red-50/80 p-4 text-red-950 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100"
        }
        role="alert"
      >
        <div>
          <p className="text-sm font-semibold">
            {isDev ? `${this.props.name} crashed` : "Something went wrong"}
          </p>
          <p className="mt-1 text-xs opacity-80">Component tree: {this.props.name}</p>
        </div>

        {isDev ? (
          <>
            <pre className="max-h-40 w-full overflow-auto rounded-md bg-black/10 p-3 text-xs dark:bg-black/30">
              {error.message}
              {error.stack ? `\n\n${error.stack}` : ""}
            </pre>
            {componentStack ? (
              <pre className="max-h-32 w-full overflow-auto rounded-md bg-black/10 p-3 text-xs dark:bg-black/30">
                {componentStack}
              </pre>
            ) : null}
          </>
        ) : null}

        <button
          type="button"
          onClick={this.reset}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-500"
        >
          Retry
        </button>
      </div>
    );
  }
}
