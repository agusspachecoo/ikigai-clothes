import { useCierreModal } from '../hooks/useCierreModal'
import { descripcionColision, descripcionColisionEnOutfit, type Colision } from '../lib/conflictos'

export type AccionSolicitada = 'agregar_individual' | 'agregar_outfit'

export interface ConflictModalProps {
  abierto: boolean
  conflictos: Colision[]
  accionSolicitada: AccionSolicitada
  onConfirmar: () => void
  onCancelar: () => void
}

/**
 * Aviso genérico de colisión de stock. Se dispara antes de mutar el carrito:
 * si el usuario confirma, se reemplaza lo que colisiona y recién ahí se agrega
 * el item nuevo.
 */
export function ConflictModal({
  abierto,
  conflictos,
  accionSolicitada,
  onConfirmar,
  onCancelar,
}: ConflictModalProps) {
  useCierreModal(abierto, onCancelar)

  if (!abierto || conflictos.length === 0) return null

  const hayOutfit = conflictos.some((c) => c.outfitEnCarritoId)
  const esOutfitNuevo = accionSolicitada === 'agregar_outfit'

  return (
    <dialog className="modal modal-open" onClose={onCancelar}>
      <div className="modal-box max-w-md">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </span>
          <div className="min-w-0">
            <h3 className="font-bold text-base leading-tight">Esta prenda ya está en tu carrito</h3>
            <p className="text-sm opacity-70 mt-1">
              {esOutfitNuevo
                ? 'Algunas prendas del look ya están en tu carrito.'
                : 'Cada prenda es de edición única, así que no podemos agregar la misma dos veces.'}
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {conflictos.map((c, i) => (
            <li key={`${c.producto_id}-${i}`} className="text-sm leading-snug">
              {c.outfitEnCarritoId
                ? descripcionColisionEnOutfit(c)
                : descripcionColision(c)}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-sm">
          {hayOutfit
            ? 'Si reemplazás, quitamos del carrito el look completo en conflicto y agrega la prenda que elegiste.'
            : 'Si reemplazás, quitamos del carrito la prenda que ya tenías y agrega la que elegiste.'}
        </p>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onCancelar} type="button">
            Cancelar
          </button>
          <button className="btn btn-neutral" onClick={onConfirmar} type="button">
            Reemplazar por el nuevo
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onCancelar}>cerrar</button>
      </form>
    </dialog>
  )
}