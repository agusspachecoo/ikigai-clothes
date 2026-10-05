import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../context/cart'
import { useAuth } from '../context/auth'
import { useTienda } from '../context/tienda'
import { useCierreModal } from '../hooks/useCierreModal'
import { CouponInput } from './CouponInput'
import { formatearPrecio, montoCuota } from '../lib/precios'
import { srcsetImagen } from '../lib/imagenes'

export function CarritoDrawer() {
  const {
    items,
    count,
    total,
    descuentoCupon,
    descuentoOutfit,
    totalConDescuento,
    eliminarItem,
    removerOutfitCompleto,
    carritoAbierto,
    setCarritoAbierto,
  } = useCart()
  const { user, abrirAuthModal } = useAuth()
  const { umbral_envio_gratis, cuotas_sin_interes } = useTienda()
  const navigate = useNavigate()

  const cerrar = () => setCarritoAbierto(false)
  useCierreModal(carritoAbierto, cerrar)

  const progresoEnvio = umbral_envio_gratis > 0 ? Math.min(100, (total / umbral_envio_gratis) * 100) : 100
  const faltaEnvioGratis = total < umbral_envio_gratis

  function finalizarCompra() {
    cerrar()
    navigate('/checkout')
    if (!user) abrirAuthModal()
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Tu carrito">
      <div className="absolute inset-0 bg-black/50" onClick={cerrar} />

      <aside className="absolute inset-y-0 right-0 w-full max-w-md bg-base-100 border-l border-line flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-line shrink-0">
          <h2 className="text-sm uppercase tracking-widest">Tu carrito</h2>
          <span className="text-xs opacity-60">{count} Artículos</span>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm opacity-60">Tu carrito está vacío</p>
            <Link to="/catalogo" onClick={cerrar} className="btn btn-primary btn-sm px-6">
              Ver productos
            </Link>
          </div>
        ) : (
          <>
            {/* Barra de envío gratis */}
            <div className="px-4 py-3 bg-base-200 border-b border-line shrink-0">
              {faltaEnvioGratis ? (
                <p className="text-xs mb-2">
                  Te faltan{' '}
                  <span className="font-semibold">
                    ${formatearPrecio(umbral_envio_gratis - total)}
                  </span>{' '}
                  para el envío gratis
                </p>
              ) : (
                <p className="text-xs mb-2">
                  ¡Tenés <span className="font-semibold">envío gratis</span> en este pedido
                </p>
              )}
              <div className="h-1 w-full bg-base-300">
                <div
                  className="h-1 bg-primary transition-all"
                  style={{ width: `${progresoEnvio}%` }}
                />
              </div>
            </div>

            {/* Items */}
            <ul className="flex-1 overflow-y-auto divide-y divide-line">
              {items.map((it) => (
                <li
                  key={`${it.producto_id}|${it.talle}`}
                  className="flex gap-3 p-3 items-start"
                >
                  <Link
                    to={`/producto/${it.producto_id}`}
                    onClick={cerrar}
                    className="w-16 h-16 shrink-0 bg-neutral-100 rounded-lg overflow-hidden flex items-center justify-center p-1"
                    style={{ minWidth: '64px', minHeight: '64px', flexShrink: 0 }}
                    aria-label={`Ver ${it.nombre}`}
                  >
                    <img
                      src={it.imagen}
                      srcSet={srcsetImagen(it.imagen, 64).srcset}
                      sizes={srcsetImagen(it.imagen, 64).sizes}
                      alt={`${it.nombre}, talle ${it.talle || 'único'}`}
                      loading="lazy"
                      decoding="async"
                      width={64}
                      height={64}
                      className="w-full h-full object-contain"
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/producto/${it.producto_id}`}
                      onClick={cerrar}
                      className="text-sm font-medium block truncate hover:underline"
                    >
                      {it.nombre}
                    </Link>
                    <p className="text-xs opacity-60 mt-0.5">Talle: {it.talle || 'Único'}</p>
                    <p className="text-sm mt-1">
                      ${formatearPrecio(it.precio_unitario * it.cantidad)}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {/* Cada prenda es de edición única: no hay selector de
                          cantidad, solo se puede quitar del carrito. */}
                      <span className="text-xs opacity-60 border border-line px-2 py-1">
                        Prenda única
                      </span>
                      <button
                        type="button"
                        className="text-xs underline opacity-60 ml-1 hover:opacity-100"
                        onClick={() =>
                          it.outfitId
                            ? removerOutfitCompleto(it.outfitId)
                            : eliminarItem(it.producto_id, it.talle)
                        }
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Totales */}
            <div className="border-t border-line px-4 py-3 shrink-0 space-y-2">
              <CouponInput />

              <dl className="pt-1 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="opacity-60">Subtotal</dt>
                  <dd>${formatearPrecio(total)}</dd>
                </div>
                {descuentoOutfit > 0 && (
                  <div className="flex justify-between text-success">
                    <dt>Descuento outfit</dt>
                    <dd>−${formatearPrecio(descuentoOutfit)}</dd>
                  </div>
                )}
                {descuentoCupon > 0 && (
                  <div className="flex justify-between text-success">
                    <dt>Descuento cupón</dt>
                    <dd>−${formatearPrecio(descuentoCupon)}</dd>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-base pt-1 border-t border-line">
                  <dt>Total</dt>
                  <dd>${formatearPrecio(totalConDescuento)}</dd>
                </div>
              </dl>

              {cuotas_sin_interes > 1 && (
                <p className="text-xs opacity-60">
                  o {cuotas_sin_interes} cuotas sin interés de $
                  {formatearPrecio(montoCuota(totalConDescuento, cuotas_sin_interes))}
                </p>
              )}

              <div className="grid gap-2 pt-1">
                <button type="button" onClick={finalizarCompra} className="btn btn-primary btn-sm">
                  Iniciar Compra
                </button>
                <Link
                  to="/catalogo"
                  onClick={cerrar}
                  className="btn btn-outline btn-sm"
                >
                  Ver más productos
                </Link>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
