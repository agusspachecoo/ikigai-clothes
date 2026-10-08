import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useProductos } from '../hooks/useProductos'
import { ProductCard } from './ProductCard'

interface Props {
  categoria: string
  productoId: string
}

export function ProductosRelacionados({ categoria, productoId }: Props) {
  const { productos, loading } = useProductos({ categoria, limit: 5 })

  const relacionados = useMemo(
    () => productos.filter((p) => p.id !== productoId).slice(0, 4),
    [productos, productoId],
  )

  if (!loading && relacionados.length === 0) return null

  return (
    <section className="mt-16 md:mt-20">
      <div className="flex items-end justify-between mb-6 gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] uppercase opacity-60 mb-1">
            También te puede interesar
          </p>
          <h2 className="text-2xl md:text-3xl font-bold">Productos Relacionados</h2>
        </div>
        <Link to="/catalogo" className="btn btn-outline btn-primary btn-sm md:btn-md shrink-0">
          Ver todos
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-64 w-full rounded-lg"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {relacionados.map((p) => (
            <ProductCard key={p.id} producto={p} />
          ))}
        </div>
      )}
    </section>
  )
}