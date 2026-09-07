import { useState, useEffect } from 'react'
import {
  getComunidadFotosAdmin,
  eliminarComunidadFoto,
  setComunidadFotoAprobada,
  insertarComunidadFoto,
  subirImagen,
} from '../../lib/adminApi'
import { comprimirImagen, blobToFile } from '../../lib/imageCompression'
import type { ComunidadFoto } from '../../types/database'

export function CommunityAdmin() {
  const [fotos, setFotos] = useState<ComunidadFoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [notificacion, setNotificacion] = useState<string | null>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null)
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [instagram, setInstagram] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [errorSubir, setErrorSubir] = useState<string | null>(null)

  useEffect(() => {
    let activo = true

    async function cargar() {
      setLoading(true)
      const res = await getComunidadFotosAdmin()
      if (activo) {
        setFotos(res.data)
        setError(res.error)
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

  async function handleArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErrorSubir(null)
    const blob = await comprimirImagen(file, { maxWidth: 1200, quality: 0.8 })
    const comprimido = blobToFile(blob, file.name)
    setArchivo(comprimido)
    setVistaPrevia(URL.createObjectURL(comprimido))
  }

  async function handleSubir(e: React.FormEvent) {
    e.preventDefault()
    setErrorSubir(null)
    if (!archivo) {
      setErrorSubir('Elegí una imagen primero.')
      return
    }
    if (!nombreUsuario.trim()) {
      setErrorSubir('Ingresá el nombre de usuario de la foto.')
      return
    }

    setSubiendo(true)
    try {
      const { url, error: errSubida } = await subirImagen(archivo, 'comunidad')
      if (errSubida || !url) throw new Error(errSubida ?? 'No se pudo subir la imagen')

      const { error: errInsert } = await insertarComunidadFoto({
        nombre_usuario: nombreUsuario.trim(),
        imagen_url: url,
        instagram_handle: instagram.trim() ? instagram.trim().replace(/^@/, '') : null,
      })

      if (errInsert) throw new Error(errInsert)

      setArchivo(null)
      setVistaPrevia(null)
      setNombreUsuario('')
      setInstagram('')
      setNotificacion('Foto subida y publicada')
      setRecarga((n) => n + 1)
    } catch (err) {
      setErrorSubir(err instanceof Error ? err.message : 'Error al subir la foto')
    } finally {
      setSubiendo(false)
    }
  }

  async function handleEliminar(f: ComunidadFoto) {
    if (!window.confirm(`¿Eliminar la foto de ${f.nombre_usuario}?`)) return
    const { error: err } = await eliminarComunidadFoto(f.id)
    if (err) setNotificacion(`Error: ${err}`)
    else setNotificacion('Foto eliminada')
    setRecarga((n) => n + 1)
  }

  async function handleToggleAprobacion(f: ComunidadFoto) {
    const { error: err } = await setComunidadFotoAprobada(f.id, !f.aprobado)
    if (err) setNotificacion(`Error: ${err}`)
    else setNotificacion(f.aprobado ? 'Foto oculta de la tienda' : 'Foto visible en la tienda')
    setRecarga((n) => n + 1)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Comunidad</h1>
      </div>

      {notificacion && (
        <div className="alert alert-success text-sm mb-4 shadow-sm">{notificacion}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario de subida */}
        <form onSubmit={handleSubir} className="lg:col-span-1 card bg-base-100 shadow-sm p-5 h-fit space-y-4">
          <h2 className="font-bold">Subir foto</h2>

          <div>
            <label className="flex items-center justify-center w-full h-44 border-2 border-dashed border-base-300 rounded-xl cursor-pointer hover:border-primary transition-colors overflow-hidden relative">
              {vistaPrevia ? (
                <>
                  <img src={vistaPrevia} alt="Vista previa" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setArchivo(null); setVistaPrevia(null) }}
                    className="absolute top-1 right-1 btn btn-circle btn-xs text-white"
                    aria-label="Quitar imagen"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <span className="text-sm opacity-60 flex flex-col items-center gap-1">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                  Elegir imagen
                </span>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleArchivo}
              />
            </label>
          </div>

          <label className="form-control">
            <span className="label-text text-sm mb-1">Nombre de usuario</span>
            <input
              type="text"
              className="input input-bordered"
              placeholder="Ej: @lucas.fit"
              value={nombreUsuario}
              onChange={(e) => setNombreUsuario(e.target.value)}
            />
          </label>

          <label className="form-control">
            <span className="label-text text-sm mb-1">Instagram (opcional)</span>
            <input
              type="text"
              className="input input-bordered"
              placeholder="Ej: lucas.fit"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
            />
          </label>

          {errorSubir && <div className="alert alert-error text-sm">{errorSubir}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={subiendo}>
            {subiendo ? <span className="loading loading-spinner loading-sm" /> : 'Subir foto'}
          </button>
        </form>

        {/* Grid de fotos */}
        <div className="lg:col-span-2 card bg-base-100 shadow-sm p-5">
          <h2 className="font-bold mb-4">Fotos cargadas ({fotos.length})</h2>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton aspect-square w-full rounded-lg"></div>
              ))}
            </div>
          ) : error ? (
            <div className="alert alert-error text-sm">{error}</div>
          ) : fotos.length === 0 ? (
            <p className="text-sm opacity-60 py-10 text-center">Todavía no hay fotos cargadas.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {fotos.map((f) => (
                <div
                  key={f.id}
                  className={`card bg-base-100 shadow-sm overflow-hidden border ${f.aprobado ? 'border-base-200' : 'border-warning'}`}
                >
                  <figure className="aspect-[3/4] bg-base-300 overflow-hidden">
                    <img src={f.imagen_url} alt="" className="w-full h-full object-cover" />
                  </figure>
                  <div className="card-body p-3">
                    <p className="text-sm font-medium truncate">{f.nombre_usuario}</p>
                    {f.instagram_handle && (
                      <p className="text-xs opacity-50 truncate">@{f.instagram_handle}</p>
                    )}
                    <div className="flex gap-1.5 mt-1">
                      <button
                        className={`btn btn-xs ${f.aprobado ? 'btn-outline' : 'btn-primary'}`}
                        onClick={() => handleToggleAprobacion(f)}
                      >
                        {f.aprobado ? 'Ocultar' : 'Publicar'}
                      </button>
                      <button
                        className="btn btn-xs btn-ghost text-error"
                        onClick={() => handleEliminar(f)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
