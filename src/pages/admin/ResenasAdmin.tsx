import { useState, useEffect } from 'react'
import {
  getResenasAdmin,
  setResenaAprobada,
  eliminarResena,
  getComunidadFotosAdmin,
  setComunidadFotoAprobada,
  eliminarComunidadFoto,
  type ResenaConProducto,
} from '../../lib/adminApi'
import type { ComunidadFoto } from '../../types/database'
import { parseResenaImagenes } from '../../types/database'

export function ResenasAdmin() {
  const [resenas, setResenas] = useState<ResenaConProducto[]>([])
  const [fotos, setFotos] = useState<ComunidadFoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [notificacion, setNotificacion] = useState<string | null>(null)
  const [verFotos, setVerFotos] = useState(false)

  useEffect(() => {
    let activo = true

    async function cargar() {
      setLoading(true)
      const [r, f] = await Promise.all([getResenasAdmin(), getComunidadFotosAdmin()])
      if (activo) {
        setResenas(r.data)
        setFotos(f.data)
        setError(r.error ?? f.error)
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

  const pendientes = resenas.filter((r) => !r.aprobado)
  const aprobadas = resenas.filter((r) => r.aprobado)

  async function aprobar(r: ResenaConProducto, value: boolean) {
    const { error: err } = await setResenaAprobada(r.id, value)
    if (err) setNotificacion(`Error: ${err}`)
    else setNotificacion(value ? 'Reseña aprobada y publicada' : 'Reseña desaprobada')
    setRecarga((n) => n + 1)
  }

  async function rechazar(r: ResenaConProducto) {
    if (!window.confirm(`¿Rechazar y eliminar la reseña de ${r.nombre_usuario}?`)) return
    const { error: err } = await eliminarResena(r.id)
    if (err) setNotificacion(`Error: ${err}`)
    else setNotificacion('Reseña rechazada')
    setRecarga((n) => n + 1)
  }

  async function aprobarFoto(f: ComunidadFoto, value: boolean) {
    const { error: err } = await setComunidadFotoAprobada(f.id, value)
    if (err) setNotificacion(`Error: ${err}`)
    else setNotificacion(value ? 'Foto aprobada y publicada' : 'Foto desaprobada')
    setRecarga((n) => n + 1)
  }

  async function eliminarFoto(f: ComunidadFoto) {
    if (!window.confirm(`¿Eliminar la foto de ${f.nombre_usuario}?`)) return
    const { error: err } = await eliminarComunidadFoto(f.id)
    if (err) setNotificacion(`Error: ${err}`)
    else setNotificacion('Foto eliminada')
    setRecarga((n) => n + 1)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Moderación</h1>
        <div className="tabs tabs-boxed">
          <button
            className={`tab ${!verFotos ? 'tab-active' : ''}`}
            onClick={() => setVerFotos(false)}
          >
            Reseñas
            {pendientes.length > 0 && (
              <span className="badge badge-error badge-sm ml-1">{pendientes.length}</span>
            )}
          </button>
          <button
            className={`tab ${verFotos ? 'tab-active' : ''}`}
            onClick={() => setVerFotos(true)}
          >
            Fotos Comunidad
          </button>
        </div>
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
      ) : verFotos ? (
        <ComunidadFotosGrid
          fotos={fotos}
          onAprobar={aprobarFoto}
          onEliminar={eliminarFoto}
        />
      ) : (
        <ResenasList
          pendientes={pendientes}
          aprobadas={aprobadas}
          onAprobar={aprobar}
          onRechazar={rechazar}
        />
      )}
    </div>
  )
}

function ResenasList({
  pendientes,
  aprobadas,
  onAprobar,
  onRechazar,
}: {
  pendientes: ResenaConProducto[]
  aprobadas: ResenaConProducto[]
  onAprobar: (r: ResenaConProducto, value: boolean) => void
  onRechazar: (r: ResenaConProducto) => void
}) {
  function renderResena(r: ResenaConProducto) {
    return (
      <div key={r.id} className="card bg-base-100 shadow-sm p-4">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{r.nombre_usuario}</span>
                <span className="badge badge-outline badge-sm">{r.producto?.nombre}</span>
              </div>
              <div className="rating rating-sm">
                {Array.from({ length: 5 }).map((_, i) => (
                  <input
                    key={i}
                    type="radio"
                    className="mask mask-star-2 bg-warning"
                    disabled
                    checked={i < r.puntuacion}
                  />
                ))}
              </div>
            </div>
            <p className="text-sm mt-2">{r.comentario}</p>
            <p className="text-xs opacity-50 mt-1">
              {new Date(r.created_at).toLocaleDateString('es-AR')}
            </p>
          </div>
          {r.imagen_url && (
            <img
              src={parseResenaImagenes(r.imagen_url)[0] ?? r.imagen_url}
              alt=""
              className="w-16 h-20 object-cover rounded-xl bg-base-300 shrink-0"
            />
          )}
        </div>
        <div className="flex gap-2 mt-3">
          {r.aprobado ? (
            <>
              <button className="btn btn-xs btn-outline" onClick={() => onAprobar(r, false)}>
                Desaprobar
              </button>
              <button className="btn btn-xs btn-ghost text-error" onClick={() => onRechazar(r)}>
                Eliminar
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-xs btn-primary" onClick={() => onAprobar(r, true)}>
                Aprobar
              </button>
              <button className="btn btn-xs btn-ghost text-error" onClick={() => onRechazar(r)}>
                Rechazar
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {pendientes.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest opacity-50 mb-3">
            Pendientes ({pendientes.length})
          </h2>
          <div className="space-y-3">{pendientes.map(renderResena)}</div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest opacity-50 mb-3">
          Aprobadas ({aprobadas.length})
        </h2>
        {aprobadas.length === 0 ? (
          <p className="text-sm opacity-60">No hay reseñas aprobadas todavía.</p>
        ) : (
          <div className="space-y-3">{aprobadas.map(renderResena)}</div>
        )}
      </section>
    </div>
  )
}

function ComunidadFotosGrid({
  fotos,
  onAprobar,
  onEliminar,
}: {
  fotos: ComunidadFoto[]
  onAprobar: (f: ComunidadFoto, value: boolean) => void
  onEliminar: (f: ComunidadFoto) => void
}) {
  const pendientes = fotos.filter((f) => !f.aprobado)
  const aprobadas = fotos.filter((f) => f.aprobado)

  function renderFoto(f: ComunidadFoto) {
    return (
      <div key={f.id} className={`card bg-base-100 shadow-sm overflow-hidden ${f.aprobado ? '' : 'border-2 border-warning'}`}>
        <figure className="aspect-square bg-base-300">
          <img src={f.imagen_url} alt="" className="w-full h-full object-cover" />
        </figure>
        <div className="card-body p-3">
          <p className="text-sm font-medium">{f.nombre_usuario}</p>
          {f.instagram_handle && (
            <p className="text-xs opacity-50">@{f.instagram_handle}</p>
          )}
          <div className="flex gap-1.5 mt-1">
            {f.aprobado ? (
              <button className="btn btn-xs btn-outline" onClick={() => onAprobar(f, false)}>
                Desaprobar
              </button>
            ) : (
              <button className="btn btn-xs btn-primary" onClick={() => onAprobar(f, true)}>
                Aprobar
              </button>
            )}
            <button className="btn btn-xs btn-ghost text-error" onClick={() => onEliminar(f)}>
              Eliminar
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (fotos.length === 0) {
    return <p className="text-sm opacity-60 py-10 text-center">Todavía no se recibieron fotos.</p>
  }

  return (
    <div className="space-y-6">
      {pendientes.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest opacity-50 mb-3">
            Pendientes ({pendientes.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {pendientes.map(renderFoto)}
          </div>
        </section>
      )}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest opacity-50 mb-3">
          Aprobadas ({aprobadas.length})
        </h2>
        {aprobadas.length === 0 ? (
          <p className="text-sm opacity-60">No hay fotos aprobadas todavía.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {aprobadas.map(renderFoto)}
          </div>
        )}
      </section>
    </div>
  )
}