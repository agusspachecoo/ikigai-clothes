import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getBannersPublic } from '../lib/adminApi'
import { IMAGEN_FALLBACK, normalizarUrlImagen, srcsetImagen } from '../lib/imagenes'
import type { Banner } from '../types/database'
import { ImagenSegura } from './ImagenSegura'

const BANNERS_POR_DEFECTO: Banner[] = [
  {
    id: 'default-1',
    imagen_url:
      'https://images.unsplash.com/photo-1523398002811-999ca8dec234?q=80&w=1800&auto=format&fit=crop',
    imagen_mobile: null,
    titulo: 'Ropa urbana con estilo',
    link_url: '/catalogo',
    orden: 0,
    activo: true,
    created_at: '',
  },
  {
    id: 'default-2',
    imagen_url:
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1800&auto=format&fit=crop',
    imagen_mobile: null,
    titulo: 'Nueva temporada',
    link_url: '/catalogo',
    orden: 1,
    activo: true,
    created_at: '',
  },
  {
    id: 'default-3',
    imagen_url:
      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1800&auto=format&fit=crop',
    imagen_mobile: null,
    titulo: 'Encontrá tu esencia',
    link_url: '/outfits',
    orden: 2,
    activo: true,
    created_at: '',
  },
  {
    id: 'default-4',
    imagen_url:
      'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?q=80&w=1800&auto=format&fit=crop',
    imagen_mobile: null,
    titulo: 'Outfits para cada día',
    link_url: '/outfits',
    orden: 3,
    activo: true,
    created_at: '',
  },
]

const AUTOPLAY_MS = 5000
const CLASE_HERO =
  'relative aspect-[4/3] md:aspect-[21/9] md:max-h-[80vh] w-full overflow-hidden bg-base-200 animate-fade-in'

function BannerImagen({
  banner,
  prioridad,
  onReady,
}: {
  banner: Banner
  prioridad: boolean
  onReady: () => void
}) {
  const [fallo, setFallo] = useState(false)

  if (fallo) {
    return (
      <img
        src={IMAGEN_FALLBACK}
        alt={banner.titulo ?? 'Ikigai Clothes'}
        loading={prioridad ? 'eager' : 'lazy'}
        decoding={prioridad ? 'sync' : 'async'}
        width={1920}
        height={820}
        onLoad={onReady}
        onError={(e) => {
          ;(e.currentTarget as HTMLElement).style.display = 'none'
        }}
        className="h-full w-full object-cover md:object-contain"
      />
    )
  }

  const srcsetMovil = banner.imagen_mobile
    ? (srcsetImagen(banner.imagen_mobile, 640, true, { carpeta: 'banners' }).srcset ??
      normalizarUrlImagen(banner.imagen_mobile, { carpeta: 'banners' }))
    : null
  const srcsetDesktop =
    srcsetImagen(banner.imagen_url, 1600, true, { carpeta: 'banners' }).srcset ??
    normalizarUrlImagen(banner.imagen_url, { carpeta: 'banners' })

  return (
    <picture>
      {srcsetMovil && (
        <source media="(max-width: 767px)" srcSet={srcsetMovil} sizes="100vw" />
      )}
      <source media="(min-width: 768px)" srcSet={srcsetDesktop} sizes="100vw" />
      <ImagenSegura
        carpeta="banners"
        src={banner.imagen_url}
        srcSet={srcsetDesktop}
        sizes="100vw"
        alt={banner.titulo ?? 'Ikigai Clothes'}
        loading={prioridad ? 'eager' : 'lazy'}
        fetchPriority={prioridad ? 'high' : 'auto'}
        decoding={prioridad ? 'sync' : 'async'}
        width={1920}
        height={820}
        onLoad={onReady}
        onError={() => setFallo(true)}
        className="h-full w-full object-cover md:object-contain"
      />
    </picture>
  )
}

