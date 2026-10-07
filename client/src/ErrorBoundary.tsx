import { Component, type ReactNode } from 'react'

/** Red de seguridad: si algo revienta al dibujar, se muestra esto en vez de dejar la pantalla en blanco sin salida. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-4 text-center">
        <div className="card w-full space-y-4 p-6">
          <h1 className="text-3xl">Algo se rompió</h1>
          <p className="opacity-70">No es tu culpa. Recarga la página; si vuelve a pasar, cuéntale a quien te dio el link.</p>
          <code className="block max-h-24 overflow-auto rounded-xl bg-edge/10 p-2 text-left text-xs">{this.state.error.message}</code>
          <div className="flex gap-3">
            <button className="btn flex-1" onClick={() => location.reload()}>Recargar</button>
            <a className="btn btn-cyan flex-1" href="/">Ir al inicio</a>
          </div>
        </div>
      </main>
    )
  }
}
