import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './design-system.css'

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('CDPC failed to render:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{
          minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20,
          background: '#383838', color: '#222', fontFamily: 'Arial, sans-serif',
          backgroundImage: 'linear-gradient(45deg,#444 25%,transparent 25%,transparent 75%,#444 75%),linear-gradient(45deg,#444 25%,#333 25%,#333 75%,#444 75%)',
          backgroundPosition: '0 0,8px 8px', backgroundSize: '16px 16px',
        }}>
          <section style={{
            width: 'min(560px,100%)', padding: 20, background: '#c6c6c6',
            border: '4px solid #555', boxShadow: 'inset 4px 4px #fff,inset -4px -4px #777',
          }}>
            <h1 style={{ marginTop: 0, fontSize: 20 }}>CDPC 工作台加载失败</h1>
            <p>页面组件运行时发生错误。可以先重新加载；如果反复出现，请将下方错误信息反馈给开发者。</p>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: 10, background: '#a0a0a0', border: '2px solid #555', fontSize: 12 }}>
              {this.state.error.message}
            </pre>
            <button onClick={() => window.location.reload()} style={{
              minHeight: 40, padding: '8px 14px', border: '3px solid #315526',
              background: '#56883b', color: '#fff', fontWeight: 800,
              boxShadow: 'inset 3px 3px #8fbd62,inset -3px -3px #315b27',
            }}>重新加载工作台</button>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
)
