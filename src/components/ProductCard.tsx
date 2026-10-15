import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ProductoConStock } from '../types/database'
import { QuickshopModal } from './QuickshopModal'
import { BotonFavorito } from './BotonFavorito'
import { useTienda } from '../context/tienda'
import {
  formatearPrecio,
  precioConDescuento,
  precioTransferencia,
} from '../lib/precios'

export function ProductCard({ producto }: { producto: ProductoConStock }) {
  const { descuento_transferencia } = useTienda()
  const [quickshop, setQuickshop] = useState(false)

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
      {/* Imagen: protagonista y limpia. Al hacer click abre la vista rápida
          (selección de talle + agregar) en un modal, igual que en mobile. */}
      <button
        type="button"
        onClick={() => setQuickshop(true)}
        aria-label={`Vista rápida de ${producto.nombre}`}
        className="block w-full text-left bg-white"
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

          {sinStock && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/45">
              <span className="bg-neutral text-neutral-content text-[10px] uppercase tracking-widest px-3 py-1.5">
                Sin Stock
              </span>
            </div>
          )}
        </figure>
      </button>

      {/* Favorito: único ícono sobre la foto, arriba a la izquierda (fuera del
          botón para que el click no abra el modal). */}
      <div className="absolute top-2 left-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:bg-white">
        <BotonFavorito productoId={producto.id} />
      </div>

      {/* Info: título + precios, compacto */}
      <div className="pt-3 flex flex-col gap-0.5 grow">
        <Link
          to={`/producto/${producto.id}`}
          className="text-[13px] leading-snug font-medium hover:underline line-clamp-2"
        >
          {producto.nombre}
        </Link>

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

      {quickshop && (
        <QuickshopModal producto={producto} onCerrar={() => setQuickshop(false)} />
      )}
    </div>
  )
}
