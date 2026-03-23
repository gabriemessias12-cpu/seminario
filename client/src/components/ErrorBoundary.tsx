import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Structured log — visible in browser DevTools and any log forwarding tool
    console.error(
      JSON.stringify({
        level: 'error',
        timestamp: new Date().toISOString(),
        message: 'Unhandled React error',
        error: error.message,
        stack: error.stack,
        componentStack: info.componentStack,
      }),
    );
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: '1rem',
            padding: '2rem',
            textAlign: 'center',
            fontFamily: 'sans-serif',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
            Algo deu errado
          </h2>
          <p style={{ color: '#666', maxWidth: '400px' }}>
            Ocorreu um erro inesperado. Recarregue a página para continuar.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Recarregar página
          </button>
          {import.meta.env.DEV && this.state.error && (
            <pre
              style={{
                marginTop: '1rem',
                padding: '1rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.375rem',
                fontSize: '0.75rem',
                textAlign: 'left',
                maxWidth: '100%',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                color: '#991b1b',
              }}
            >
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
