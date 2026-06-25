import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";


interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error captured by ErrorBoundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{ padding: "3rem 1.5rem", textAlign: "center", maxWidth: "600px", margin: "4rem auto" }} className="card">
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
          <h2 style={{ color: "var(--danger-color)", marginBottom: "1rem" }}>Đã xảy ra lỗi hệ thống</h2>
          <p style={{ margin: "1rem 0", color: "var(--text-secondary)", lineHeight: "1.6" }}>
            {this.state.error?.message || "Lỗi giao diện hoặc runtime không xác định."}
          </p>
          <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", justifyContent: "center" }}>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary"
            >
              Tải lại trang
            </button>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="btn btn-secondary"
            >
              Thử lại
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
