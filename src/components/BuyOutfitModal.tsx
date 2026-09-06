import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { OutfitConItems } from '../types/database'
import { useCart } from '../context/cart'
import { imagenOutfit, imagenProducto } from '../lib/imagenes'

interface Props {
  outfit: OutfitConItems | null
  onClose: () => void
}

export function BuyOutfitModal({ outfit, onClose }: Props) {
  if (!outfit) return null

  return (
    <dialog className="modal modal-open" onClose={onClose}>
      <OutfitModalContent outfit={outfit} onClose={onClose} />

      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>cerrar</button>
      </form>
    </dialog>
  )
}

function OutfitModalContent({ outfit, onClose }: { outfit: OutfitConItems; onClose: () => void }) {
  const { agregarItem, setCarritoAbierto } = useCart()

  const tallesIniciales = Object.fromEntries(
    outfit.outfit_items.map((item) => {
      const variaciones = item.producto?.variaciones_stock ?? []
      const elegido = variaciones.find((v) => v.stock_disponible > 0) ?? variaciones[0]
      return [item.producto_id, elegido?.talle ?? '']
    }),
  )

  const [talles, setTalles] = useState<Record<string, string>>(tallesIniciales)

  function agregarAlCarrito() {
    for (const item of outfit.outfit_items) {
      const p = item.producto
      if (!p) continue
      agregarItem({
        producto_id: p.id,
        nombre: p.nombre,
        imagen: imagenProducto(p.imagenes[0], 0),
        talle: talles[p.id] ?? '',
        precio_unitario: p.precio,
      })
    }
    onClose()
    setCarritoAbierto(true)
  }

  return (
    <div className="modal-box max-w-md p-0 overflow-hidden rounded-3xl">
      <figure className="relative h-52 w-full bg-base-300">
        <img
          src={imagenOutfit(outfit.imagen_portada, 0)}
          alt={outfit.nombre}
          className="w-full h-full object-cover"
        />
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="btn btn-circle btn-sm bg-black/40 hover:bg-black/60 border-0 text-white absolute top-3 right-3"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </figure>

      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold">{outfit.nombre}</h3>
            <p className="text-primary font-bold text-2xl mt-1">
              $ {outfit.precio_combo.toLocaleString('es-AR')}
            </p>
          </div>
        </div>

        {outfit.descripcion && <p className="text-sm opacity-60 mt-2">{outfit.descripcion}</p>}

        <ul className="space-y-4 mt-5">
          {outfit.outfit_items.map((item, i) => {
            const p = item.producto
            if (!p) return null
            const variaciones = p.variaciones_stock ?? []

            return (
              <li key={item.id} className="flex gap-3 items-center">
                <Link
                  to={`/producto/${p.id}`}
                  onClick={onClose}
                  className="shrink-0 block"
                  aria-label={`Ver ${p.nombre}`}
                >
                  <img
                    src={imagenProducto(p.imagenes[0], i)}
                    alt={p.nombre}
                    className="w-14 h-16 object-cover rounded-xl hover:opacity-80 transition-opacity"
                  />
                </Link>
                <div className="flex-1">
                  <Link
                    to={`/producto/${p.id}`}
                    onClick={onClose}
                    className="text-sm font-semibold block hover:text-primary hover:underline transition-colors"
                  >
                    {p.nombre}
                  </Link>
                  {variaciones.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {variaciones.map((v) => (
                        <button
                          key={v.id}
                          disabled={v.stock_disponible === 0}
                          onClick={() => setTalles((t) => ({ ...t, [p.id]: v.talle }))}
                          className={`btn btn-xs min-w-10 px-3 border-2 rounded-lg font-semibold cursor-pointer ${
                            talles[p.id] === v.talle
                              ? 'btn-primary border-transparent'
                              : 'bg-base-100 border-base-300 hover:border-primary hover:text-primary'
                          } ${
                            v.stock_disponible === 0
                              ? 'opacity-30 pointer-events-none'
                              : ''
                          }`}
                        >
                          {v.talle}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs opacity-50 mt-1.5">Talle único</p>
                  )}
                </div>
                <p className="text-sm font-bold whitespace-nowrap">
                  $ {p.precio.toLocaleString('es-AR')}
                </p>
              </li>
            )
          })}
        </ul>

        <button
          onClick={agregarAlCarrito}
          className="btn w-full bg-black text-white hover:bg-neutral-800 border-0 rounded-xl font-bold mt-6 cursor-pointer transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
          </svg>
          Agregar todo el look
        </button>
      </div>
    </div>
  )
}