import { Link } from 'react-router-dom'
import type { ProductoConStock } from '../types/database'
import { BotonFavorito } from './BotonFavorito'
import { useTienda } from '../context/tienda'
import { imagenProducto } from '../lib/imagenes'
import {
  formatearPrecio,
  precioConDescuento,
  precioTransferencia,
} from '../lib/precios'

export function ProductCard({
  producto,
  onImageLoad,
}: {
  producto: ProductoConStock
  onImageLoad?: () => void
}) {
  const { descuento_transferencia } = useTienda()

  // Producto de un drop futuro: se muestra difuminado, sin precio y sin enlace.
  if (producto.bloqueado) {
    return (
      <div className="relative flex h-full flex-col bg-base-100">
        <div className="flex grow flex-col">
          <figure className="w-full aspect-[3/4] relative bg-neutral-100 m-0 p-0 overflow-hidden shrink-0">
            {producto.imagenes[0] && (
              <img
                src={producto.imagenes[0]}
                alt="Vista previa de un próximo lanzamiento"
                loading="lazy"
                decoding="async"
                aria-hidden="true"
                onLoad={onImageLoad}
                className="absolute inset-0 block w-full h-full object-cover object-[center_20%] scale-110 blur-[6px]"
              />
            )}
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/25">
              <span className="flex items-center gap-1.5 bg-neutral/95 text-neutral-content text-[10px] uppercase tracking-widest px-3 py-1.5">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Próximamente
              </span>
            </div>
          </figure>

          <div className="pt-3 flex grow flex-col gap-0.5">
            <p className="text-[13px] leading-snug font-medium min-h-[2.75em] text-base-content/60">
              Próximamente...
            </p>
          </div>
        </div>
      </div>
    )
  }

  const descuento = Number(producto.discount_percent) || 0
  const precio = Number(producto.precio) || 0
  const precioOferta = precioConDescuento(precio, descuento)

  const stockTotal = (producto.variaciones_stock ?? []).reduce(
    (suma, v) => suma + (v.stock_disponible ?? 0),
    0,
  )
  const sinStock = stockTotal <= 0

  return (
    <div className="group relative flex h-full flex-col bg-base-100 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_20px_40px_-20px_rgba(17,17,17,0.45)]">
      {/* Toda la tarjeta es un enlace al detalle del producto. Crece para que
          todas las tarjetas midan lo mismo y el botón quede alineado abajo. */}
      <Link
        to={`/producto/${producto.id}`}
        aria-label={`Ver ${producto.nombre}`}
        className="flex grow flex-col"
      >
        <figure className="w-full aspect-[3/4] relative bg-neutral-100 m-0 p-0 overflow-hidden shrink-0">
          {producto.imagenes[0] && (
            <img
              src={imagenProducto(producto.imagenes[0], 0)}
              alt={`${producto.nombre} de ${producto.categoria}, vista frontal`}
              loading="lazy"
              decoding="async"
              width={320}
              height={427}
              onLoad={onImageLoad}
              onError={(e) => {
                e.currentTarget.src = imagenProducto(null, 0)
              }}
              className="absolute inset-0 block w-full h-full object-cover object-[center_20%] transition-transform duration-500 ease-out group-hover:scale-105"
            />
          )}
          {producto.imagenes[1] && (
            <img
              src={imagenProducto(producto.imagenes[1], 1)}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              width={320}
              height={427}
              onLoad={onImageLoad}
              onError={(e) => {
                e.currentTarget.src = imagenProducto(null, 1)
              }}
              className="absolute inset-0 block w-full h-full object-cover object-[center_20%] opacity-0 group-hover:opacity-100 transition-all duration-700 ease-out group-hover:scale-105"
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
        </figure>

        {/* Info: título + precios. El título reserva 2 líneas para que los
            precios queden alineados entre tarjetas. Crece para empujar el
            botón hasta la base de la tarjeta. */}
        <div className="pt-3 flex grow flex-col gap-0.5">
          <p className="text-[13px] leading-snug font-medium line-clamp-2 min-h-[2.75em] group-hover:underline">
            {producto.nombre}
          </p>

          {/* Precios: original tachado + precio promocional destacado, y el
              precio por transferencia como protagonista si está activo. */}
          <div className="flex flex-col gap-0.5 mt-0.5">
            {descuento > 0 && (
              <span className="text-xs text-base-content/40 line-through">
                ${formatearPrecio(precio)}
              </span>
            )}

            <span
              className={
                descuento_transferencia > 0
                  ? 'text-sm font-semibold text-base-content/70'
                  : 'text-lg font-bold text-base-content'
              }
            >
              ${formatearPrecio(precioOferta)}
            </span>

            {descuento_transferencia > 0 && (
              <p className="leading-none">
                <span className="text-xl font-extrabold text-emerald-600">
                  ${formatearPrecio(precioTransferencia(precioOferta, descuento_transferencia))}
                </span>
                <span className="ml-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700/80">
                  con transferencia
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Botón "Ver producto": comparte el mismo enlace al detalle (sin
            anidar <a> dentro de <a>), por lo que el clic navega al producto.
            Va debajo del bloque de precios, pegado a la base de la tarjeta.
            Oculto por defecto y se despliega en hover (desktop). En mobile se
            oculta y el tap en la tarjeta navega directo. */}
        {!sinStock && (
          <div className="relative z-10 mt-2 hidden h-10 shrink-0 pointer-events-auto md:block">
            <span className="flex h-full w-full items-center justify-center bg-neutral/95 text-neutral-content text-[11px] uppercase tracking-[0.15em] opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 ease-out">
              Ver producto
            </span>
          </div>
        )}
      </Link>

      {/* Favorito: único ícono sobre la foto, arriba a la izquierda (fuera del
          enlace para que el click no navegue al producto). */}
          <div className="absolute top-2 left-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 shadow-sm ring-1 ring-black/5 backdrop-blur transition-all duration-300 ease-in-out hover:scale-110 hover:bg-white">
        <BotonFavorito productoId={producto.id} />
      </div>
    </div>
  )
}
