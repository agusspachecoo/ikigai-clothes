import { ProductCard } from './ProductCard'
import type { ProductoConStock } from '../types/database'

interface Props {
  productos: ProductoConStock[]
  loading?: boolean
}

/**
 * Grilla estática de productos. Usa exactamente las mismas clases que la
 * grilla del catálogo (grid-cols-2 md:grid-cols-3 xl:grid-cols-4, gap-4) y las
 * mismas tarjetas `ProductCard` (aspect-[3/4]), para que las dimensiones sean
 * uniformes en toda la tienda.
 */
export function ProductGrid({ productos, loading = false }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton aspect-[3/4] w-full rounded-none" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {productos.map((p) => (
        <ProductCard key={p.id} producto={p} />
      ))}
    </div>
  )
}
