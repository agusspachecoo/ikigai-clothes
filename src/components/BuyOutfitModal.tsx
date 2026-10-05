import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { OutfitConItems } from '../types/database'
import { useCart } from '../context/cart'
import { imagenProducto, srcsetImagen } from '../lib/imagenes'
import { useCierreModal } from '../hooks/useCierreModal'
import { formatearPrecio, precioConDescuento } from '../lib/precios'
import { DESCUENTO_OUTFIT_PCT } from '../lib/outfits'
import { ConflictModal } from './ConflictModal'
import type { Colision } from '../lib/conflictos'

interface Props {
  outfit: OutfitConItems | null
  onClose: () => void
}

export function BuyOutfitModal({ outfit, onClose }: Props) {
  useCierreModal(outfit !== null, onClose)

  if (!outfit) return null

  return (
    <dialog className="modal modal-open">
      <OutfitModalContent outfit={outfit} onClose={onClose} />

      <form method="dialog" className="modal-backdrop bg-neutral/70 backdrop-blur-sm">
        <button onClick={onClose}>cerrar</button>
      </form>
    </dialog>
  )
}

function OutfitModalContent({ outfit, onClose }: { outfit: OutfitConItems; onClose: () => void }) {
  const { intentarAgregarOutfit, reemplazarConflictosYAgregarOutfit, setCarritoAbierto } = useCart()

  const tallesIniciales = Object.fromEntries(
    outfit.outfit_items.map((item) => {
      const variaciones = item.producto?.variaciones_stock ?? []
      const elegido = variaciones.find((v) => v.stock_disponible > 0) ?? variaciones[0]
      return [item.producto_id, elegido?.talle ?? '']
    }),
  )

  const [talles, setTalles] = useState<Record<string, string>>(tallesIniciales)
  const [conflictos, setConflictos] = useState<Colision[]>([])
  const [modalAbierto, setModalAbierto] = useState(false)

  /** Prendas del combo con el talle elegido en el modal. */
  function prendasSeleccionadas() {
    return outfit.outfit_items
      .filter((item) => item.producto)
      .map((item) => ({
        producto_id: item.producto!.id,
        talle: talles[item.producto!.id] ?? '',
      }))
  }

  function detalleDePrendas() {
    return new Map(
      outfit.outfit_items
        .filter((item) => item.producto)
        .map((item) => {
          const p = item.producto!
          return [
            p.id,
            {
              nombre: p.nombre,
              imagen: imagenProducto(p.imagenes[0], 0),
              precio_unitario: precioConDescuento(p.precio, p.discount_percent),
            },
          ]
        }),
    )
  }

  /**
   * El outfit es un pack cerrado: se compra entero. Por eso el total se
   * calcula sobre la suma de las prendas con el 5% de descuento aplicado,
   * que es el mismo criterio que usa `calcularDescuentoOutfit` cuando el
   * carrito arma el pedido. Así lo que se ve acá es lo que se cobra.
   */
  function resumen() {
    let suma = 0
    for (const item of outfit.outfit_items) {
      const p = item.producto
      if (!p) continue
      suma += precioConDescuento(p.precio, p.discount_percent)
    }
    const total = Math.round(suma * (1 - DESCUENTO_OUTFIT_PCT) * 100) / 100
    return { suma, total, ahorro: Math.round((suma - total) * 100) / 100 }
  }

  /**
   * Cada prenda tiene que tener un talle con stock efectivamente elegido.
   * Con `tallesIniciales` ya viene uno preseleccionado, pero si el usuario
   * lo cambia por uno sin stock (o no hay variaciones) tiene que bloquear.
   */
  function talleValido(productoId: string) {
    const item = outfit.outfit_items.find((i) => i.producto_id === productoId)
    const variaciones = item?.producto?.variaciones_stock ?? []
    if (variaciones.length === 0) return true
    const elegido = talles[productoId]
    if (!elegido) return false
    const variacion = variaciones.find((v) => v.talle === elegido)
    return !!variacion && variacion.stock_disponible > 0
  }

  const prendas = outfit.outfit_items.filter((item) => item.producto)
  const completo = prendas.length > 0 && prendas.every((item) => talleValido(item.producto_id))
  const { suma, total, ahorro } = resumen()

  function cerrarYMostrarCarrito() {
    setModalAbierto(false)
    setConflictos([])
    onClose()
    setCarritoAbierto(true)
  }

  function agregarAlCarrito() {
    if (!completo) return
    const resultado = intentarAgregarOutfit(
      outfit.id,
      outfit.nombre,
      prendasSeleccionadas(),
      detalleDePrendas(),
    )
    // Si hay colisión, `intentarAgregarOutfit` no tocó el estado: solo avisamos.
    if (!resultado.ok) {
      setConflictos(resultado.colisiones)
      setModalAbierto(true)
      return
    }
    cerrarYMostrarCarrito()
  }

  function confirmarAgregar() {
    reemplazarConflictosYAgregarOutfit(
      outfit.id,
      outfit.nombre,
      prendasSeleccionadas(),
      detalleDePrendas(),
      conflictos,
    )
    cerrarYMostrarCarrito()
  }

  return (
    /* Columna flex con alto maximo: header fijo, lista con scroll y footer
       siempre visible. Sin esto, con 4 o mas prendas, el boton de agregar
       caia fuera de la pantalla y habia que scrollear el modal entero. */
    <div className="modal-box max-w-md p-5 rounded-3xl bg-base-100 flex flex-col max-h-[90vh]">
      {/* Header */}
      <header className="shrink-0">
        <h3 className="text-xl font-bold text-base-content">{outfit.nombre}</h3>
        {outfit.descripcion && <p className="text-sm opacity-60 mt-1">{outfit.descripcion}</p>}
      </header>

      {/* Lista con scroll propio */}
      <ul className="flex-1 overflow-y-auto pr-1 my-3 flex flex-col gap-3 min-h-0">
        {prendas.map((item, i) => {
          const p = item.producto!
          const variaciones = p.variaciones_stock ?? []
          const precio = precioConDescuento(p.precio, p.discount_percent)
          const descuento = Number(p.discount_percent) || 0

          return (
            <li key={item.id} className="flex items-center gap-3 bg-neutral-100 rounded-xl p-3">
              {/* min-w-* es lo que evita que el <Link> se estire o se
                  aplaste: sin el, el flex lo comprime a una tira vertical
                  cuando el nombre de la prenda es largo. */}
              <Link
                to={`/producto/${p.id}`}
                onClick={onClose}
                className="block shrink-0 flex-shrink-0 w-16 h-16 min-w-[64px] max-w-[64px] aspect-square bg-neutral-100 rounded-lg overflow-hidden"
                aria-label={`Ver ${p.nombre}`}
              >
                <img
                  src={imagenProducto(p.imagenes[0], i)}
                  srcSet={srcsetImagen(p.imagenes[0], 64).srcset}
                  sizes={srcsetImagen(p.imagenes[0], 64).sizes}
                  alt={`${p.nombre}, prenda del look ${outfit.nombre}`}
                  loading="lazy"
                  decoding="async"
                  width={64}
                  height={64}
                  className="block w-full h-full object-contain p-1"
                />
              </Link>

              <div className="flex-1 min-w-0">
                <Link
                  to={`/producto/${p.id}`}
                  onClick={onClose}
                  className="block text-sm font-bold uppercase text-base-content hover:text-primary transition-colors truncate"
                >
                  {p.nombre}
                </Link>

                <p className="text-sm text-base-content/80 mt-0.5">
                  {descuento > 0 && (
                    <span className="text-xs opacity-50 line-through mr-1">
                      $ {formatearPrecio(p.precio)}
                    </span>
                  )}
                  $ {formatearPrecio(precio)}
                </p>

                {variaciones.length > 0 ? (
                  <select
                    aria-label={`Talle de ${p.nombre}`}
                    value={talles[p.id] ?? ''}
                    onChange={(e) => setTalles((t) => ({ ...t, [p.id]: e.target.value }))}
                    className="select select-sm select-bordered w-full mt-2 bg-base-100"
                  >
                    {variaciones.map((v) => (
                      <option key={v.id} value={v.talle} disabled={v.stock_disponible === 0}>
                        {v.talle}
                        {v.stock_disponible === 0 ? ' — sin stock' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs opacity-50 mt-2">Talle único</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {/* Footer fijo: el boton nunca queda fuera de pantalla */}
      <footer className="shrink-0 mt-auto flex flex-col gap-2 pt-4 border-t border-line">
        <div className="flex items-center justify-between">
          <span className="badge badge-success font-bold uppercase tracking-wider">
            -{DESCUENTO_OUTFIT_PCT * 100}% OFF COMBO
          </span>
          <span className="text-xs opacity-60">Pack completo · {prendas.length} prendas</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-base-content whitespace-nowrap">$ {formatearPrecio(total)}</span>
          <span className="text-sm opacity-50 line-through whitespace-nowrap">$ {formatearPrecio(suma)}</span>
          <span className="text-xs text-success font-medium whitespace-nowrap">Ahorrás $ {formatearPrecio(ahorro)}</span>
        </div>

        <button
          type="button"
          onClick={agregarAlCarrito}
          disabled={!completo}
          className="btn w-full bg-black text-white hover:bg-neutral-800 border-0 rounded-xl font-bold uppercase tracking-widest disabled:opacity-40 disabled:bg-neutral transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
          </svg>
          Agregar outfit al carrito
        </button>

        {!completo && (
          <p className="text-xs text-error text-center" role="alert">
            Elegí un talle con stock para cada prenda del outfit.
          </p>
        )}
      </footer>

      {modalAbierto && (
        <ConflictModal
          abierto={modalAbierto}
          conflictos={conflictos}
          accionSolicitada="agregar_outfit"
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