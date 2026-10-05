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
    <div className="group flex flex-col bg-base-100 border border-line h-full">
      {/* Imágenes */}
      <Link to={`/producto/${producto.id}`} className="block w-full relative bg-white rounded-t-lg overflow-hidden">
        <figure className="w-full aspect-[3/4] relative bg-neutral-100 m-0 p-0 overflow-hidden">
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
      alt={`${producto.nombre} de ${producto.categoria}, vista frontal`}
      loading="lazy"
      decoding="async"
      srcSet={srcsetFrente.srcset}
      sizes={srcsetFrente.sizes}
      className="absolute inset-0 block w-full h-full object-cover object-[center_20%] transition-transform duration-300 group-hover:scale-105"
    />
  )}
  {producto.imagenes[1] && (
    <img
      src={producto.imagenes[1]}
      alt=""
      loading="lazy"
      decoding="async"
      srcSet={srcsetDorso.srcset}
      sizes={srcsetDorso.sizes}
      className="absolute inset-0 block w-full h-full object-cover object-[center_20%] opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
    />
  )}

  {/* Compra rápida */}
  {!sinStock && (
    <div className="absolute inset-x-0 bottom-0 hidden md:block translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-10">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          setQuickshop(true)
        }}
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
            className="text-sm leading-snug hover:underline font-medium"
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
          <span className="text-sm font-semibold">${formatearPrecio(precio)}</span>
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

      {/* Selector de talle + agregar (desktop) */}
      {!sinTalles && (
        <div className="hidden md:block px-3 pb-3 mt-auto">
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

      {/* Acción mobile */}
      <div className="px-3 pb-3 md:hidden mt-auto">
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