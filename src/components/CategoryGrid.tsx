import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCategorias } from '../hooks/useCategorias'
import { obtenerUrlImagen, IMAGEN_FALLBACK } from '../lib/imagenes'
import type { Categoria } from '../types/database'

function CategoriaCard({ categoria }: { categoria: Categoria }) {
  const link = categoria.slug ? `/catalogo?categoria=${encodeURIComponent(categoria.slug)}` : '/productos'
  const imagen = obtenerUrlImagen(categoria.imagen_url, { carpeta: 'categorias' })
  const [falloImagen, setFalloImagen] = useState(false)
  const src = falloImagen ? IMAGEN_FALLBACK : imagen

  return (
    <Link
      to={link}
      className="group relative block aspect-[16/10] sm:aspect-[3/3] md:aspect-[4/3] overflow-hidden rounded-sm bg-white transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg border border-base-300/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
    >
      <img
        src={src}
        alt={`Ver ${categoria.nombre} del catálogo`}
        loading="lazy"
        decoding="async"
        width={480}
        height={360}
        onError={() => setFalloImagen(true)}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-white via-white/25 to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
        <span className="block h-1 w-8 bg-red-600 mb-2 md:mb-3 transition-all duration-300 group-hover:w-14" />
        <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tight leading-none text-black">
          {categoria.nombre}
        </h3>
        <span className="inline-flex items-center gap-1.5 mt-2 md:mt-3 text-xs md:text-sm font-bold uppercase tracking-wider text-red-600">
          Ver más
          <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </span>
      </div>
    </Link>
  )
}

export function CategoryGrid() {
  const { categorias } = useCategorias()

  return (
    <section className="py-12 md:py-16 bg-white border-t border-base-300">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-5">
        <div className="text-center mb-8 md:mb-10">
          <p className="text-xs font-semibold tracking-[0.25em] uppercase opacity-60 mb-1">
            Explorá la tienda
          </p>
          <h2 className="text-2xl md:text-4xl font-bold">Categorías</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-5">
          {categorias.map((categoria) => (
            <CategoriaCard key={categoria.id} categoria={categoria} />
          ))}
        </div>
      </div>
    </section>
  )
}