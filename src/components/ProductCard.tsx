import { Link } from 'react-router-dom'
import type { ProductoConStock } from '../types/database'
import { BotonFavorito } from './BotonFavorito'
import { useTienda } from '../context/tienda'
import {
  formatearPrecio,
  precioConDescuento,
  precioTransferencia,
} from '../lib/precios'

export function ProductCard({ producto }: { producto: ProductoConStock }) {
  const { descuento_transferencia } = useTienda()

  const descuento = Number(producto.discount_percent) || 0
  const precio = Number(producto.precio) || 0
  const precioOferta = precioConDescuento(precio, descuento)

  const stockTotal = (producto.variaciones_stock ?? []).reduce(
    (suma, v) => suma + (v.stock_disponible ?? 0),
    0,
  )
  const sinStock = stockTotal <= 0

  return (
    <div className="group relative flex flex-col bg-base-100">
      {/* Toda la tarjeta es un enlace al detalle del producto. */}
      <Link
        to={`/producto/${producto.id}`}
        aria-label={`Ver ${producto.nombre}`}
        className="flex flex-col grow"
      >
        <figure className="w-full aspect-[3/4] relative bg-neutral-100 m-0 p-0 overflow-hidden">
          {producto.imagenes[0] && (
            <img
              src={producto.imagenes[0]}
              alt={`${producto.nombre} de ${producto.categoria}, vista frontal`}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 block w-full h-full object-cover object-[center_20%] transition-transform duration-300 group-hover:scale-105"
            />
          )}
          {producto.imagenes[1] && (
            <img
              src={producto.imagenes[1]}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 block w-full h-full object-cover object-[center_20%] opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
            />
          )}

          {/* Sin stock: velo centrado */}
          {sinStock && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/45">
              <span className="bg-neutral text-neutral-content text-[10px] uppercase tracking-widest px-3 py-1.5">
                Sin Stock
              </span>
            </div>
          )}

          {/* Botón "Ver producto": oculto por defecto, aparece en hover (desktop). */}
          {!sinStock && (
            <div className="absolute inset-x-0 bottom-0 z-10 hidden md:block translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
              <span className="block w-full bg-neutral/95 text-neutral-content text-[11px] uppercase tracking-[0.15em] py-3 text-center">
                Ver producto
              </span>
            </div>
          )}
        </figure>

        {/* Info: título + precios, compacto */}
        <div className="pt-3 flex flex-col gap-0.5 grow">
          <p className="text-[13px] leading-snug font-medium line-clamp-2 group-hover:underline">
            {producto.nombre}
          </p>

          {descuento_transferencia > 0 ? (
            /* El precio por transferencia es el protagonista. */
            <div className="flex flex-col gap-0.5 mt-0.5">
              <span
                className={`text-xs ${
                  descuento > 0 ? 'opacity-40 line-through' : 'text-base-content/50'
                }`}
              >
                ${formatearPrecio(precio)}
              </span>
              <span className="text-xl font-extrabold text-emerald-600 leading-none">
                ${formatearPrecio(precioTransferencia(precioOferta, descuento_transferencia))}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/80">
                con transferencia
              </span>
            </div>
          ) : (
            <div className="flex items-baseline gap-2 mt-0.5">
              {descuento > 0 && (
                <span className="text-xs opacity-40 line-through">${formatearPrecio(precio)}</span>
              )}
              <span className="text-lg font-bold">
                ${formatearPrecio(descuento > 0 ? precioOferta : precio)}
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Favorito: único ícono sobre la foto, arriba a la izquierda (fuera del
          enlace para que el click no navegue al producto). */}
      <div className="absolute top-2 left-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:bg-white">
        <BotonFavorito productoId={producto.id} />
      </div>
    </div>
  )
}
