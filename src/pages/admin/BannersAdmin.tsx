import { useState, useEffect } from 'react'
import { getBannersAdmin, guardarBanners } from '../../lib/adminApi'
import { ImageUploader } from '../../components/ImageUploader'
import type { BannerInput } from '../../lib/adminApi'

const TAMANIO_INICIAL = 4

export function BannersAdmin() {
  const [banners, setBanners] = useState<BannerInput[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notificacion, setNotificacion] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)

  useEffect(() => {
    let activo = true

    async function cargar() {
      setLoading(true)
      const res = await getBannersAdmin()
      if (activo) {
        if (res.error) {
          setError(res.error)
          setBanners([])
        } else {
          const existentes = res.data.map((b) => ({
            imagen_url: b.imagen_url,
            titulo: b.titulo,
            link_url: b.link_url,
          }))
          while (existentes.length < TAMANIO_INICIAL) existentes.push({ imagen_url: '', titulo: '', link_url: '' })
          setBanners(existentes)
        }
        setLoading(false)
      }
    }

    cargar()
    return () => { activo = false }
  }, [])

  useEffect(() => {
    if (!notificacion) return
    const t = window.setTimeout(() => setNotificacion(null), 3000)
    return () => window.clearTimeout(t)
  }, [notificacion])

  function setBanner(index: number, campo: keyof BannerInput, valor: string) {
    setBanners((prev) => prev.map((b, i) => (i === index ? { ...b, [campo]: valor } : b)))
  }

  function agregarFila() {
    setBanners((prev) => [...prev, { imagen_url: '', titulo: '', link_url: '' }])
  }

  function quitarFila(index: number) {
    setBanners((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    setErrorGuardar(null)
    const conImagen = banners.filter((b) => b.imagen_url.trim() !== '')
    setGuardando(true)
    const { error: err } = await guardarBanners(banners)
    setGuardando(false)
    if (err) {
      setErrorGuardar(err)
      return
    }
    setNotificacion(
      conImagen.length > 0
        ? 'Banners guardados correctamente'
        : 'No hay banners configurados, se usarán las imágenes por defecto'
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Banners del Carrusel</h1>
          <p className="text-sm opacity-60 mt-1">
            Imágenes del banner principal de la portada. Si dejás la lista vacía, la tienda usa 4
            imágenes por defecto.
          </p>
        </div>
      </div>

      {notificacion && (
        <div className="alert alert-success text-sm mb-4 shadow-sm">{notificacion}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton h-24 w-full rounded-lg"></div>
          ))}
        </div>
      ) : error ? (
        <div className="alert alert-error text-sm">
          {error}
          <p className="mt-1 text-xs">
            Ejecutá la migración <span className="font-mono">009_banners.sql</span> en Supabase para
            crear la tabla de banners.
          </p>
        </div>
      ) : (
        <form onSubmit={handleGuardar} className="space-y-4">
          {banners.map((banner, i) => (
            <div key={i} className="card bg-base-100 shadow-sm p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="font-bold text-sm">
                  Slide {i + 1}
                  {banner.imagen_url.trim() && (
                    <span className="badge badge-success badge-sm ml-2">Activo</span>
                  )}
                </h2>
                <button
                  type="button"
                  onClick={() => quitarFila(i)}
                  className="btn btn-xs btn-ghost text-error"
                >
                  Quitar
                </button>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                {/* Imagen del slide */}
                <div className="w-full md:w-80 shrink-0">
                  <ImageUploader
                    carpeta="productos"
                    imagenActual={banner.imagen_url}
                    onUrl={(url) => setBanner(i, 'imagen_url', url)}
                    proporcion="apaisado"
                    altoMinimo="h-36"
                    texto="Elegí o arrastrá la imagen del slide"
                  />
                </div>

                <div className="flex-1 space-y-3">
                  <label className="form-control">
                    <span className="label-text text-sm mb-1">Título (opcional)</span>
                    <input
                      type="text"
                      className="input input-bordered"
                      placeholder="Ej: Nueva temporada"
                      value={banner.titulo ?? ''}
                      onChange={(e) => setBanner(i, 'titulo', e.target.value)}
                    />
                  </label>

                  <label className="form-control">
                    <span className="label-text text-sm mb-1">Enlace (opcional)</span>
                    <input
                      type="text"
                      className="input input-bordered"
                      placeholder="/catalogo, /outfits o una URL externa"
                      value={banner.link_url ?? ''}
                      onChange={(e) => setBanner(i, 'link_url', e.target.value)}
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={agregarFila} className="btn btn-outline">
              Agregar slide
            </button>
            <button type="submit" className="btn btn-primary" disabled={guardando}>
              {guardando ? <span className="loading loading-spinner loading-sm" /> : 'Guardar banners'}
            </button>
          </div>

          {errorGuardar && (
            <div className="alert alert-error text-sm shadow-sm">{errorGuardar}</div>
          )}
        </form>
      )}
    </div>
  )
}