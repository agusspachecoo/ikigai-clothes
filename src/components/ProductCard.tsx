import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ProductoConStock } from '../types/database'
import type { ResumenResenas } from '../hooks/useResumenResenas'
import { RatingProducto } from './RatingProducto'
import { QuickshopModal } from './QuickshopModal'
import { useCart } from '../context/cart'
import { useTienda } from '../context/tienda'
import { tallesConStock, tallesDisponibles } from '../lib/talles'
import {
  formatearPrecio,
  montoCuota,
  precioConDescuento,
  precioTransferencia,
} from '../lib/precios'

export function ProductCard({
  producto,
  rating,
}: {
  producto: ProductoConStock
  rating?: ResumenResenas
}) {
  const { agregarItem } = useCart()
  const { descuento_transferencia, cuotas_sin_interes } = useTienda()
  const [quickshop, setQuickshop] = useState(false)
  const [talle, setTalle] = useState('')

  const descuento = Number(producto.discount_percent) || 0
  const precio = Number(producto.precio) || 0
  const precioOferta = precioConDescuento(precio, descuento)

  const opciones = tallesDisponibles(producto.variaciones_stock)
  const conStock = tallesConStock(producto.variaciones_stock)
  const sinTalles = opciones.length === 0
  const sinStock = !sinTalles && conStock.length === 0

  function agregarRapido() {
    if (!talle) return
    agregarItem({
      producto_id: producto.id,
      nombre: producto.nombre,
      imagen: producto.imagenes[0] ?? '',
      talle,
      precio_unitario: precioOferta,
    })
    setTalle('')
  }

  return (
    <div className="group flex flex-col bg-base-100 border border-line">
      {/* Imágenes */}
      <Link to={`/producto/${producto.id}`} className="block relative overflow-hidden bg-base-200">
        <figure className="relative aspect-[3/4]">
          {descuento > 0 && (
            <span className="absolute top-2 left-2 z-10 bg-oferta text-white text-[10px] font-semibold uppercase tracking-widest px-2 py-1">
              -{descuento}%
            </span>
          )}
          {sinStock && (
            <span className="absolute top-2 right-2 z-10 bg-base-300 text-base-content text-[10px] uppercase tracking-widest px-2 py-1">
              Agotado
            </span>
          )}

          {producto.imagenes[0] && (
            <img
              src={producto.imagenes[0]}
              alt={producto.nombre}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          )}
          {producto.imagenes[1] && (
            <img
              src={producto.imagenes[1]}
              alt=""
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            />
          )}

          {/* Compra rápida */}
          {!sinStock && (
            <div className="absolute inset-x-0 bottom-0 hidden md:block translate-y-full group-hover:translate-y-0 transition-transform duration-300">
              <button
                type="button"
                onClick={() => setQuickshop(true)}
                className="w-full bg-neutral/95 text-neutral-content text-[11px] uppercase tracking-[0.15em] py-3 hover:bg-neutral"
              >
                Compra rápida
              </button>
            </div>
          )}
        </figure>
      </Link>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1.5 grow">
        <Link to={`/producto/${producto.id}`} className="text-sm leading-snug hover:underline">
          {producto.nombre}
        </Link>

        {rating && (
          <RatingProducto promedio={rating.promedio} cantidad={rating.cantidad} />
        )}

        {descuento > 0 ? (
          <div className="flex items-baseline gap-2">
            <span className="text-oferta font-semibold">${formatearPrecio(precioOferta)}</span>
            <span className="text-xs opacity-50 line-through">${formatearPrecio(precio)}</span>
          </div>
        ) : (
          <span className="text-sm">${formatearPrecio(precio)}</span>
        )}

        {descuento_transferencia > 0 && (
          <p className="text-xs text-success">
            ${formatearPrecio(precioTransferencia(precioOferta, descuento_transferencia))} por
            transferencia
          </p>
        )}

        {cuotas_sin_interes > 1 && (
          <p className="text-xs opacity-60">
            {cuotas_sin_interes} cuotas de ${formatearPrecio(montoCuota(precioOferta, cuotas_sin_interes))}
            s/interés
          </p>
        )}
      </div>

      {/* Selector de talle + agregar */}
      {!sinTalles && (
        <div className="px-3 pb-3">
          <div className="flex flex-wrap gap-1 mb-2">
            {opciones.map(({ talle: t, stock }) => (
              <button
                key={t}
                type="button"
                disabled={stock === 0}
                onClick={() => setTalle(t)}
                aria-pressed={talle === t}
                className={`min-w-9 h-8 px-2 border text-xs transition-colors ${
                  talle === t
                    ? 'bg-neutral text-neutral-content border-neutral'
                    : stock === 0
                      ? 'border-line opacity-40 line-through cursor-not-allowed'
                      : 'border-line hover:border-neutral'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={agregarRapido}
            disabled={!talle || sinStock}
            className="btn btn-outline btn-sm btn-block"
          >
            {sinStock ? 'Agotado' : talle ? 'Agregar' : 'Elegí talle'}
          </button>
        </div>
      )}

      {quickshop && (
        <QuickshopModal producto={producto} onCerrar={() => setQuickshop(false)} />
      )}
    </div>
  )
}
