import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ComunidadFoto } from '../types/database'
import { srcsetImagen } from '../lib/imagenes'

const NOMBRE_USUARIOS = [
  '@lucas.fit',
  '@sofia.style',
  '@mati.urban',
  '@camila.look',
  '@juanki.street',
  '@valen.mode',
  '@agustín.kai',
  '@flor.outfit',
]

const FOTOS_FALLBACK = [
  'https://images.unsplash.com/photo-1523398002811-999ca8dec234?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1503342394128-c104d54dba01?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=600&q=80&auto=format&fit=crop',
]

interface FotoDisplay {
  id: string
  autor: string
  handle: string | null
  img: string
}

export function CommunitySection() {
  const carouselRef = useRef<HTMLDivElement>(null)
  const [fotos, setFotos] = useState<FotoDisplay[]>([])
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    let activo = true

    async function cargar() {
      const { data } = await supabase
        .from('comunidad_fotos')
        .select('*')
        .eq('aprobado', true)
        .order('orden', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (!activo) return

      const reales = (data ?? []) as ComunidadFoto[]
      if (reales.length > 0) {
        setFotos(
          reales.map((f) => ({
            id: f.id,
            autor: f.nombre_usuario || '@ikigai',
            handle: f.instagram_handle ?? null,
            img: f.imagen_url,
          })),
        )
      } else {
        setFotos(
          FOTOS_FALLBACK.map((img, i) => ({
            id: `fallback-${i}`,
            autor: NOMBRE_USUARIOS[i] ?? '@ikigai',
            handle: null,
            img,
          })),
        )
      }
      setCargado(true)
    }

    cargar()
    return () => { activo = false }
  }, [])

  if (!cargado) {
    return (
      <section className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-sm border border-base-300/60 p-6 my-8">
          <div className="skeleton h-8 w-72 mb-6 rounded-sm"></div>
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="shrink-0 w-40 md:w-44 aspect-[9/16] skeleton rounded-sm"></div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="max-w-7xl mx-auto px-4 py-6">
      <div className="bg-white rounded-sm border border-base-300/60 p-6 my-8">
        <h2 className="text-2xl md:text-3xl font-bold mb-6">
          Nuestra Comunidad Vistiendo Ikigai!
        </h2>

        <div
          ref={carouselRef}
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3 scrollbar-thin-ikigai"
        >
          {fotos.map((foto) => (
            <div
              key={foto.id}
              className="snap-center shrink-0 w-40 md:w-44 aspect-[9/16] rounded-sm overflow-hidden bg-base-200 border border-base-300/60 relative group"
            >
              <img
                src={foto.img}
                srcSet={srcsetImagen(foto.img, 176).srcset}
                sizes={srcsetImagen(foto.img, 176).sizes}
                alt={
                  foto.handle
                    ? `Look de la comunidad de ${foto.autor} (${foto.handle})`
                    : `Look de la comunidad de ${foto.autor}`
                }
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                decoding="async"
                width={176}
                height={313}
              />
              <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/50 to-transparent" />
              <span className="absolute bottom-2 left-2 text-white text-xs font-semibold drop-shadow">
                {foto.autor}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
