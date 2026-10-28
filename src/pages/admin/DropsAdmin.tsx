import { useState, useEffect } from 'react'
import {
  getDropsAdmin,
  guardarDrop,
  eliminarDrop,
  setDropActivo,
  getCategoriasAdmin,
  getTallesAdmin,
} from '../../lib/adminApi'
import type { DropConProductos } from '../../lib/adminApi'
import { ProductoFormModal } from '../../components/ProductoFormModal'
import { CATEGORIAS_FALLBACK } from '../../lib/categorias'
import { ordenarTalles } from '../../lib/talles'
import { useCierreModal } from '../../hooks/useCierreModal'
import { ImagenSegura } from '../../components/ImagenSegura'

const TALLES_FALLBACK = ['S', 'M', 'L', 'XL', 'XXL', '38', '40', '42', '44', '46', '48']

const LABEL_CLS =
  'block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1'
const INPUT_CLS =
  'w-full border border-neutral-300 rounded-lg bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:ring-1 focus:ring-black outline-none'

/** ISO -> valor para <input type="datetime-local"> en hora local. */
function aInputLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatearFecha(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DropsAdmin() {
  const [drops, setDrops] = useState<DropConProductos[]>([])
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS_FALLBACK)
  const [tallesSugeridos, setTallesSugeridos] = useState<string[]>(TALLES_FALLBACK)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Marca de tiempo tomada al cargar (evita Date.now() durante el render).
  const [ahora, setAhora] = useState(0)
  const [recarga, setRecarga] = useState(0)
  const [notificacion, setNotificacion] = useState<string | null>(null)
  const [dropModal, setDropModal] = useState<{ abierto: boolean; drop: DropConProductos | null }>({
    abierto: false,
    drop: null,
  })
  const [dropProducto, setDropProducto] = useState<{ id: string; titulo: string } | null>(null)

  useEffect(() => {
    let activo = true

    async function cargar() {
      setLoading(true)
      const [d, c, t] = await Promise.all([
        getDropsAdmin(),
        getCategoriasAdmin(),
        getTallesAdmin(),
      ])
      if (activo) {
        setDrops(d.data)
        setCategorias(c.data.length > 0 ? c.data.map((cat) => cat.nombre) : CATEGORIAS_FALLBACK)
        if (t.data.length > 0) {
          const activos = t.data.filter((x) => x.activo).map((x) => x.nombre)
          setTallesSugeridos(ordenarTalles(activos, TALLES_FALLBACK))
        }
        setError(d.error ?? c.error)
        setAhora(Date.now())
        setLoading(false)
      }
    }

    cargar()
    return () => { activo = false }
  }, [recarga])

  useEffect(() => {
    if (!notificacion) return
    const t = window.setTimeout(() => setNotificacion(null), 2500)
    return () => window.clearTimeout(t)
  }, [notificacion])

  async function handleEliminar(d: DropConProductos) {
    if (
      !window.confirm(
        `¿Eliminar el drop "${d.titulo}"? Los productos NO se borran, solo dejan de pertenecer al drop.`,
      )
    )
      return
    const { error: err } = await eliminarDrop(d.id)
    if (err) setNotificacion(`Error: ${err}`)
    else setNotificacion('Drop eliminado')
    setRecarga((n) => n + 1)
  }

  async function handleToggleActivo(d: DropConProductos) {
    const { error: err } = await setDropActivo(d.id, !d.activo)
    if (err) setNotificacion(`Error: ${err}`)
    else setNotificacion(d.activo ? 'Drop desactivado' : 'Drop activado')
    setRecarga((n) => n + 1)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Drops</h1>
          <p className="text-sm opacity-60">
            Lanzamientos con fecha. Sus productos se ocultan hasta el momento del lanzamiento.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setDropModal({ abierto: true, drop: null })}
        >
          Nuevo drop
        </button>
      </div>

      {notificacion && (
        <div className="alert alert-success text-sm mb-4 shadow-sm">{notificacion}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-24 w-full rounded-lg"></div>
          ))}
        </div>
      ) : error ? (
        <div className="alert alert-error text-sm">{error}</div>
      ) : drops.length === 0 ? (
        <div className="text-center py-16 opacity-60">
          Todavía no hay drops. Creá el primero para programar un lanzamiento.
        </div>
      ) : (
        <div className="space-y-4">
          {drops.map((d) => {
            const lanzado = new Date(d.fecha_lanzamiento).getTime() <= ahora
            return (
              <div key={d.id} className="card bg-base-100 shadow-sm">
                <div className="card-body gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold">{d.titulo}</h2>
                        <span className={`badge ${d.activo ? 'badge-success' : 'badge-neutral'}`}>
                          {d.activo ? 'Activo' : 'Inactivo'}
                        </span>
                        <span className={`badge ${lanzado ? 'badge-primary' : 'badge-warning'}`}>
                          {lanzado ? 'Lanzado' : 'Programado'}
                        </span>
                      </div>
                      {d.descripcion && (
                        <p className="text-sm opacity-70 mt-1">{d.descripcion}</p>
                      )}
                      <p className="text-sm mt-1">
                        <span className="opacity-60">Lanzamiento:</span>{' '}
                        <span className="font-medium">{formatearFecha(d.fecha_lanzamiento)}</span>
                      </p>
                      <p className="text-sm">
                        <span className="opacity-60">Productos:</span>{' '}
                        <span className="font-medium">{d.productos.length}</span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => setDropProducto({ id: d.id, titulo: d.titulo })}
                      >
                        + Producto
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => setDropModal({ abierto: true, drop: d })}
                      >
                        Editar
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => handleToggleActivo(d)}
                      >
                        {d.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        className="btn btn-sm btn-ghost text-error"
                        onClick={() => handleEliminar(d)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {d.productos.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {d.productos.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 rounded-lg border border-base-300 bg-base-200/50 px-2 py-1"
                        >
                          <div className="avatar">
                            <div className="w-8 h-10 rounded bg-base-300">
                              {p.imagenes[0] && (
                                <ImagenSegura
                                  carpeta="productos"
                                  src={p.imagenes[0]}
                                  alt={p.nombre}
                                  className="object-cover"
                                />
                              )}
                            </div>
                          </div>
                          <span className="text-xs font-medium max-w-[140px] truncate">
                            {p.nombre}
                          </span>
                          {!p.activo && (
                            <span className="badge badge-neutral badge-xs">Inactivo</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {dropModal.abierto && (
        <DropFormModal
          drop={dropModal.drop}
          onCerrar={() => setDropModal({ abierto: false, drop: null })}
          onGuardado={(mensaje) => {
            setDropModal({ abierto: false, drop: null })
            setNotificacion(mensaje)
            setRecarga((n) => n + 1)
          }}
        />
      )}

      {dropProducto && (
        <ProductoFormModal
          producto={null}
          categorias={categorias}
          tallesSugeridos={tallesSugeridos}
          dropId={dropProducto.id}
          onCerrar={() => setDropProducto(null)}
          onGuardado={(mensaje) => {
            setDropProducto(null)
            setNotificacion(`Producto agregado al drop "${dropProducto.titulo}"`)
            setRecarga((n) => n + 1)
            void mensaje
          }}
        />
      )}
    </div>
  )
}

interface DropFormProps {
  drop: DropConProductos | null
  onCerrar: () => void
  onGuardado: (mensaje: string) => void
}

function DropFormModal({ drop, onCerrar, onGuardado }: DropFormProps) {
  const [titulo, setTitulo] = useState(drop?.titulo ?? '')
  const [descripcion, setDescripcion] = useState(drop?.descripcion ?? '')
  const [fecha, setFecha] = useState(
    drop ? aInputLocal(drop.fecha_lanzamiento) : aInputLocal(new Date().toISOString()),
  )
  const [activo, setActivo] = useState(drop?.activo ?? true)
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  useCierreModal(true, onCerrar)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)

    if (!titulo.trim()) {
      setErrorMsg('El título es obligatorio.')
      return
    }
    if (!fecha) {
      setErrorMsg('Elegí una fecha y hora de lanzamiento.')
      return
    }

    setGuardando(true)
    const res = await guardarDrop({
      id: drop?.id,
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      fecha_lanzamiento: new Date(fecha).toISOString(),
      activo,
    })
    setGuardando(false)

    if (res.error) {
      setErrorMsg(res.error)
      return
    }

    onGuardado(drop ? 'Drop actualizado' : 'Drop creado')
  }

  return (
    <dialog className="modal modal-open" onClose={onCerrar} aria-label={drop ? 'Editar drop' : 'Nuevo drop'}>
      <div className="modal-box w-full max-w-lg">
        <h2 className="text-lg font-bold mb-4">{drop ? 'Editar drop' : 'Nuevo drop'}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className={LABEL_CLS}>
            Título
            <input
              type="text"
              className={INPUT_CLS}
              placeholder="Ej: Winter Drop 2026"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
            />
          </label>

          <label className={LABEL_CLS}>
            Descripción (opcional)
            <textarea
              className={INPUT_CLS}
              rows={2}
              placeholder="Ej: Edición limitada de buzos oversize"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </label>

          <label className={LABEL_CLS}>
            Fecha y hora de lanzamiento
            <input
              type="datetime-local"
              className={INPUT_CLS}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
            />
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
            />
            <span className="text-sm font-medium">Mostrar en la tienda</span>
          </label>

          {errorMsg && (
            <div className="alert alert-error text-sm" role="alert">
              {errorMsg}
            </div>
          )}

          <div className="modal-action">
            <button type="button" className="btn btn-outline" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={guardando}>
              {guardando ? <span className="loading loading-spinner loading-sm" /> : 'Guardar'}
            </button>
          </div>
        </form>
      </div>

      <form method="dialog" className="modal-backdrop">
        <button onClick={onCerrar}>cerrar</button>
      </form>
    </dialog>
  )
}
