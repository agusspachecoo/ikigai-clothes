import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error no controlado en la app:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <main className="min-h-screen bg-base-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-base-300 bg-base-200 p-6 text-center">
          <h1 className="text-xl font-semibold">Algo salió mal</h1>
          <p className="mt-2 text-sm opacity-70">
            No pudimos mostrar esta página. Probá recargar; si el problema sigue, escribinos por
            WhatsApp.
          </p>
          <button
            type="button"
            className="btn btn-neutral mt-5"
            onClick={() => window.location.reload()}
          >
            Recargar
          </button>
        </div>
      </main>
    )
  }
}
