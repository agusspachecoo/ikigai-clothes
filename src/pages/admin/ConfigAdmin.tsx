import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { CONFIG_POR_DEFECTO } from '../../context/tienda'
import { ImageUploader } from '../../components/ImageUploader'
import { eliminarImagen } from '../../lib/adminApi'

interface Fila {
  clave: string
  valor: string
  descripcion: string | null
}

const NUMERICAS = new Set(['umbral_envio_gratis', 'cuotas_sin_interes'])
const BOOLEANAS = new Set(['envio_gratis_activo'])
const CLAVE_IMAGEN = 'imagen_showroom'

/** La foto del showroom se comprime a WebP antes de subirla. */
const COMPRESION_SHOWROOM = { maxWidth: 1800, quality: 0.82, maxBytes: 320 * 1024 }

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
      .upsert({ clave, valor }, { onConflict: 'clave' })
    setGuardando(null)
    if (err) setNotificacion(`Error: ${err.message}`)
    else setNotificacion('Configuración guardada')
    // Se devuelve el error para que quien llama pueda decidir si sigue con pasos
    // que asumen que el guardado fue exitoso.
    return { error: err?.message ?? null }
  }

  /**
   * Guarda solo la imagen del showroom (y refresca la fila) sin tocar el resto
   * de la config.
   *
   * La foto anterior se borra recién después de que el upsert confirma, por la
   * misma razón que en categorías: si se borrara antes y el guardado fallara,
   * la config apuntaría a un archivo inexistente y el inicio quedaría sin foto.
   */
  async function guardarImagen(url: string) {
    const anterior = filas.find((f) => f.clave === CLAVE_IMAGEN)?.valor ?? ''
    const { error } = await guardar(CLAVE_IMAGEN, url)
    if (error) return
    if (anterior && anterior !== url) {
      await eliminarImagen(anterior)
    }
    void cargar()
  }

  async function restaurar() {
    if (!window.confirm('¿Restaurar los valores por defecto?')) return
    setGuardando('__todos__')
    for (const [clave, valor] of Object.entries(CONFIG_POR_DEFECTO)) {
      await supabase
        .from('config_tienda')
        .upsert({ clave, valor: String(valor) }, { onConflict: 'clave' })
    }
    setGuardando(null)
    setNotificacion('Valores por defecto restaurados')
    void cargar()
  }

  const imagenShowroom = filas.find((f) => f.clave === CLAVE_IMAGEN)?.valor ?? ''
  const filasVisibles = filas.filter((f) => f.clave !== CLAVE_IMAGEN)

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
        <div className="space-y-6">
          {/* Imagen del showroom: se comprime y sube sola al elegir el archivo */}
          <section className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-lg">Imagen del showroom</h2>
              <p className="text-xs opacity-60 -mt-1">
                Se muestra en el bloque de showroom al final de la home. Ideal 16:9 (por ejemplo
                1800x1000). La imagen se comprime a WebP en el navegador antes de subirla, así que
                no ocupa lugar aunque el original sea una foto de 5 MB.
              </p>

              <div className="max-w-md mt-2">
                <ImageUploader
                  carpeta="showroom"
                  proporcion="apaisado"
                  altoMinimo="h-48"
                  texto="Elegí o arrastrá la foto del showroom"
                  imagenActual={imagenShowroom}
                  onUrl={guardarImagen}
                  compresion={COMPRESION_SHOWROOM}
                />
              </div>

              {imagenShowroom && (
                <p className="text-xs opacity-60 break-all">URL activa: {imagenShowroom}</p>
              )}
            </div>
          </section>

          <div className="card bg-base-100 shadow-sm divide-y divide-base-200">
            {filasVisibles.map((f) => {
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
        </div>
      )}

      <p className="text-xs opacity-60 mt-4">
        Los cambios se aplican en la tienda en la próxima carga. El descuento por transferencia se
        carga como porcentaje (20 = 20%). La imagen del showroom se publica apenas la subís.
      </p>
    </div>
  )
}
