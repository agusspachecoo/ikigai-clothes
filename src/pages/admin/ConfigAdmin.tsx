import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { CONFIG_POR_DEFECTO } from '../../context/tienda'

interface Fila {
  clave: string
  valor: string
  descripcion: string | null
}

const NUMERICAS = new Set(['umbral_envio_gratis', 'cuotas_sin_interes'])
const BOOLEANAS = new Set(['envio_gratis_activo'])

export function ConfigAdmin() {
  const [filas, setFilas] = useState<Fila[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notificacion, setNotificacion] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)

  async function cargar() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('config_tienda')
      .select('clave, valor, descripcion')
      .order('clave')
    setFilas((data ?? []) as Fila[])
    setError(err?.message ?? null)
    setLoading(false)
  }

  useEffect(() => {
    let activo = true
    void (async () => {
      await Promise.resolve()
      await cargar()
      if (!activo) return
    })()
    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    if (!notificacion) return
    const t = window.setTimeout(() => setNotificacion(null), 2500)
    return () => window.clearTimeout(t)
  }, [notificacion])

  function cambiar(clave: string, valor: string) {
    setFilas((prev) => prev.map((f) => (f.clave === clave ? { ...f, valor } : f)))
  }

  async function guardar(clave: string, valor: string) {
    setGuardando(clave)
    const { error: err } = await supabase
      .from('config_tienda')
      .update({ valor })
      .eq('clave', clave)
    setGuardando(null)
    if (err) setNotificacion(`Error: ${err.message}`)
    else setNotificacion('Configuración guardada')
  }

  async function restaurar() {
    if (!window.confirm('¿Restaurar los valores por defecto?')) return
    setGuardando('__todos__')
    for (const [clave, valor] of Object.entries(CONFIG_POR_DEFECTO)) {
      await supabase.from('config_tienda').update({ valor: String(valor) }).eq('clave', clave)
    }
    setGuardando(null)
    setNotificacion('Valores por defecto restaurados')
    void cargar()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Configuración</h1>
        <button
          className="btn btn-sm btn-outline"
          onClick={restaurar}
          disabled={guardando === '__todos__'}
        >
          Restaurar valores por defecto
        </button>
      </div>

      {notificacion && <div className="alert alert-success text-sm mb-4">{notificacion}</div>}

      {error ? (
        <div className="alert alert-error text-sm">
          {error}
          <p className="mt-1 text-xs">
            Ejecutá la migración <span className="font-mono">017_config_newsletter.sql</span>.
          </p>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-14 w-full" />
          ))}
        </div>
      ) : (
        <div className="card bg-base-100 shadow-sm divide-y divide-base-200">
          {filas.map((f) => {
            const porDefecto = String(
              (CONFIG_POR_DEFECTO as unknown as Record<string, unknown>)[f.clave] ?? '',
            )
            const cambiado = f.valor !== porDefecto

            return (
              <div key={f.clave} className="p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-56">
                  <p className="font-mono text-sm font-semibold">{f.clave}</p>
                  {f.descripcion && <p className="text-xs opacity-60">{f.descripcion}</p>}
                </div>

                {BOOLEANAS.has(f.clave) ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="toggle toggle-sm"
                      checked={f.valor === 'true'}
                      onChange={(e) => cambiar(f.clave, String(e.target.checked))}
                    />
                    {f.valor === 'true' ? 'Activado' : 'Desactivado'}
                  </label>
                ) : (
                  <input
                    type={NUMERICAS.has(f.clave) ? 'number' : 'text'}
                    min={0}
                    className="input input-bordered input-sm w-40"
                    value={f.valor}
                    onChange={(e) => cambiar(f.clave, e.target.value)}
                  />
                )}

                <button
                  className="btn btn-xs btn-primary"
                  disabled={guardando === f.clave || (!cambiado && f.valor !== porDefecto)}
                  onClick={() => guardar(f.clave, f.valor)}
                >
                  {guardando === f.clave ? '...' : 'Guardar'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs opacity-60 mt-4">
        Los cambios se aplican en la tienda en la próxima carga. El descuento por transferencia se
        carga como porcentaje (20 = 20%).
      </p>
    </div>
  )
}
