import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(e) {
    return { error: e };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 32, color: '#f85149', fontFamily: 'monospace',
          background: '#0d1117', minHeight: '100vh',
        }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 12 }}>
            ⚠ Runtime Error — this is what caused the blank screen:
          </div>
          <pre style={{
            background: '#161b22', padding: 20, borderRadius: 8,
            border: '1px solid #f85149', whiteSpace: 'pre-wrap',
            fontSize: '0.85rem', color: '#f85149',
          }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
