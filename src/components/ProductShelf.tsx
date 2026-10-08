import { Link } from 'react-router-dom'
import { ProductCard } from './ProductCard'
import type { ProductoConStock } from '../types/database'

interface Props {
  titulo: string
  subtitulo?: string
  productos: ProductoConStock[]
  loading?: boolean
  linkVerTodos?: string
}

export function ProductShelf({ titulo, subtitulo, productos, loading, linkVerTodos }: Props) {
  return (
    <section className="py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-end justify-between mb-6 gap-4">
          <div>
            {subtitulo && (
              <p className="text-xs font-semibold tracking-[0.25em] uppercase opacity-60 mb-1">
                {subtitulo}
              </p>
            )}
            <h2 className="text-2xl md:text-3xl font-bold">{titulo}</h2>
          </div>
          {linkVerTodos && (
            <Link to={linkVerTodos} className="btn btn-outline btn-primary btn-sm md:btn-md shrink-0">
              Ver todos
            </Link>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-64 w-full rounded-lg"></div>
            ))}
          </div>
        ) : productos.length === 0 ? (
          <p className="opacity-60 text-center py-10">
            No hay productos disponibles por el momento.
          </p>
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