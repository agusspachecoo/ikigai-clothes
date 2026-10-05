import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ProductoConStock } from '../types/database'
import type { ResumenResenas } from '../hooks/useResumenResenas'
import { RatingProducto } from './RatingProducto'
import { QuickshopModal } from './QuickshopModal'
import { BotonFavorito } from './BotonFavorito'
import { useCart, type ItemNuevo } from '../context/cart'
import { useTienda } from '../context/tienda'
import { tallesConStock, tallesDisponibles } from '../lib/talles'
import { srcsetImagen } from '../lib/imagenes'
import { ConflictModal } from './ConflictModal'
import type { Colision } from '../lib/conflictos'
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
  const { intentarAgregar, reemplazarConflictosYAgregar } = useCart()
  const { descuento_transferencia, cuotas_sin_interes } = useTienda()
  const [quickshop, setQuickshop] = useState(false)
  const [talle, setTalle] = useState('')
  const [conflictos, setConflictos] = useState<Colision[]>([])
  const [modalAbierto, setModalAbierto] = useState(false)

  const descuento = Number(producto.discount_percent) || 0
  const precio = Number(producto.precio) || 0
  const precioOferta = precioConDescuento(precio, descuento)

  const srcsetFrente = srcsetImagen(producto.imagenes[0], 320)
  const srcsetDorso = srcsetImagen(producto.imagenes[1], 320)

  const opciones = tallesDisponibles(producto.variaciones_stock)
  const conStock = tallesConStock(producto.variaciones_stock)
  const sinTalles = opciones.length === 0
  // Un producto sin variations de talle tampoco se puede comprar, así que
  // cuenta como sin stock igual que uno que tiene talles en cero.
  const sinStock = conStock.length === 0

  function prendaConTalle(talleElegido: string): ItemNuevo {
    return {
      producto_id: producto.id,
      nombre: producto.nombre,
      imagen: producto.imagenes[0] ?? '',
      talle: talleElegido,
      precio_unitario: precioOferta,
      origen: 'individual',
      outfitId: null,
      outfitNombre: null,
    }
  }

  function agregarRapido() {
    if (!talle) return
    const nueva = prendaConTalle(talle)
    const resultado = intentarAgregar(nueva)
    if (!resultado.ok) {
      // Stock unitario: no se agrega nada hasta que el usuario confirme.
      setConflictos(resultado.colisiones)
      setModalAbierto(true)
      return
    }
    setTalle('')
  }

  function confirmarReemplazo() {
    reemplazarConflictosYAgregar(prendaConTalle(talle), conflictos)
    setModalAbierto(false)
    setConflictos([])
    setTalle('')
  }

  return (
    <div className="group flex flex-col bg-base-100 border border-line">
      {/* Imágenes */}
      <Link to={`/producto/${producto.id}`} className="block relative bg-white rounded-t-lg">
        <figure className="relative aspect-[3/4] bg-white p-3 flex items-center justify-center overflow-hidden rounded-t-lg">
          {descuento > 0 && (
            <span className="absolute top-2 left-2 z-10 bg-oferta text-white text-[10px] font-semibold uppercase tracking-widest px-2 py-1">
              -{descuento}%
            </span>
          )}
          {sinStock && (
            <span className="absolute top-2 right-2 z-10 bg-neutral text-neutral-content text-[10px] uppercase tracking-widest px-2 py-1">
              Sin Stock
            </span>
          )}

          {producto.imagenes[0] && (
            <img
              src={producto.imagenes[0]}
              srcSet={srcsetFrente.srcset}
              sizes={srcsetFrente.sizes}
              alt={`${producto.nombre} de ${producto.categoria}, vista frontal`}
              loading="lazy"
              decoding="async"
              width={320}
              height={400}
              className="w-full h-full object-contain object-center"
            />
          )}
          {producto.imagenes[1] && (
            /* Segunda foto: es la vista dorsal que aparece al pasar el mouse.
               Va con alt="" a propósito: no agrega información al lector de
               pantalla, que ya leyó el nombre del producto en la frontal. */
            <img
              src={producto.imagenes[1]}
              srcSet={srcsetDorso.srcset}
              sizes={srcsetDorso.sizes}
              alt=""
              loading="lazy"
              decoding="async"
              width={320}
              height={400}
              className="absolute inset-0 w-full h-full object-contain object-center opacity-0 group-hover:opacity-100 transition-opacity duration-500"
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
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/producto/${producto.id}`}
            className="text-sm leading-snug hover:underline"
          >
            {producto.nombre}
          </Link>
          <BotonFavorito productoId={producto.id} />
        </div>

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

      {/* Selector de talle + agregar (solo desktop, en mobile va dentro del quickshop) */}
      {!sinTalles && (
        <div className="hidden md:block px-3 pb-3">
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
            {sinStock ? 'Sin Stock' : talle ? 'Agregar' : 'Elegí talle'}
          </button>
        </div>
      )}

      {/* Acción mobile: abre el bottom sheet con talles.
          Sin stock el botón sigue visible pero deshabilitado, para que se vea
          que la prenda existe y está agotada. */}
      <div className="px-3 pb-3 md:hidden">
        <button
          type="button"
          onClick={() => setQuickshop(true)}
          disabled={sinStock}
          className="btn btn-outline btn-sm btn-block"
        >
          {sinStock ? 'Sin Stock' : sinTalles ? 'Agregar' : 'Elegí talle'}
        </button>
      </div>

      {quickshop && (
        <QuickshopModal producto={producto} onCerrar={() => setQuickshop(false)} />
      )}

      {modalAbierto && (
        <ConflictModal
          abierto={modalAbierto}
          conflictos={conflictos}
          accionSolicitada="agregar_individual"
          onConfirmar={confirmarReemplazo}
          onCancelar={() => {
            setModalAbierto(false)
            setConflictos([])
          }}
        />
      )}
    </div>
  )
}
