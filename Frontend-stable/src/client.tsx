import { Component, StrictMode, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start/client'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[DeltaJalan] Root render error:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center',
          padding: '24px', background: '#F1F5F9', fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#1E293B', marginBottom: '8px' }}>
              Aplikasi gagal dimuat
            </h1>
            <p style={{ fontSize: '14px', color: '#64748B', marginBottom: '16px' }}>
              Terjadi kesalahan saat memuat aplikasi. Silakan restart aplikasi.
            </p>
            <pre style={{
              fontSize: '11px', color: '#DC2626', background: '#FEF2F2',
              padding: '12px', borderRadius: '8px', textAlign: 'left',
              maxHeight: '200px', overflow: 'auto', wordBreak: 'break-all'
            }}>
              {this.state.error.message}
            </pre>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const container = document.getElementById('root')
if (container) {
  try {
    createRoot(container).render(
      <StrictMode>
        <ErrorBoundary>
          <Suspense>
            <StartClient />
          </Suspense>
        </ErrorBoundary>
      </StrictMode>,
    )
  } catch (e) {
    console.error('[DeltaJalan] createRoot failed:', e)
    container.innerHTML = `<div style="display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;background:#F1F5F9;font-family:system-ui,sans-serif">
      <div style="max-width:400px;text-align:center">
        <h1 style="font-size:20px;font-weight:600;color:#1E293B;margin-bottom:8px">Aplikasi gagal dimuat</h1>
        <p style="font-size:14px;color:#64748B">Terjadi kesalahan kritis. Silakan restart aplikasi.</p>
      </div>
    </div>`
  }
}
