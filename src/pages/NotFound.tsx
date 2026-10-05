import { Link } from 'react-router-dom'
import { useSeo } from '../hooks/useSeo'

export function NotFound() {
  useSeo({
    title: 'Página no encontrada · Ikigai Clothes',
    description: 'La página que buscabas no existe o cambió de dirección.',
    noindex: true,
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <p className="font-mono text-7xl md:text-8xl font-bold leading-none text-neutral">
        404
      </p>
      <h1 className="font-display text-2xl md:text-3xl mt-4 mb-3">
        Te perdiste el par
      </h1>
      <p className="text-sm opacity-70 mb-8">
        La página que buscabas no existe, cambió de dirección o nunca existió. Revisá el link o
        volvé al catálogo a buscar lo que necesitás.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link to="/catalogo" className="btn btn-primary">
          Ver catálogo
        </Link>
        <Link to="/" className="btn btn-outline">
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
