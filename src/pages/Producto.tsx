import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { useProducto } from '../hooks/useProductos'
import { useResenas } from '../hooks/useResenas'
import { useCart } from '../context/cart'
import { imagenProducto } from '../lib/imagenes'
import { comprimirImagen, blobToFile } from '../lib/imageCompression'
import { subirImagen } from '../lib/adminApi'
import { parseResenaImagenes } from '../types/database'
import type { VariacionStock } from '../types/database'

export function Producto() {
  const { id } = useParams<{ id: string }>()
  const { producto, loading, error } = useProducto(id ?? null)
  const { agregarItem, setCarritoAbierto } = useCart()
  const [imagenActiva, setImagenActiva] = useState(0)
  const [talleSeleccionado, setTalleSeleccionado] = useState<string | null>(null)
  const [fotoResena, setFotoResena] = useState<File | null>(null)
  const [vistaPreviaResena, setVistaPreviaResena] = useState<string | null>(null)
  const [subiendoResena, setSubiendoResena] = useState(false)
  const [lightboxResena, setLightboxResena] = useState<{ resenaId: string, url: string } | null>(null)

  const { resenas, insertarResena } = useResenas(id ?? null)

  const [formResena, setFormResena] = useState({
    nombre_usuario: '',
    puntuacion: 5,
    comentario: '',
  })

  async function handleFotoResena(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const blob = await comprimirImagen(file, { maxWidth: 1200, quality: 0.8 })
    const comprimido = blobToFile(blob, file.name)
    setFotoResena(comprimido)
    setVistaPreviaResena(URL.createObjectURL(comprimido))
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="skeleton h-96 w-full rounded-lg mb-4"></div>
        <div className="skeleton h-8 w-1/3 mb-2"></div>
        <div className="skeleton h-6 w-1/4"></div>
      </div>
    )
  }

  if (error || !producto) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <p className="text-error">{error ?? 'Producto no encontrado'}</p>
        <Link to="/catalogo" className="btn btn-primary mt-4">Volver al catálogo</Link>
      </div>
    )
  }

  const getStock = (variaciones: VariacionStock[], talle: string) =>
    variaciones.find(v => v.talle === talle)?.stock_disponible ?? 0

  const talles = producto
    ? [...new Set(producto.variaciones_stock.map(v => v.talle))]
    : []

  function agregarAlCarrito() {
    if (!producto || !talleSeleccionado) return
    agregarItem({
      producto_id: producto.id,
      nombre: producto.nombre,
      imagen: imagenProducto(producto.imagenes[0], 0),
      talle: talleSeleccionado,
      precio_unitario: producto.precio,
    })
    setCarritoAbierto(true)
  }

  async function handleSubmitResena(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return

    setSubiendoResena(true)
    try {
      let imagenUrl: string | null = null
      if (fotoResena) {
        const { url, error } = await subirImagen(fotoResena, 'reviews')
        if (error || !url) throw new Error(error ?? 'No se pudo subir la imagen')
        imagenUrl = JSON.stringify([url])
      }

      const ok = await insertarResena({ ...formResena, producto_id: id, imagen_url: imagenUrl })
      if (ok) {
        setFormResena({ nombre_usuario: '', puntuacion: 5, comentario: '' })
        setFotoResena(null)
        setVistaPreviaResena(null)
      }
    } finally {
      setSubiendoResena(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Galería */}
        <div>
          <figure className="aspect-[3/4] bg-base-300 rounded-lg overflow-hidden">
            {producto.imagenes[imagenActiva] && (
              <img
                src={producto.imagenes[imagenActiva]}
                alt={producto.nombre}
                className="w-full h-full object-cover"
              />
            )}
          </figure>
          {producto.imagenes.length > 1 && (
            <div className="flex gap-2 mt-3">
              {producto.imagenes.map((img, i) => (
                <button
                  key={i}
                  className={`w-16 h-16 rounded border-2 overflow-hidden ${i === imagenActiva ? 'border-primary' : 'border-transparent'}`}
                  onClick={() => setImagenActiva(i)}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detalles */}
        <div>
          <h1 className="text-3xl font-bold">{producto.nombre}</h1>
          <span className="badge badge-outline mt-2">{producto.categoria}</span>

          <div className="mt-6">
            <p className="text-3xl font-bold text-primary">
              ${producto.precio.toLocaleString('es-AR')}
            </p>
          </div>

          {producto.descripcion && (
            <p className="mt-4 opacity-70">{producto.descripcion}</p>
          )}

          {/* Selector de talles */}
          {talles.length > 0 && (
            <div className="mt-6">
              <p className="font-semibold mb-2">Talle</p>
              <div className="flex flex-wrap gap-2">
                {talles.map((t) => {
                  const stock = getStock(producto.variaciones_stock, t)
                  return (
                    <button
                      key={t}
                      className={`btn btn-sm min-w-14 px-5 border-2 rounded-xl font-semibold ${
                        t === talleSeleccionado
                          ? 'btn-primary border-transparent'
                          : 'bg-base-100 border-base-300 hover:border-primary hover:text-primary'
                      } ${
                        stock === 0
                          ? 'opacity-30 cursor-not-allowed pointer-events-none'
                          : 'cursor-pointer'
                      }`}
                      disabled={stock === 0}
                      onClick={() => setTalleSeleccionado(t)}
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Agregar al carrito */}
          <button
            className="btn w-full bg-black text-white hover:bg-neutral-800 border-0 rounded-xl font-bold text-base mt-8 cursor-pointer transition-colors"
            disabled={!talleSeleccionado}
            onClick={agregarAlCarrito}
          >
            Agregar al Carrito
          </button>
          <p className="text-xs opacity-60 mt-3 text-center">
            🚚 Envíos a todo el país | Retiro sin cargo
          </p>
        </div>
      </div>

      {/* Reseñas */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold mb-6">Reseñas</h2>

        {/* Formulario de reseña */}
        <form onSubmit={handleSubmitResena} className="card bg-base-100 shadow-sm p-6 mb-8">
          <h3 className="font-semibold mb-4">Dejá tu reseña</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              className="input input-bordered"
              placeholder="Tu nombre"
              value={formResena.nombre_usuario}
              onChange={(e) => setFormResena(f => ({ ...f, nombre_usuario: e.target.value }))}
              required
            />
            <div className="flex flex-col items-start gap-2">
              <span className="text-sm font-semibold">Puntuación</span>
              <div className="rating gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <input
                    key={n}
                    type="radio"
                    name="rating"
                    className="mask mask-star-2 bg-warning"
                    checked={formResena.puntuacion === n}
                    onChange={() => setFormResena(f => ({ ...f, puntuacion: n }))}
                  />
                ))}
              </div>
            </div>
          </div>
          <textarea
            className="textarea textarea-bordered mt-4"
            placeholder="Tu comentario..."
            rows={3}
            value={formResena.comentario}
            onChange={(e) => setFormResena(f => ({ ...f, comentario: e.target.value }))}
            required
          />

          {/* Foto opcional de la reseña */}
          <div className="mt-4">
            <span className="text-sm font-semibold">Sumá una foto (opcional)</span>
            <label className="mt-2 flex items-center justify-center w-full h-24 border-2 border-dashed border-base-300 rounded-xl cursor-pointer hover:border-primary transition-colors overflow-hidden relative">
              {vistaPreviaResena ? (
                <>
                  <img src={vistaPreviaResena} alt="Vista previa" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setFotoResena(null); setVistaPreviaResena(null) }}
                    className="absolute top-1 right-1 btn btn-circle btn-xs text-white"
                    aria-label="Quitar foto"
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
                  Subir foto
                </span>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFotoResena}
              />
            </label>
          </div>

          <button
            type="submit"
            className="btn btn-primary mt-4 self-start px-6 py-3 rounded-xl cursor-pointer"
            disabled={subiendoResena}
          >
            {subiendoResena ? 'Subiendo...' : 'Enviar Reseña'}
          </button>
        </form>

        {/* Lista de reseñas */}
        {resenas.length === 0 ? (
          <p className="opacity-60">No hay reseñas todavía. Sé el primero en comentar.</p>
        ) : (
          <div className="space-y-4">
            {resenas.map((r) => {
              const fotos = parseResenaImagenes(r.imagen_url)
              return (
                <div key={r.id} className="card bg-base-100 shadow-sm p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{r.nombre_usuario}</span>
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
                  <p className="mt-2 text-sm">{r.comentario}</p>
                  {fotos.length > 0 && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {fotos.map((foto, i) => (
                        <button
                          key={i}
                          className="w-20 h-20 rounded-lg overflow-hidden cursor-pointer border border-base-300"
                          onClick={() => setLightboxResena({ resenaId: r.id, url: foto })}
                          aria-label="Ver foto de la reseña"
                        >
                          <img src={foto} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Lightbox de reseña */}
      {lightboxResena && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxResena(null)}
        >
          <button
            className="absolute top-4 right-4 btn btn-circle btn-ghost text-white"
            onClick={() => setLightboxResena(null)}
            aria-label="Cerrar"
          >
            ✕
          </button>
          <img
            src={lightboxResena.url}
            alt="Foto de la reseña"
            className="max-w-full max-h-[90vh] rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  )
}
