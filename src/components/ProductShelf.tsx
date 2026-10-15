import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ProductCard } from './ProductCard'
import type { ProductoConStock } from '../types/database'

interface Props {
  titulo: string
  subtitulo?: string
  productos: ProductoConStock[]
  loading?: boolean
  linkVerTodos?: string
  /** `carrusel` (inicio) desplaza en horizontal; `grilla` es el layout clásico. */
  variante?: 'carrusel' | 'grilla'
}

// Ancho de cada tarjeta: en mobile entran ~2, en desktop ~5.
const ITEM_CLS =
  'shrink-0 snap-start w-[46%] sm:w-[31%] lg:w-[23.5%] xl:w-[19%]'

export function ProductShelf({
  titulo,
  subtitulo,
  productos,
  loading,
  linkVerTodos,
  variante = 'carrusel',
}: Props) {
  const pistaRef = useRef<HTMLDivElement>(null)

  function desplazar(direccion: 1 | -1) {
    const pista = pistaRef.current
    if (!pista) return
    pista.scrollBy({ left: direccion * pista.clientWidth * 0.9, behavior: 'smooth' })
  }

  return (
    <section className="py-12 md:py-16">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5">
        <div className="flex items-end justify-between mb-6 gap-4">
          <div>
            {subtitulo && (
              <p className="text-xs font-semibold tracking-[0.25em] uppercase opacity-60 mb-1">
                {subtitulo}
              </p>
            )}
            <h2 className="text-2xl md:text-3xl font-bold">{titulo}</h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {variante === 'carrusel' && (
              <div className="hidden md:flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Ver productos anteriores"
                  onClick={() => desplazar(-1)}
                  className="btn btn-outline btn-sm btn-circle"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Ver más productos"
                  onClick={() => desplazar(1)}
                  className="btn btn-outline btn-sm btn-circle"
                >
                  ›
                </button>
              </div>
            )}
            {linkVerTodos && (
              <Link to={linkVerTodos} className="btn btn-outline btn-primary btn-sm md:btn-md">
                Ver todos
              </Link>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`${ITEM_CLS} skeleton aspect-[9/16] rounded-lg`} />
            ))}
          </div>
        ) : productos.length === 0 ? (
          <p className="opacity-60 text-center py-10">
            No hay productos disponibles por el momento.
          </p>
        ) : variante === 'carrusel' ? (
          <div
            ref={pistaRef}
            className="no-scrollbar flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-3 sm:-mx-5 px-3 sm:px-5"
          >
            {productos.map((p) => (
              <div key={p.id} className={ITEM_CLS}>
                <ProductCard producto={p} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {productos.map((p) => (
              <ProductCard key={p.id} producto={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
