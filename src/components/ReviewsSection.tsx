import { useResenasDestacadas } from '../hooks/useProductosHome'
import type { ResenaDestacada } from '../hooks/useProductosHome'

function Estrellas({ puntuacion }: { puntuacion: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${puntuacion} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          className={`h-4 w-4 ${n <= puntuacion ? 'text-red-600' : 'text-base-300'}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" />
        </svg>
      ))}
    </div>
  )
}

function Tarjeta({ resena }: { resena: ResenaDestacada }) {
  return (
    <div className="card bg-white rounded-sm p-5 flex flex-col gap-3 border border-base-300/60">
      <div className="flex items-center justify-between gap-2">
        <div className="w-9 h-9 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold text-sm shrink-0">
          {resena.nombre_usuario.trim().charAt(0).toUpperCase()}
        </div>
        <Estrellas puntuacion={resena.puntuacion} />
      </div>

      <p className="text-sm leading-relaxed text-base-content/80 line-clamp-4">
        &ldquo;{resena.comentario}&rdquo;
      </p>

      <div className="mt-auto pt-2 border-t border-base-300/60">
        <p className="text-sm font-bold text-black">{resena.nombre_usuario}</p>
        {resena.producto_nombre && (
          <p className="text-xs opacity-60 mt-0.5">Compró: {resena.producto_nombre}</p>
        )}
      </div>
    </div>
  )
}

export function ReviewsSection() {
  const { resenas, loading } = useResenasDestacadas(6)

  if (loading) {
    return (
      <section className="py-12 md:py-16 bg-white border-t border-base-300">
        <div className="max-w-7xl mx-auto px-4">
          <div className="skeleton h-8 w-72 mb-8 rounded-sm"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-48 w-full rounded-sm"></div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-12 md:py-16 bg-white border-t border-base-300">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-8 md:mb-10">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase opacity-60 mb-1">
            Opiniones reales
          </p>
          <h2 className="text-2xl md:text-4xl font-bold">Lo que dicen nuestros clientes</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {resenas.map((r) => (
            <Tarjeta key={r.id} resena={r} />
          ))}
        </div>
      </div>
    </section>
  )
}