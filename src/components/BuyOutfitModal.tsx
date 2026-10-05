import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { OutfitConItems } from '../types/database'
import { useCart } from '../context/cart'
import { imagenProducto } from '../lib/imagenes'
import { useCierreModal } from '../hooks/useCierreModal'
import { formatearPrecio, precioConDescuento } from '../lib/precios'
import { DESCUENTO_OUTFIT_PCT } from '../lib/outfits'
import { ConflictModal } from './ConflictModal'
import type { Colision } from '../lib/conflictos'
import { tallesDisponibles } from '../lib/talles'

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

      {/* Lista de prendas del Outfit */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 my-3 min-h-0 max-h-[50vh]">
        {prendas.map((item) => {
          const producto = item.producto!
          // Selección de talle para este producto puntual
          const talleActual = talles[producto.id] || ''
          const opciones = tallesDisponibles(producto.variaciones_stock ?? [])
          const precio = precioConDescuento(producto.precio, producto.discount_percent)

          return (
            <div
              key={item.id}
              className="flex items-center gap-3 bg-neutral-100/80 p-3 rounded-2xl"
            >
              {/* IMAGEN DE LA PRENDA: shrink-0 y w-16 h-16 obligatorios para evitar colapso */}
              {/* CONTENEDOR DE IMAGEN ROBUSTO PARA MOBILE */}
              <div
                className="w-16 h-16 rounded-xl overflow-hidden bg-white flex items-center justify-center border border-line/50 p-1"
                style={{ minWidth: '64px', minHeight: '64px', flexShrink: 0 }}
              >
                <img
                  src={producto.imagenes[0]}
                  alt={producto.nombre}
                  loading="lazy"
                  decoding="async"
                  className="object-contain"
                  style={{ width: '100%', height: '100%', maxWidth: 'none' }}
                />
              </div>

              {/* DETALLE Y SELECTOR */}
              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <div>
                  <Link
                    to={`/producto/${producto.id}`}
                    onClick={onClose}
                    className="font-bold text-xs uppercase tracking-wide truncate block hover:text-primary transition-colors"
                  >
                    {producto.nombre}
                  </Link>
                  <p className="text-xs font-semibold opacity-70 mt-0.5 whitespace-nowrap">
                    {`$${formatearPrecio(precio)}`}
                  </p>
                </div>

                {/* Selector de talle estilo Dropdown */}
                <div className="mt-2">
                  <select
                    aria-label={`Talle de ${producto.nombre}`}
                    value={talleActual}
                    onChange={(e) => setTalles((t) => ({ ...t, [producto.id]: e.target.value }))}
                    className="select select-xs select-bordered w-full max-w-[140px] bg-white font-medium text-xs rounded-lg"
                  >
                    <option value="" disabled>
                      Elegí talle
                    </option>
                    {opciones.map(({ talle, stock }) => (
                      <option key={talle} value={talle} disabled={stock === 0}>
                        {talle} {stock === 0 ? '(Agotado)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )
        })}
      </div>

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