import { useClipboard } from '../hooks/useClipboard'
import { DATOS_TRANSFERENCIA } from '../lib/pagos'

type Clave = keyof typeof DATOS_TRANSFERENCIA

/**
 * Datos de la cuenta para transferir, con botón de copiar en cada valor.
 *
 * CBU y Alias son los dos que la gente copia de verdad: el CBU son 22 dígitos
 * que hay que tipear sin errores, y el Alias va pegado en la app del banco.
 */
export function DatosBancarios({ monto }: { monto?: number }) {
  const { estado, ultimoCopiado, copiar } = useClipboard()

  const filas: { clave: Clave; etiqueta: string; valor: string; mono?: boolean; copiable?: boolean }[] = [
    { clave: 'banco', etiqueta: 'Banco / App', valor: DATOS_TRANSFERENCIA.banco },
    { clave: 'titular', etiqueta: 'Titular', valor: DATOS_TRANSFERENCIA.titular },
    { clave: 'cuil', etiqueta: 'CUIL', valor: DATOS_TRANSFERENCIA.cuil, mono: true },
    { clave: 'cbu', etiqueta: 'CBU', valor: DATOS_TRANSFERENCIA.cbu, mono: true, copiable: true },
    { clave: 'alias', etiqueta: 'Alias', valor: DATOS_TRANSFERENCIA.alias, copiable: true },
    { clave: 'cajaAhorro', etiqueta: 'Caja de Ahorro N°', valor: DATOS_TRANSFERENCIA.cajaAhorro, mono: true },
  ]

  return (
    <div className="space-y-3">
      {filas.map((fila) => (
        <div
          key={fila.clave}
          className="flex items-center justify-between gap-3 py-2 border-b border-base-300 last:border-0"
        >
          <span className="text-xs opacity-60 shrink-0">{fila.etiqueta}</span>
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`text-sm font-medium text-right truncate ${fila.mono ? 'font-mono' : ''}`}
              title={fila.valor}
            >
              {fila.valor}
            </span>
            {fila.copiable && (
              <BotonCopiar
                etiqueta={fila.etiqueta}
                valor={fila.valor}
                copiado={estado === 'copiado' && ultimoCopiado === fila.valor}
                onCopiar={() => copiar(fila.valor)}
              />
            )}
          </div>
        </div>
      ))}

      {estado === 'error' && (
        <p className="text-error text-xs">
          No se pudo copiar. Seleccioná el dato y copialo a mano.
        </p>
      )}

      {monto !== undefined && (
        <div className="bg-base-100 rounded-xl p-4 mt-4">
          <p className="text-xs opacity-60 mb-1">Importe exacto a transferir</p>
          <p className="text-2xl font-bold text-success">
            ${monto.toLocaleString('es-AR')}
          </p>
          <p className="text-xs opacity-60 mt-2">
            Pasame el importe exacto por WhatsApp para que la transferencia se acredite sola.
          </p>
          <div className="mt-3">
<BotonCopiar
               etiqueta="el importe"
               valor={monto.toFixed(2)}
               copiado={estado === 'copiado' && ultimoCopiado === monto.toFixed(2)}
               onCopiar={() => copiar(monto.toFixed(2))}
               className="btn-sm btn-block btn-success"
             />
          </div>
        </div>
      )}
    </div>
  )
}

function BotonCopiar({
  etiqueta,
  copiado,
  onCopiar,
  className = 'btn-xs',
}: {
  etiqueta: string
  valor: string
  copiado: boolean
  onCopiar: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onCopiar}
      aria-label={`Copiar ${etiqueta} al portapapeles`}
      className={`btn ${className} shrink-0`}
    >
      {copiado ? (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Copiado
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
            />
          </svg>
          Copiar
        </>
      )}
    </button>
  )
}