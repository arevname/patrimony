'use client';
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, background: '#0F0E0C', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: 400, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ color: '#C9A961', fontFamily: 'Georgia, serif', fontSize: 24, marginBottom: 12 }}>Something went wrong</h2>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>{this.state.error.message}</p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              style={{ background: '#C9A961', color: '#0F0E0C', border: 'none', borderRadius: 24, padding: '12px 28px', cursor: 'pointer', fontWeight: 600 }}>
              Reload app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
