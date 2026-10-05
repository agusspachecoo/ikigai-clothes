import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart, type ItemNuevo } from '../context/cart'
import { useTienda } from '../context/tienda'
import { useCierreModal } from '../hooks/useCierreModal'
import { tallesDisponibles } from '../lib/talles'
import { formatearPrecio, montoCuota, precioConDescuento, precioTransferencia } from '../lib/precios'
import { imagenProducto, srcsetImagen } from '../lib/imagenes'
import type { ProductoConStock } from '../types/database'
import { ConflictModal } from './ConflictModal'
import type { Colision } from '../lib/conflictos'

/** Vista rápida de compra: se abre desde la tarjeta o los resultados de búsqueda. */
export function QuickshopModal({
  producto,
  onCerrar,
}: {
  producto: ProductoConStock
  onCerrar: () => void
}) {
  const { intentarAgregar, reemplazarConflictosYAgregar, setCarritoAbierto } = useCart()
  const { descuento_transferencia, cuotas_sin_interes, umbral_envio_gratis } = useTienda()
  const [talle, setTalle] = useState('')
  const [agregado, setAgregado] = useState(false)
  const [conflictos, setConflictos] = useState<Colision[]>([])
  const [modalAbierto, setModalAbierto] = useState(false)

  useCierreModal(true, onCerrar)

  const precio = precioConDescuento(producto.precio, producto.discount_percent)
  const srcsetQuickshop = srcsetImagen(producto.imagenes[0], 360)
  const opciones = tallesDisponibles(producto.variaciones_stock)
  const sinTalles = opciones.length === 0
  const stockTotal = opciones.reduce((sum, o) => sum + (o.stock || 0), 0)
  const stockTalleSeleccionado = sinTalles ? stockTotal : opciones.find((o) => o.talle === talle)?.stock || 0
  const sinStock = stockTotal <= 0
  const puedeAgregar = sinTalles ? stockTotal > 0 : Boolean(talle) && stockTalleSeleccionado > 0

  function prendaNueva(): ItemNuevo {
    return {
      producto_id: producto.id,
      nombre: producto.nombre,
      imagen: imagenProducto(producto.imagenes[0], 0),
      talle: sinTalles ? 'Único' : talle,
      precio_unitario: precio,
      cantidad: 1,
      origen: 'individual',
      outfitId: null,
      outfitNombre: null,
    }
  }

  function confirmarCarrito() {
    setModalAbierto(false)
    setConflictos([])
    setAgregado(true)
    window.setTimeout(() => {
      setAgregado(false)
      onCerrar()
      setCarritoAbierto(true)
    }, 550)
  }

  function agregar() {
    if (!puedeAgregar) return
    // Con colisión no se muta el estado: solo se abre el aviso.
    const resultado = intentarAgregar(prendaNueva())
    if (!resultado.ok) {
      setConflictos(resultado.colisiones)
      setModalAbierto(true)
      return
    }
    confirmarCarrito()
  }

  function confirmarAgregar() {
    reemplazarConflictosYAgregar(prendaNueva(), conflictos)
    confirmarCarrito()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCerrar} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={producto.nombre}
        className="relative w-full sm:max-w-2xl bg-base-100 border border-line max-h-[85vh] overflow-y-auto rounded-2xl"
      >
        <button
          type="button"
          onClick={onCerrar}
          className="absolute top-3 right-3 z-10 btn btn-circle btn-ghost btn-xs sm:btn-sm bg-white/80 backdrop-blur-sm"
          aria-label="Cerrar"
        >
          ✕
        </button>
        <div className="grid sm:grid-cols-2">
          <figure className="hidden sm:block aspect-[5/6] flex items-center justify-center overflow-hidden rounded-tl-lg rounded-bl-lg">
            {producto.imagenes[0] && (
              <img
                src={imagenProducto(producto.imagenes[0], 0)}
                srcSet={srcsetQuickshop.srcset}
                sizes={srcsetQuickshop.sizes}
                alt={`${producto.nombre} de ${producto.categoria}`}
                loading="lazy"
                decoding="async"
                width={360}
                height={480}
                className="h-full object-contain object-top"
              />
            )}
          </figure>

          <div className="p-4 sm:p-5 flex flex-col">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-widest opacity-50">
              {producto.categoria}
            </p>
            <Link
              to={`/producto/${producto.id}`}
              onClick={onCerrar}
              className="font-display text-base sm:text-lg leading-snug hover:underline"
            >
              {producto.nombre}
            </Link>

            <div className="mt-2 sm:mt-3 space-y-0.5 sm:space-y-1">
              <div className="flex items-baseline gap-2">
                <p className="text-base sm:text-xl font-semibold">${formatearPrecio(precio)}</p>
              </div>
              {descuento_transferencia > 0 && (
                <p className="text-xs text-success font-semibold">
                  ${formatearPrecio(precioTransferencia(precio, descuento_transferencia))}{' '}
                  por transferencia ({Math.round(descuento_transferencia * 100)}% off)
                </p>
              )}
              {cuotas_sin_interes > 1 && (
                <p className="text-xs text-success">
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
                      className={`min-w-10 h-10 sm:min-w-11 sm:h-9 px-3 border text-sm transition-colors ${
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

            <div className="mt-auto pt-4 sm:pt-5 space-y-2">
              <button
                type="button"
                onClick={agregar}
                disabled={agregado || sinStock || (sinTalles ? stockTotal <= 0 : !talle || stockTalleSeleccionado <= 0)}
                className="btn btn-neutral btn-block"
              >
                {agregado
                  ? 'Agregado'
                  : sinStock
                    ? 'Sin Stock'
                    : !sinTalles && !talle
                      ? 'Elegí un talle'
                      : !sinTalles && talle && stockTalleSeleccionado <= 0
                        ? 'Sin Stock'
                        : 'AGREGAR AL CARRITO'}
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
      {modalAbierto && (
        <ConflictModal
          abierto={modalAbierto}
          conflictos={conflictos}
          accionSolicitada="agregar_individual"
          onConfirmar={confirmarAgregar}
          onCancelar={() => {
            setModalAbierto(false)
            setConflictos([])
          }}
        />
      )}
    </div>
  )
}