export function HeroCarousel() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [cargando, setCargando] = useState(true)
  const [primeraImagenLista, setPrimeraImagenLista] = useState(false)
  const [actual, setActual] = useState(0)

  useEffect(() => {
    let activo = true

    async function cargarBanners() {
      try {
        const res = await getBannersPublic()
        if (!activo) return
        if (res.error) {
          setBanners(BANNERS_POR_DEFECTO)
        } else {
          const configurados = res.data.filter((b) => b.imagen_url.trim() !== '')
          setBanners(configurados.length > 0 ? configurados : BANNERS_POR_DEFECTO)
        }
      } catch {
        if (activo) setBanners(BANNERS_POR_DEFECTO)
      } finally {
        if (activo) setCargando(false)
      }
    }

    void cargarBanners()
    return () => {
      activo = false
    }
  }, [])

  const total = banners.length
  const pausado = useRef(false)
  const listo = primeraImagenLista && !cargando

  useEffect(() => {
    if (!listo || total <= 1) return
    const timer = window.setInterval(() => {
      if (!pausado.current) setActual((i) => (i + 1) % total)
    }, AUTOPLAY_MS)
    return () => window.clearInterval(timer)
  }, [listo, total])

  if (cargando || total === 0) {
    return (
      <section className={CLASE_HERO} aria-busy="true" aria-label="Cargando banner">
        <div className="absolute inset-0 skeleton rounded-none" />
        <div className="absolute inset-x-0 bottom-0 space-y-3 p-6 md:p-10">
          <div className="skeleton h-7 w-56 rounded md:h-10 md:w-80" />
          <div className="skeleton h-9 w-32 rounded" />
        </div>
        <span className="sr-only">Cargando banner principal</span>
      </section>
    )
  }

  function irA(index: number) {
    setActual((index + total) % total)
  }

  return (
    <section
      className={CLASE_HERO}
      aria-label="Banner principal"
      aria-busy={!listo}
      onMouseEnter={() => { pausado.current = true }}
      onMouseLeave={() => { pausado.current = false }}
    >
      <div
        className="flex h-full w-full transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${actual * 100}%)` }}
      >
        {banners.map((banner, i) => (
          <div key={banner.id} className="relative h-full w-full shrink-0">
            <BannerImagen
              banner={banner}
              prioridad={i === 0}
              onReady={() => {
                if (i === 0) setPrimeraImagenLista(true)
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

            {banner.link_url ? (
              <Link
                to={banner.link_url}
                className="absolute inset-0"
                aria-label={banner.titulo ?? 'Ir a la oferta'}
              />
            ) : null}

            {(banner.titulo || banner.link_url) && (
              <div className="absolute inset-x-0 bottom-0 p-6 md:p-10 text-white pointer-events-none">
                {banner.titulo && (
                  <h2 className="text-2xl md:text-4xl font-bold drop-shadow-md font-display">
                    {banner.titulo}
                  </h2>
                )}
                {banner.link_url && (
                  <Link
                    to={banner.link_url}
                    className="btn btn-sm md:btn-md mt-3 border border-white/50 bg-white/15 backdrop-blur-sm text-white hover:bg-white hover:text-neutral transition-colors pointer-events-auto"
                  >
                    Ver catálogo
                  </Link>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {!primeraImagenLista && (
        <div className="absolute inset-0 z-30 bg-base-200" aria-hidden="true">
          <div className="absolute inset-0 skeleton rounded-none" />
          <div className="absolute inset-x-0 bottom-0 space-y-3 p-6 md:p-10">
            <div className="skeleton h-7 w-56 rounded md:h-10 md:w-80" />
            <div className="skeleton h-9 w-32 rounded" />
          </div>
        </div>
      )}

      {/* Flechas */}
      {listo && total > 1 && (
        <>
          <button
            aria-label="Slide anterior"
            onClick={() => irA(actual - 1)}
            className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 btn btn-circle btn-sm md:btn-md bg-white/10 text-white border-white/30 backdrop-blur-sm hover:bg-white/25 transition-colors"
          >
            <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            aria-label="Slide siguiente"
            onClick={() => irA(actual + 1)}
            className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 btn btn-circle btn-sm md:btn-md bg-white/10 text-white border-white/30 backdrop-blur-sm hover:bg-white/25 transition-colors"
          >
            <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </>
      )}

      {/* Puntos */}
      {listo && total > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2">
          {banners.map((banner, i) => (
            <button
              key={banner.id}
              aria-label={`Ir al slide ${i + 1}`}
              onClick={() => irA(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === actual ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
