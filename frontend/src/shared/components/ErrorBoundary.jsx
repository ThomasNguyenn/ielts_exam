import { Component } from 'react';

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
    }

    handleReload = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    padding: '2rem',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    textAlign: 'center',
                    color: '#334155',
                    background: '#f8fafc',
                }}>
                    <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: '#1e293b' }}>
                        Something went wrong
                    </h1>
                    <p style={{ marginBottom: '1.5rem', color: '#64748b', maxWidth: '28rem' }}>
                        An unexpected error occurred. Please try reloading the page.
                    </p>
                    <button
                        onClick={this.handleReload}
                        style={{
                            padding: '0.625rem 1.5rem',
                            background: '#d03939',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '0.5rem',
                            fontSize: '0.9375rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                        }}
                    >
                        Back to Home
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
