import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { OutfitConItems } from '../types/database'
import { obtenerUrlImagen, IMAGEN_FALLBACK } from '../lib/imagenes'
import { BuyOutfitModal } from './BuyOutfitModal'

interface Props {
  outfits: OutfitConItems[]
}

const TAMAILO_VISTA_DESKTOP = 4
const TAMAILO_VISTA_MOVIL = 1

const ICONO_BOLSA = (
  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.9">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
    />
  </svg>
)

function OutfitCardImagen({ outfit }: { outfit: OutfitConItems }) {
  const [fallo, setFallo] = useState(false)

  const urlFinal = obtenerUrlImagen(outfit.imagen_portada)

  if (fallo || !urlFinal) {
    return (
      <img
        src={IMAGEN_FALLBACK}
        alt={`Look ${outfit.nombre}`}
        className="w-full h-full object-cover object-[center_20%]"
        loading="lazy"
        decoding="async"
        width={280}
        height={498}
      />
    )
  }

  return (
    <img
      src={urlFinal}
      alt={`Look ${outfit.nombre} con precio de combo`}
      className="w-full h-full object-cover object-[center_20%] transition-transform duration-700 ease-out group-hover:scale-105"
      loading="lazy"
      decoding="async"
      width={280}
      height={498}
      onError={() => {
        setFallo(true)
      }}
    />
  )
}

function esPantallaMovil(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(max-width: 767px)').matches
}

export function OutfitCarousel({ outfits }: Props) {
  const [outfitSeleccionado, setOutfitSeleccionado] = useState<OutfitConItems | null>(null)
  const [indiceSlide, setIndiceSlide] = useState(0)
  const [esMovil, setEsMovil] = useState(esPantallaMovil)
  const trackRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(max-width: 767px)')
    const handler = (evento: MediaQueryListEvent) => setEsMovil(evento.matches)
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [])

  const tamanoVista = esMovil ? TAMAILO_VISTA_MOVIL : TAMAILO_VISTA_DESKTOP

  const paginas: OutfitConItems[][] = []
  for (let i = 0; i < outfits.length; i += tamanoVista) {
    paginas.push(outfits.slice(i, i + tamanoVista))
  }
  const totalPaginas = paginas.length
  const paginaActiva = Math.floor(indiceSlide / tamanoVista)

  const irSlide = (index: number) => {
    const track = trackRef.current
    const slide = track?.children[index] as HTMLElement | undefined
    slide?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }

  const manejarScroll = () => {
    const track = trackRef.current
    if (!track || track.children.length === 0) return
    const primero = track.children[0] as HTMLElement
    const segundo = track.children[1] as HTMLElement | undefined
    const stride = segundo ? segundo.offsetLeft - primero.offsetLeft : primero.offsetWidth
    if (stride <= 0) return
    const maxScroll = track.scrollWidth - track.clientWidth
    const alFinal = maxScroll > 0 && track.scrollLeft >= maxScroll - stride / 2
    const indice = alFinal
      ? track.children.length - 1
      : Math.round(track.scrollLeft / stride)
    setIndiceSlide(Math.max(0, indice))
  }

  return (
    <section className="py-12 md:py-20 bg-base-100 border-t border-base-300">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5">
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
            <div
              ref={trackRef}
              onScroll={manejarScroll}
              className="flex gap-4 md:gap-6 overflow-x-auto flex snap-x snap-mandatory scrollbar-none pb-2 -mx-3 px-3 sm:-mx-5 sm:px-5 touch-pan-x overscroll-x-contain"
            >
              {outfits.map((o) => (
                <div key={o.id} className="snap-start shrink-0 w-full md:w-[calc(25%_-_1rem)]">
                  <button
                    onClick={() => setOutfitSeleccionado(o)}
                    aria-label={`Ver detalle del look ${o.nombre}`}
                    className="relative block w-full aspect-[9/16] rounded-2xl overflow-hidden bg-neutral-100 cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <OutfitCardImagen outfit={o} />
                    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/35 to-transparent pointer-events-none" />

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
                      ${(o.precio_combo * 0.8).toLocaleString('es-AR')} {' '}
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

            {totalPaginas > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                {paginas.map((_, paginaIndex) => (
                  <button
                    key={`pagina-${paginaIndex}`}
                    type="button"
                    onClick={() => irSlide(paginaIndex * tamanoVista)}
                    aria-label={`Ir a la vista ${paginaIndex + 1} de outfits`}
                    aria-current={paginaIndex === paginaActiva}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      paginaIndex === paginaActiva ? 'w-8 bg-sky-500' : 'w-2.5 bg-neutral-300'
                    }`}
                  />
                ))}
              </div>
            )}

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
