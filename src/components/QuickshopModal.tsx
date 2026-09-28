import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/cart'
import { useTienda } from '../context/tienda'
import { useCierreModal } from '../hooks/useCierreModal'
import { tallesDisponibles } from '../lib/talles'
import { formatearPrecio, montoCuota, precioConDescuento, precioTransferencia } from '../lib/precios'
import { imagenProducto } from '../lib/imagenes'
import type { ProductoConStock } from '../types/database'

/** Vista rápida de compra: se abre desde la tarjeta o los resultados de búsqueda. */
export function QuickshopModal({
  producto,
  onCerrar,
}: {
  producto: ProductoConStock
  onCerrar: () => void
}) {
  const { agregarItem, setCarritoAbierto } = useCart()
  const { descuento_transferencia, cuotas_sin_interes, umbral_envio_gratis } = useTienda()
  const [talle, setTalle] = useState('')
  const [agregado, setAgregado] = useState(false)

  useCierreModal(true, onCerrar)

  const precio = precioConDescuento(producto.precio, producto.discount_percent)
  const opciones = tallesDisponibles(producto.variaciones_stock)
  const sinTalles = opciones.length === 0
  const sinStock = !sinTalles && opciones.every((o) => o.stock === 0)
  const puedeAgregar = sinTalles ? true : Boolean(talle)

  function agregar() {
    if (!puedeAgregar) return
    agregarItem({
      producto_id: producto.id,
      nombre: producto.nombre,
      imagen: imagenProducto(producto.imagenes[0], 0),
      talle: sinTalles ? 'Único' : talle,
      precio_unitario: precio,
    })
    setAgregado(true)
    window.setTimeout(() => {
      setAgregado(false)
      onCerrar()
      setCarritoAbierto(true)
    }, 550)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCerrar} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={producto.nombre}
        className="relative w-full sm:max-w-2xl bg-base-100 border border-line max-h-[90vh] overflow-y-auto"
      >
        <div className="grid sm:grid-cols-2">
          <figure className="aspect-[3/4] bg-base-200">
            {producto.imagenes[0] && (
              <img
                src={producto.imagenes[0]}
                alt={producto.nombre}
                className="w-full h-full object-cover"
              />
            )}
          </figure>

          <div className="p-5 flex flex-col">
            <p className="text-[11px] uppercase tracking-widest opacity-50">
              {producto.categoria}
            </p>
            <Link
              to={`/producto/${producto.id}`}
              onClick={onCerrar}
              className="font-display text-lg leading-snug hover:underline"
            >
              {producto.nombre}
            </Link>

            <div className="mt-3 space-y-1">
              <p className="text-xl font-semibold">${formatearPrecio(precio)}</p>
              {descuento_transferencia > 0 && (
                <p className="text-xs text-success">
                  ${formatearPrecio(precioTransferencia(precio, descuento_transferencia))}{' '}
                  por transferencia ({Math.round(descuento_transferencia * 100)}% off)
                </p>
              )}
              {cuotas_sin_interes > 1 && (
                <p className="text-xs opacity-60">
                  {cuotas_sin_interes} cuotas sin interés de $
                  {formatearPrecio(montoCuota(precio, cuotas_sin_interes))}
                </p>
              )}
            </div>

            {!sinTalles && (
              <div className="mt-5">
                <p className="text-xs uppercase tracking-widest opacity-50 mb-2">Talle</p>
                <div className="flex flex-wrap gap-2">
                  {opciones.map(({ talle: t, stock }) => (
                    <button
                      key={t}
                      type="button"
                      disabled={stock === 0}
                      onClick={() => setTalle(t)}
                      className={`min-w-11 h-9 px-3 border text-sm transition-colors ${
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
              </div>
            )}

            {umbral_envio_gratis > 0 && (
              <p className="mt-4 text-xs opacity-60">
                Envío gratis en compras desde ${formatearPrecio(umbral_envio_gratis)}
              </p>
            )}

            <div className="mt-auto pt-5 space-y-2">
              <button
                type="button"
                onClick={agregar}
                disabled={!puedeAgregar || sinStock || agregado}
                className="btn btn-primary btn-block btn-sm"
              >
                {agregado
                  ? 'Agregado'
                  : sinStock
                    ? 'Sin stock'
                    : puedeAgregar
                      ? 'Agregar al carrito'
                      : 'Elegí un talle'}
              </button>
              <Link
                to={`/producto/${producto.id}`}
                onClick={onCerrar}
                className="btn btn-ghost btn-block btn-sm"
              >
                Ver detalle completo
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
