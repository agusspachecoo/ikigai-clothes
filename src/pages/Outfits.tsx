import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useOutfits } from '../hooks/useOutfits'
import { BuyOutfitModal } from '../components/BuyOutfitModal'
import { obtenerUrlImagen, IMAGEN_FALLBACK } from '../lib/imagenes'
import type { OutfitConItems } from '../types/database'
import { useSeo } from '../hooks/useSeo'

function OutfitItemCardImagen({ outfit }: { outfit: OutfitConItems }) {
  const [fallo, setFallo] = useState(false)
  const urlFinal = obtenerUrlImagen(outfit.imagen_portada)

  if (fallo || !urlFinal) {
    return (
      <img
        src={IMAGEN_FALLBACK}
        alt={`Look ${outfit.nombre}`}
        className="w-full h-full object-cover object-[center_20%]"
        loading="lazy"
        decoding="async"
        width={420}
        height={747}
      />
    )
  }

  return (
    <img
      src={urlFinal}
      alt={`Look ${outfit.nombre}: ${outfit.outfit_items.length} prendas combinadas`}
      loading="lazy"
      decoding="async"
      width={420}
      height={747}
      className="w-full h-full object-cover object-[center_20%]"
      onError={() => setFallo(true)}
    />
  )
}

export function Outfits() {
  useSeo()

  const { outfits, loading } = useOutfits()
  const [outfitSeleccionado, setOutfitSeleccionado] = useState<OutfitConItems | null>(null)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Outfits / Combos</h1>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-80 w-full rounded-lg"></div>
          ))}
        </div>
      ) : outfits.length === 0 ? (
        <div className="text-center py-16">
          <p className="opacity-60">No hay outfits disponibles</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {outfits.map((o) => (
            <div
              key={o.id}
              className="card bg-base-100 border border-line shadow-none overflow-hidden pt-3 px-3"
            >
              <figure className="relative w-full aspect-[9/16] rounded-2xl overflow-hidden bg-neutral-100 cursor-pointer">
                <button
                  onClick={() => setOutfitSeleccionado(o)}
                  aria-label={`Ver detalle del look ${o.nombre}`}
                  className="w-full h-full block cursor-pointer"
                >
                  <OutfitItemCardImagen outfit={o} />
                </button>
                <span className="absolute top-3 left-3 z-10 px-2.5 py-1 text-xs font-bold bg-base-100 text-success rounded-full shadow-sm border border-success/20">
                  -5% OFF
                </span>
              </figure>
              <div className="card-body p-3 gap-0.5">
                <h2 className="card-title text-base">{o.nombre}</h2>
                {o.descripcion && <p className="text-sm opacity-70 line-clamp-2">{o.descripcion}</p>}
                <p className="text-sm text-base-content/60 mt-1">
                  Combo: ${o.precio_combo.toLocaleString('es-AR')}
                </p>
                <p className="font-bold text-base-content">
                  ${(o.precio_combo * 0.8).toLocaleString('es-AR')}{' '}
                  <span className="text-xs font-medium opacity-60">por Transferencia</span>
                </p>
                <p className="inline-flex items-center gap-1.5 self-start rounded-sm bg-green-100 text-green-800 px-2 py-1 text-xs font-semibold">
                  <span aria-hidden="true">💳</span>
                  6 cuotas de ${(o.precio_combo / 6).toLocaleString('es-AR')} sin interés
                </p>
                <div className="mt-1">
                  <p className="text-xs font-semibold opacity-60 mb-0.5">Incluye:</p>
                  <ul className="text-sm space-y-0.5">
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
                  className="btn btn-neutral btn-sm btn-block mt-2 cursor-pointer"
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