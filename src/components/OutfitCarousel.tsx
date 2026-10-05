import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { OutfitConItems } from '../types/database'
import { imagenOutfit, srcsetImagen } from '../lib/imagenes'
import { BuyOutfitModal } from './BuyOutfitModal'

interface Props {
  outfits: OutfitConItems[]
}

const LIMITE = 4

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
  const [outfitSeleccionado, setOutfitSeleccionado] = useState<OutfitConItems | null>(null)

  const visibles = outfits.slice(0, LIMITE)

  return (
    <section className="py-12 md:py-20 bg-base-100 border-t border-base-300">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-8 md:mb-10">
          <h2 className="text-2xl md:text-4xl font-bold">Compra el Conjunto (5% off)</h2>
          <p className="opacity-60 mt-2 text-sm md:text-base">
            {outfits.length > 0
              ? 'Completá tu look con las prendas destacadas'
              : 'No hay outfits disponibles por el momento'}
          </p>
        </div>

        {outfits.length > 0 && (
          <>
            {/* Grid de outfits */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {visibles.map((o, i) => (
                <div key={o.id}>
                  <button
                    onClick={() => setOutfitSeleccionado(o)}
                    aria-label={`Ver detalle del look ${o.nombre}`}
                    className="relative block w-full aspect-video rounded-2xl overflow-hidden bg-neutral-100 cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <img
                      src={imagenOutfit(o.imagen_portada, i)}
                      srcSet={srcsetImagen(o.imagen_portada, 280).srcset}
                      sizes={srcsetImagen(o.imagen_portada, 280).sizes}
                      alt={`Look ${o.nombre} con precio de combo`}
                      className="w-full h-full object-cover object-[center_20%] transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                      decoding="async"
                      width={280}
                      height={158}
                      onError={(e) => {
                        const img = e.currentTarget
                        if (!img.dataset.fallback) {
                          img.dataset.fallback = '1'
                          // Al cambiar el src hay que limpiar el srcset: si no,
                          // el navegador sigue pidiendo la imagen rota.
                          img.removeAttribute('srcset')
                          img.src = `https://picsum.photos/seed/ikigai-outfit-${i}/600/800`
                        }
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/35 to-transparent" />

                    <span className="absolute bottom-4 left-1/2 -translate-x-1/2 btn btn-circle btn-lg bg-sky-500 hover:bg-sky-400 border-0 text-white pointer-events-none">
                      {ICONO_BOLSA}
                    </span>
                  </button>

                  <div className="pt-3 text-center">
                    <h3 className="font-semibold text-sm md:text-base truncate">{o.nombre}</h3>
                    <p className="text-sm text-base-content/60 mt-0.5">
                      ${o.precio_combo.toLocaleString('es-AR')}
                    </p>
                    <p className="font-bold text-base-content mt-0.5">
                      ${(o.precio_combo * 0.8).toLocaleString('es-AR')}{' '}
                      <span className="text-xs font-medium opacity-60">por Transferencia</span>
                    </p>
                    <p className="inline-flex items-center gap-1.5 rounded-sm bg-green-100 text-green-800 px-2 py-1 text-xs font-semibold">
                      <span aria-hidden="true">💳</span>
                      6 cuotas de ${(o.precio_combo / 6).toLocaleString('es-AR')} sin interés
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-8">
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