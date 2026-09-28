import { useState } from 'react'
import { cotizarEnvio, claveOpcion, nombreTransporte, type OpcionEnvio, type ResultadoCotizacion } from '../lib/enviopack'
import type { CartItem } from '../types/cart'

interface EnvioCalculatorProps {
  items: CartItem[]
  onSelect?: (opcion: OpcionEnvio) => void
  selectedCarrierCode?: string | null
  showHeader?: boolean
}

export function EnvioCalculator({
  items,
  onSelect,
  selectedCarrierCode,
  showHeader = true,
}: EnvioCalculatorProps) {
  const [cp, setCp] = useState('')
  const [resultado, setResultado] = useState<ResultadoCotizacion | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCalcular(e: React.FormEvent) {
    e.preventDefault()
    const limpio = cp.trim().replace(/\D/g, '')
    if (limpio.length < 4) {
      setError('El código postal debe tener al menos 4 dígitos.')
      return
    }

    setError(null)
    setLoading(true)
    try {
      const res = await cotizarEnvio(limpio, items)
      if (res.error) {
        setError(res.error)
        setResultado(null)
      } else {
        setResultado(res)
      }
    } finally {
      setLoading(false)
    }
  }

  const seleccionado = resultado?.opciones.find((o) => claveOpcion(o) === (selectedCarrierCode ?? ''))

  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 p-5">
      {showHeader && <h3 className="font-semibold text-sm mb-3">Calcular costo de envío</h3>}

      <form onSubmit={handleCalcular} className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={10}
          placeholder="Código Postal"
          className="input input-bordered input-sm flex-1 rounded-xl"
          value={cp}
          onChange={(e) => {
            setCp(e.target.value.replace(/\D/g, ''))
            setError(null)
          }}
        />
        <button
          type="submit"
          disabled={loading || !cp.trim()}
          className="btn btn-sm btn-primary rounded-xl whitespace-nowrap"
        >
          {loading ? <span className="loading loading-spinner loading-xs" /> : 'Calcular Envío'}
        </button>
      </form>

      {error && (
        <p className="text-error text-xs mt-2">{error}</p>
      )}

      {resultado && !error && resultado.opciones.length === 0 && (
        <p className="text-xs opacity-60 mt-2">
          No se encontraron opciones de envío para el código postal {resultado.codigo_postal}.
        </p>
      )}

      {resultado && resultado.opciones.length > 0 && (
        <ul className="mt-3 space-y-2 max-h-56 overflow-y-auto">
          {resultado.opciones.map((opt, idx) => {
            const isSelected = onSelect && selectedCarrierCode === claveOpcion(opt)
            return (
              <li key={`${opt.carrier.id ?? idx}-${opt.service_type.code}`}>
                <button
                  type="button"
                  onClick={() => onSelect?.(opt)}
                  disabled={!opt.selectable}
                  className={`w-full text-left rounded-xl p-3 border-2 transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-base-300 hover:border-primary/50'
                  } ${!opt.selectable ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {opt.carrier.logo ? (
                        <img src={opt.carrier.logo} alt="" className="w-5 h-5 rounded" />
                      ) : (
                        <span className="text-xs font-bold bg-base-200 rounded px-1.5 py-0.5">
                          {nombreTransporte(opt).charAt(0)}
                        </span>
                      )}
                      <div>
                        <span className="font-semibold text-sm">{nombreTransporte(opt)}</span>
                        {opt.service_type.name && (
                          <span className="text-xs opacity-60 ml-1">· {opt.service_type.name}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-sm">
                        ${opt.costo.toLocaleString('es-AR')}
                      </span>
                      {opt.estimado.leyenda && (
                        <span className="block text-xs opacity-60">{opt.estimado.leyenda}</span>
                      )}
                    </div>
                  </div>
                  {(opt.tags.includes('cheapest') || opt.tags.includes('fastest')) && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {opt.tags.includes('cheapest') && (
                        <span className="badge badge-success badge-xs">Más barato</span>
                      )}
                      {opt.tags.includes('fastest') && (
                        <span className="badge badge-info badge-xs">Más rápido</span>
                      )}
                    </div>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {seleccionado && (
        <div className="mt-3 rounded-xl bg-primary/5 border border-primary/30 p-3 text-sm">
          <div className="flex justify-between font-semibold">
            <span>{nombreTransporte(seleccionado)} · {seleccionado.service_type.name}</span>
            <span className="text-primary">${seleccionado.costo.toLocaleString('es-AR')}</span>
          </div>
          <p className="text-xs opacity-60 mt-1">
            Entrega estimada: {seleccionado.estimado.leyenda || 'A confirmar'}
          </p>
        </div>
      )}
    </div>
  )
}