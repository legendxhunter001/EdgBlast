import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', background: '#0A0A0C', color: '#F2F2F0', padding: 24, fontFamily: 'monospace' }}>
          <h1 style={{ fontSize: 18, marginBottom: 12 }}>Edge Blast hit an error</h1>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#E2585F', background: '#131316', padding: 12, borderRadius: 8 }}>
            {this.state.error.message}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}
