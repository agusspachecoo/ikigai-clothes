import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useOutfits } from '../hooks/useOutfits'
import { BuyOutfitModal } from '../components/BuyOutfitModal'
import { imagenOutfit } from '../lib/imagenes'
import type { OutfitConItems } from '../types/database'

export function Outfits() {
  const { outfits, loading } = useOutfits()
  const [outfitSeleccionado, setOutfitSeleccionado] = useState<OutfitConItems | null>(null)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Outfits / Combos</h1>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-80 w-full rounded-lg"></div>
          ))}
        </div>
      ) : outfits.length === 0 ? (
        <div className="text-center py-16">
          <p className="opacity-60">No hay outfits disponibles</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {outfits.map((o) => (
            <div key={o.id} className="card bg-base-100 shadow-sm overflow-hidden">
              <figure className="aspect-[4/3] cursor-pointer">
                <button
                  onClick={() => setOutfitSeleccionado(o)}
                  aria-label={`Ver detalle del look ${o.nombre}`}
                  className="w-full h-full block cursor-pointer"
                >
                  <img
                    src={imagenOutfit(o.imagen_portada, 0)}
                    alt={o.nombre}
                    className="w-full h-full object-cover"
                  />
                </button>
              </figure>
              <div className="card-body">
                <h2 className="card-title">{o.nombre}</h2>
                {o.descripcion && <p className="text-sm opacity-70">{o.descripcion}</p>}
                <p className="text-primary font-bold text-lg mt-2">
                  Combo: ${o.precio_combo.toLocaleString('es-AR')}
                </p>
                <div className="mt-2">
                  <p className="text-xs font-semibold opacity-60 mb-1">Incluye:</p>
                  <ul className="text-sm space-y-1">
                    {o.outfit_items.map((item) => (
                      <li key={item.id}>
                        <Link
                          to={`/producto/${item.producto_id}`}
                          className="link link-hover hover:text-primary"
                        >
                          {item.producto?.nombre ?? 'Ver producto'}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => setOutfitSeleccionado(o)}
                  className="btn w-full bg-black text-white hover:bg-neutral-800 border-0 rounded-xl font-bold mt-4 cursor-pointer transition-colors"
                >
                  Comprar look
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <BuyOutfitModal
        outfit={outfitSeleccionado}
        onClose={() => setOutfitSeleccionado(null)}
      />
    </div>
  )
}
