import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: "",
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : "Unknown runtime error",
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("[AppErrorBoundary] Runtime crash prevented:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 space-y-3 text-center">
          <h1 className="text-base font-semibold">Something went wrong</h1>
          <p className="text-xs text-muted-foreground">
            We caught a runtime crash so the screen doesn&apos;t go blank.
          </p>
          <p className="text-[10px] text-muted-foreground font-mono break-all">{this.state.errorMessage}</p>
          <Button onClick={this.handleReload} className="w-full">Reload app</Button>
        </div>
      </div>
    );
  }
}
