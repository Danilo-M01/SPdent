'use client'

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  errorMessage: string
}

export default class AdminErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Fire-and-forget system log write
    fetch('/api/admin/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'CRITICAL',
        message: error.message,
        component: info.componentStack?.split('\n')[1]?.trim() ?? 'Unknown',
        payload: { stack: error.stack?.slice(0, 1000) },
      }),
    }).catch(() => {}) // Intentionally silent — don't crash while reporting crash
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-400" size={28} />
            </div>
            <h1 className="text-white text-xl font-bold mb-2">Došlo je do greške</h1>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Neočekivana greška u aplikaciji. Greška je automatski zabeležena.
              Pokušajte ponovo — ako problem potraje, kontaktirajte administratora sistema.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <p className="text-red-400/60 text-xs font-mono mb-6 text-left bg-red-500/5 border border-red-500/10 rounded-xl p-3">
                {this.state.errorMessage}
              </p>
            )}
            <button
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm"
            >
              <RefreshCw size={15} /> Pokušaj ponovo
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
