import { useState, useEffect } from 'react'
import {
  actualizarTalle,
  crearTalle,
  eliminarTalle,
  getProductosAdmin,
  getTallesAdmin,
} from '../../lib/adminApi'
import { useCierreModal } from '../../hooks/useCierreModal'
import type { Talle } from '../../types/database'

export function TallesAdmin() {
  const [talles, setTalles] = useState<Talle[]>([])
  const [usos, setUsos] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [notificacion, setNotificacion] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [orden, setOrden] = useState('')
  const [creando, setCreando] = useState(false)
  const [errorCrear, setErrorCrear] = useState<string | null>(null)
  const [editando, setEditando] = useState<Talle | null>(null)

  useEffect(() => {
    let activo = true

    async function cargar() {
      setLoading(true)
      const [t, p] = await Promise.all([getTallesAdmin(), getProductosAdmin()])
      if (activo) {
        setTalles(t.data)

        // Cuántos productos usan cada talle, para avisar antes de borrar.
        const conteo: Record<string, number> = {}
        for (const prod of p.data) {
          for (const v of prod.variaciones_stock ?? []) {
            const clave = v.talle.toUpperCase()
            conteo[clave] = (conteo[clave] ?? 0) + 1
          }
        }
        setUsos(conteo)
        setError(t.error ?? p.error)
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

  const proximoOrden =
    talles.length > 0 ? Math.max(...talles.map((t) => t.orden)) + 1 : 1

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    setErrorCrear(null)

    const valor = nombre.trim()
    if (!valor) {
      setErrorCrear('Ingresá un nombre para el talle.')
      return
    }
    if (talles.some((t) => t.nombre.toLowerCase() === valor.toLowerCase())) {
      setErrorCrear('Ya existe un talle con ese nombre.')
      return
    }

    setCreando(true)
    const { error: err } = await crearTalle(valor, orden ? Number(orden) : proximoOrden)
    setCreando(false)

    if (err) {
      setErrorCrear(err)
      return
    }

    setNombre('')
    setOrden('')
    setNotificacion('Talle creado')
    setRecarga((n) => n + 1)
  }

  async function handleToggleActivo(t: Talle) {
    const { error: err } = await actualizarTalle(t.id, { activo: !t.activo })
    if (err) setNotificacion(`Error: ${err}`)
    else setNotificacion(t.activo ? 'Talle oculto' : 'Talle activado')
    setRecarga((n) => n + 1)
  }

  async function handleEliminar(t: Talle) {
    const enUso = usos[t.nombre.toUpperCase()] ?? 0
    const msg =
      enUso > 0
        ? `El talle "${t.nombre}" está en uso en ${enUso} producto(s). Los productos se conservan, pero el talle dejará de sugerirse. ¿Eliminar de todas formas?`
        : `¿Eliminar el talle "${t.nombre}"?`

    if (!window.confirm(msg)) return

    const { error: err } = await eliminarTalle(t.id)
    if (err) setNotificacion(`Error: ${err}`)
    else setNotificacion('Talle eliminado')
    setRecarga((n) => n + 1)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Talles</h1>
      </div>

      {notificacion && (
        <div className="alert alert-success text-sm mb-4 shadow-sm">{notificacion}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton h-14 w-full rounded-lg"></div>
          ))}
        </div>
      ) : error ? (
        <div className="alert alert-error text-sm">
          {error}
          <p className="mt-1 text-xs">
            Ejecutá la migración <span className="font-mono">024_talles.sql</span> en Supabase.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista */}
          <div className="lg:col-span-2 card bg-base-100 shadow-sm">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-20">Orden</th>
                    <th>Talle</th>
                    <th>Productos</th>
                    <th>Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {talles.map((t) => (
                    <tr key={t.id} className={t.activo ? '' : 'opacity-50'}>
                      <td className="font-mono text-xs opacity-60">{t.orden}</td>
                      <td className="font-medium">{t.nombre}</td>
                      <td>
                        <span className="badge badge-outline">
                          {usos[t.nombre.toUpperCase()] ?? 0}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${t.activo ? 'badge-success' : 'badge-neutral'}`}>
                          {t.activo ? 'Activo' : 'Oculto'}
                        </span>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button
                          className="btn btn-xs btn-ghost"
                          onClick={() => setEditando(t)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-xs btn-ghost"
                          onClick={() => handleToggleActivo(t)}
                        >
                          {t.activo ? 'Ocultar' : 'Activar'}
                        </button>
                        <button
                          className="btn btn-xs btn-ghost text-error"
                          onClick={() => handleEliminar(t)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={handleCrear} className="card bg-base-100 shadow-sm p-5 h-fit space-y-4">
            <h2 className="font-bold">Agregar talle</h2>
            <label className="form-control">
              <span className="label-text text-sm mb-1">Nombre</span>
              <input
                type="text"
                className="input input-bordered"
                placeholder="Ej: XS, 50, Único"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </label>

            <label className="form-control">
              <span className="label-text text-sm mb-1">Orden (opcional)</span>
              <input
                type="number"
                className="input input-bordered"
                placeholder={`Automático: ${proximoOrden}`}
                value={orden}
                onChange={(e) => setOrden(e.target.value)}
              />
            </label>

            <div className="text-xs opacity-60">
              <p>
                Los talles definen las sugerencias al cargar un producto y el orden en que se
                muestran en la tienda. El stock de cada prenda se carga igual, producto por producto.
              </p>
            </div>

            {errorCrear && <div className="alert alert-error text-sm">{errorCrear}</div>}

            <button type="submit" className="btn btn-primary btn-block" disabled={creando}>
              {creando ? <span className="loading loading-spinner loading-sm" /> : 'Crear talle'}
            </button>
          </form>
        </div>
      )}

      {editando && (
        <ModalEditarTalle
          talle={editando}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null)
            setNotificacion('Talle actualizado')
            setRecarga((n) => n + 1)
          }}
        />
      )}
    </div>
  )
}

function ModalEditarTalle({
  talle,
  onCerrar,
  onGuardado,
}: {
  talle: Talle
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [nombre, setNombre] = useState(talle.nombre)
  const [orden, setOrden] = useState(String(talle.orden))
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useCierreModal(true, onCerrar)

  async function guardar() {
    if (!nombre.trim()) {
      setErrorMsg('El nombre no puede quedar vacío.')
      return
    }

    setGuardando(true)
    const { error: err } = await actualizarTalle(talle.id, {
      nombre: nombre.trim(),
      orden: Number(orden) || 0,
    })

    if (err) {
      setGuardando(false)
      setErrorMsg(err)
      return
    }

    setGuardando(false)
    onGuardado()
  }

  return (
    <dialog className="modal modal-open" onClose={onCerrar}>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onCerrar}>cerrar</button>
      </form>
      <div className="modal-box max-w-lg">
        <h3 className="font-bold text-lg mb-4">Editar talle</h3>

        <div className="space-y-4">
          <label className="form-control">
            <span className="label-text text-sm mb-1">Nombre</span>
            <input
              type="text"
              className="input input-bordered w-full"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>

          <label className="form-control">
            <span className="label-text text-sm mb-1">Orden</span>
            <input
              type="number"
              className="input input-bordered w-full"
              value={orden}
              onChange={(e) => setOrden(e.target.value)}
            />
          </label>

          {errorMsg && <div className="alert alert-error text-sm">{errorMsg}</div>}
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onCerrar} type="button">
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={guardar} disabled={guardando}>
            {guardando ? <span className="loading loading-spinner loading-sm" /> : 'Guardar'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
