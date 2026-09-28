import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getBannersPublic } from '../lib/adminApi'
import type { Banner } from '../types/database'

const BANNERS_POR_DEFECTO: Banner[] = [
  {
    id: 'default-1',
    imagen_url:
      'https://images.unsplash.com/photo-1523398002811-999ca8dec234?q=80&w=1800&auto=format&fit=crop',
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
    titulo: 'Outfits para cada día',
    link_url: '/outfits',
    orden: 3,
    activo: true,
    created_at: '',
  },
]

const AUTOPLAY_MS = 5000

export function HeroCarousel() {
  const [banners, setBanners] = useState<Banner[]>(BANNERS_POR_DEFECTO)
  const [actual, setActual] = useState(0)

  useEffect(() => {
    let activo = true

    getBannersPublic().then((res) => {
      if (!activo) return
      if (res.error) {
        setBanners(BANNERS_POR_DEFECTO)
        return
      }
      const configurados = res.data.filter((b) => b.imagen_url.trim() !== '')
      setBanners(configurados.length > 0 ? configurados : BANNERS_POR_DEFECTO)
    })

    return () => {
      activo = false
    }
  }, [])

  const total = banners.length
  const pausado = useRef(false)

  useEffect(() => {
    if (total <= 1) return
    const timer = window.setInterval(() => {
      if (!pausado.current) setActual((i) => (i + 1) % total)
    }, AUTOPLAY_MS)
    return () => window.clearInterval(timer)
  }, [total])

  if (total === 0) return null

  function irA(index: number) {
    setActual((index + total) % total)
  }

  return (
    <section
      className="relative h-[380px] md:h-[440px] w-full overflow-hidden bg-base-200"
      onMouseEnter={() => { pausado.current = true }}
      onMouseLeave={() => { pausado.current = false }}
    >
      <div
        className="flex h-full w-full transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${actual * 100}%)` }}
      >
        {banners.map((banner, i) => (
          <div key={banner.id} className="relative h-full w-full shrink-0">
            <img
              src={banner.imagen_url}
              alt={banner.titulo ?? 'Ikigai Clothes'}
              loading={i === 0 ? 'eager' : 'lazy'}
              className="h-full w-full object-cover"
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

      {/* Flechas */}
      {total > 1 && (
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
      {total > 1 && (
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