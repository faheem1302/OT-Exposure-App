import { Component } from "react";

/**
 * Top-level error boundary.
 * If a child component throws, the app falls back to null (existing empty state)
 * rather than injecting new error UI into any component.
 * All errors are logged to the console for debugging.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
