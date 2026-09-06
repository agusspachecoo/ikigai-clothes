import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { OutfitConItems } from '../types/database'
import { imagenOutfit } from '../lib/imagenes'
import { BuyOutfitModal } from './BuyOutfitModal'

interface Props {
  outfits: OutfitConItems[]
}

const ICONO_BOLSA = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
    />
  </svg>
)

export function OutfitCarousel({ outfits }: Props) {
  const carouselRef = useRef<HTMLDivElement>(null)
  const [indiceActivo, setIndiceActivo] = useState(0)
  const [outfitSeleccionado, setOutfitSeleccionado] = useState<OutfitConItems | null>(null)

  function onScrollCarousel() {
    const el = carouselRef.current
    if (!el || el.scrollWidth === el.clientWidth) return
    const idx = Math.round(
      (el.scrollLeft / (el.scrollWidth - el.clientWidth)) * (outfits.length - 1),
    )
    setIndiceActivo(Math.min(Math.max(idx, 0), outfits.length - 1))
  }

  function irA(indice: number) {
    const el = carouselRef.current
    if (!el) return
    el.scrollTo({ left: (el.scrollWidth / outfits.length) * indice, behavior: 'smooth' })
    setIndiceActivo(indice)
  }

  return (
    <section className="py-12 md:py-20 bg-base-100 border-t border-base-300">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-8 md:mb-10">
          <h2 className="text-2xl md:text-4xl font-bold">Compra el Conjunto</h2>
          <p className="opacity-60 mt-2 text-sm md:text-base">
            {outfits.length > 0
              ? 'Completá tu look con las prendas destacadas'
              : 'No hay outfits disponibles por el momento'}
          </p>
        </div>

        {outfits.length > 0 && (
          <>
            {/* Carrusel */}
            <div
              ref={carouselRef}
              onScroll={onScrollCarousel}
              className="flex gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory px-1 pb-4 no-scrollbar"
            >
              {outfits.map((o, i) => (
                <div key={o.id} className="snap-center shrink-0 w-64 md:w-72">
                  <button
                    onClick={() => setOutfitSeleccionado(o)}
                    aria-label={`Ver detalle del look ${o.nombre}`}
                    className="relative block w-full rounded-3xl overflow-hidden aspect-[3/4] bg-base-300 shadow-sm cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <img
                      src={imagenOutfit(o.imagen_portada, i)}
                      alt={o.nombre}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        const img = e.currentTarget
                        if (!img.dataset.fallback) {
                          img.dataset.fallback = '1'
                          img.src = `https://picsum.photos/seed/ikigai-outfit-${i}/600/800`
                        }
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/35 to-transparent" />

                    <span className="absolute bottom-4 left-1/2 -translate-x-1/2 btn btn-circle btn-lg bg-sky-500 hover:bg-sky-400 border-0 shadow-lg shadow-sky-500/40 text-white pointer-events-none">
                      {ICONO_BOLSA}
                    </span>
                  </button>

                  <div className="pt-3 text-center">
                    <h3 className="font-semibold text-sm md:text-base">{o.nombre}</h3>
                    <p className="text-primary font-bold text-lg mt-0.5">
                      $ {o.precio_combo.toLocaleString('es-AR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Dots */}
            <div className="flex justify-center items-center gap-2 mt-6">
              {outfits.map((_, i) => (
                <button
                  key={i}
                  onClick={() => irA(i)}
                  aria-label={`Ir al outfit ${i + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === indiceActivo ? 'w-6 bg-sky-500' : 'w-2 bg-base-300 hover:bg-base-400'
                  }`}
                />
              ))}
            </div>

            <div className="text-center mt-6">
              <Link to="/outfits" className="btn btn-outline btn-primary">
                Ver todos los outfits
              </Link>
            </div>
          </>
        )}
      </div>

      <BuyOutfitModal outfit={outfitSeleccionado} onClose={() => setOutfitSeleccionado(null)} />
    </section>
  )
}