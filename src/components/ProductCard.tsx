import { Link } from 'react-router-dom'
import type { ProductoConStock } from '../types/database'

export function ProductCard({ producto }: { producto: ProductoConStock }) {
  return (
    <Link
      to={`/producto/${producto.id}`}
      className="card group bg-base-100 shadow-sm hover:shadow-md transition-all overflow-hidden"
    >
      <figure className="relative aspect-[3/4] bg-base-300 overflow-hidden">
        {producto.imagenes[0] && (
          <img
            src={producto.imagenes[0]}
            alt={producto.nombre}
            className="w-full h-full object-cover transition-opacity duration-300"
          />
        )}
        {producto.imagenes[1] && (
          <img
            src={producto.imagenes[1]}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          />
        )}
      </figure>
      <div className="card-body p-3">
        <h3 className="card-title text-sm">{producto.nombre}</h3>
        <span className="badge badge-sm badge-outline">{producto.categoria}</span>
        <p className="text-primary font-bold">${producto.precio.toLocaleString('es-AR')}</p>
      </div>
    </Link>
  )
}