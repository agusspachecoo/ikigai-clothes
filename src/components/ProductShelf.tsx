import { useCallback, useEffect, useRef, useState } from 'react'
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

// Ancho de cada tarjeta: ~2 en mobile, ~4 en tablet y exactamente 5 visibles
// en desktop (descontando los 4 gaps de 1rem = 0.8rem por tarjeta). El carrusel
// ocupa todo el ancho de la pantalla.
const ITEM_CLS =
  'shrink-0 snap-start w-[46%] sm:w-[31%] md:w-[23%] lg:w-[calc(20%_-_0.8rem)]'

const FLECHA_CLS =
  'absolute top-1/2 -translate-y-1/2 z-20 hidden md:flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-neutral-800 shadow-md ring-1 ring-black/5 backdrop-blur transition hover:bg-white hover:scale-105 active:scale-95'

export function ProductShelf({
  titulo,
  subtitulo,
  productos,
  loading,
  linkVerTodos,
  variante = 'carrusel',
}: Props) {
  const pistaRef = useRef<HTMLDivElement>(null)
  const [hayScroll, setHayScroll] = useState(false)

  const medir = useCallback(() => {
    const pista = pistaRef.current
    if (!pista) return

    setHayScroll(pista.scrollWidth > pista.clientWidth + 1)
  }, [])

  useEffect(() => {
    const pista = pistaRef.current
    if (!pista) return

    medir()
    const observer = new ResizeObserver(medir)
    observer.observe(pista)
    window.addEventListener('resize', medir)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', medir)
    }
  }, [medir, loading, variante, productos.length])

  function desplazar(direccion: 1 | -1) {
    const pista = pistaRef.current
    if (!pista) return
    
    const item = pista.querySelector<HTMLElement>('[data-carousel-item]')
    if (!item) return

    const gap = parseFloat(getComputedStyle(pista).gap || '16')
    // Desplazamos de a 2 productos para que se mueva con más fluidez y dinamismo
    const step = (item.getBoundingClientRect().width + gap) * 2
    
    pista.scrollBy({ left: direccion * step, behavior: 'smooth' })
  }

  return (
    <section className="py-12 md:py-16 w-full">
      <div className="flex items-end justify-between gap-4 mb-6 px-3 sm:px-5">
        <div>
          {subtitulo && (
            <p className="text-xs font-semibold tracking-[0.25em] uppercase opacity-60 mb-1">
              {subtitulo}
            </p>
          )}
          <h2 className="text-2xl md:text-3xl font-bold">{titulo}</h2>
        </div>

        {linkVerTodos && (
          <Link
            to={linkVerTodos}
            className="shrink-0 btn btn-outline btn-primary btn-sm md:btn-md"
          >
            Ver todos
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex gap-3 md:gap-4 overflow-hidden px-3 sm:px-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`${ITEM_CLS} skeleton aspect-[3/4] rounded-lg`} />
          ))}
        </div>
      ) : productos.length === 0 ? (
        <p className="opacity-60 text-center py-10">
          No hay productos disponibles por el momento.
        </p>
      ) : variante === 'carrusel' ? (
        <div className="relative">
          {hayScroll && (
            <>
              <button
                type="button"
                aria-label="Ver productos anteriores"
                onClick={() => desplazar(-1)}
                className={`${FLECHA_CLS} left-2 lg:left-4`}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Ver más productos"
                onClick={() => desplazar(1)}
                className={`${FLECHA_CLS} right-2 lg:right-4`}
              >
                ›
              </button>
            </>
          )}

          <div
            ref={pistaRef}
            className="no-scrollbar flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 px-3 sm:px-5"
          >
            {productos.map((p) => (
              <div key={p.id} data-carousel-item className={ITEM_CLS}>
                <ProductCard producto={p} onImageLoad={medir} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-3 sm:px-5">
          {productos.map((p) => (
            <ProductCard key={p.id} producto={p} />
          ))}
        </div>
      )}
    </section>
  )
}