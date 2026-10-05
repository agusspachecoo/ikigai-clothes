import { useParams } from 'react-router-dom'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useProducto } from '../hooks/useProductos'
import { useSeo, urlAbsoluta } from '../hooks/useSeo'
import { useResenas } from '../hooks/useResenas'
import { useCart, type ItemNuevo } from '../context/cart'
import { useAuth } from '../context/auth'
import { imagenProducto } from '../lib/imagenes'
import { ConflictModal } from '../components/ConflictModal'
import type { Colision } from '../lib/conflictos'
import { EnvioCalculator } from '../components/EnvioCalculator'
import { RatingProducto } from '../components/RatingProducto'
import { FAQSection } from '../components/FAQSection'
import { ProductosRelacionados } from '../components/ProductosRelacionados'
import { BeneficiosSection } from '../components/BeneficiosSection'
import { comprimirImagen, blobToFile } from '../lib/imageCompression'
import { subirImagen } from '../lib/adminApi'
import { parseResenaImagenes } from '../types/database'
import { useCierreModal } from '../hooks/useCierreModal'
import { useTienda } from '../context/tienda'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { BotonCompartir } from '../components/BotonCompartir'
import { tallesDisponibles } from '../lib/talles'
import { slugify } from '../lib/categorias'
import { srcsetImagen } from '../lib/imagenes'
import {
  formatearPrecio,
  montoCuota,
  precioConDescuento,
  precioTransferencia,
} from '../lib/precios'

export function Producto() {
  const { id } = useParams<{ id: string }>()
  const { producto, loading, error } = useProducto(id ?? null)
  const { intentarAgregar, reemplazarConflictosYAgregar, setCarritoAbierto } = useCart()
  const { user, abrirAuthModal } = useAuth()
  const [imagenActiva, setImagenActiva] = useState(0)
  const [talleSeleccionado, setTalleSeleccionado] = useState<string | null>(null)
  const [conflictos, setConflictos] = useState<Colision[]>([])
  const [modalConflictoAbierto, setModalConflictoAbierto] = useState(false)
  const [fotoResena, setFotoResena] = useState<File | null>(null)
  const [vistaPreviaResena, setVistaPreviaResena] = useState<string | null>(null)
  const [subiendoResena, setSubiendoResena] = useState(false)
  const [errorResena, setErrorResena] = useState<string | null>(null)
  const [exitoResena, setExitoResena] = useState(false)
  const [lightboxResena, setLightboxResena] = useState<{ resenaId: string, url: string } | null>(null)
  const { descuento_transferencia, cuotas_sin_interes, umbral_envio_gratis, envio_gratis_activo } =
    useTienda()
  useCierreModal(Boolean(lightboxResena), () => setLightboxResena(null))

  // Al navegar entre productos (mismo componente, sin remount) hay que resetear
  // todo el estado local para no mostrar datos stale del producto anterior.
  const idProducto = id ?? null
   
  const estadoReseteadoId = useRef(idProducto)
  useEffect(() => {
    if (estadoReseteadoId.current !== idProducto) {
      estadoReseteadoId.current = idProducto
      setImagenActiva(0)
      setTalleSeleccionado(null)
      setFotoResena(null)
      setVistaPreviaResena(null)
      setSubiendoResena(false)
      setErrorResena(null)
      setExitoResena(false)
      setLightboxResena(null)
    }
  }, [idProducto])

  const { resenas, insertarResena } = useResenas(id ?? null)

  // La galería principal se renderiza a media pantalla en desktop.
  const srcsetGaleria = srcsetImagen(producto?.imagenes?.[imagenActiva], 600)

  // Metadatos por producto. El título y la descripción se calculan siempre
  // (también durante el loading) para que crawlers y previews no queden vacíos.
  const seo = useMemo(() => {
    if (!producto) return {}
    const precio = formatearPrecio(
      precioConDescuento(producto.precio, producto.discount_percent),
    )
    const descripcionBase = producto.descripcion?.trim()
    const descripcion =
      descripcionBase && descripcionBase.length > 40
        ? descripcionBase.slice(0, 155).trim() + '…'
        : `${producto.nombre} en Ikigai Clothes. ${producto.categoria} por ${precio}. Envíos a todo el país desde Oberá, Misiones.`
    return {
      title: `${producto.nombre} · ${producto.categoria} | Ikigai Clothes`,
      description: descripcion,
      image: urlAbsoluta(producto.imagenes?.[0]),
      type: 'product',
    }
  }, [producto])

  useSeo(seo)

  const [formResena, setFormResena] = useState({
    nombre_usuario: '',
    puntuacion: 5,
    comentario: '',
  })

  useEffect(() => {
    if (user && !formResena.nombre_usuario) {
      const nombreSugerido =
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        user.email?.split('@')[0] ??
        ''
      if (nombreSugerido) {
        // Prefill del nombre al iniciar sesión en plena navegación.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFormResena(f => ({ ...f, nombre_usuario: nombreSugerido }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

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
      </div>
    )
  }

  const precioOriginal = Number(producto.precio) || 0
  const descuento = Number(producto.discount_percent) || 0
  const precioOferta = precioConDescuento(precioOriginal, descuento)

  const talles = producto ? tallesDisponibles(producto.variaciones_stock) : []
  const sinStock = talles.length === 0 || talles.every((t) => t.stock === 0)
  const precioTransferenciaFinal = precioTransferencia(precioOferta, descuento_transferencia)
  const ahorroTransferencia = Math.max(0, precioOferta - precioTransferenciaFinal)

  const promedioResenas = resenas.length
    ? Math.round((resenas.reduce((s, r) => s + r.puntuacion, 0) / resenas.length) * 10) / 10
    : 0

  function prendaDelProducto(): ItemNuevo | null {
    if (!producto || !talleSeleccionado) return null
    return {
      producto_id: producto.id,
      nombre: producto.nombre,
      imagen: imagenProducto(producto.imagenes[0], 0),
      talle: talleSeleccionado,
      precio_unitario: precioOferta,
      origen: 'individual',
      outfitId: null,
      outfitNombre: null,
    }
  }

  function agregarAlCarrito() {
    const nueva = prendaDelProducto()
    if (!nueva) return
    // Stock unitario: si la prenda ya está (suelta o dentro de un look), no se
    // agrega nada hasta que el usuario confirme el reemplazo en el modal.
    const resultado = intentarAgregar(nueva)
    if (!resultado.ok) {
      setConflictos(resultado.colisiones)
      setModalConflictoAbierto(true)
      return
    }
    setCarritoAbierto(true)
  }

  function confirmarReemplazo() {
    const nueva = prendaDelProducto()
    if (nueva) reemplazarConflictosYAgregar(nueva, conflictos)
    setModalConflictoAbierto(false)
    setConflictos([])
    setCarritoAbierto(true)
  }

  async function handleSubmitResena(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return

    if (formResena.nombre_usuario.trim().length < 2) {
      setErrorResena('Escribí tu nombre para saber quién tukió.')
      return
    }
    if (formResena.comentario.trim().length < 5) {
      setErrorResena('Contanos un poco más: al menos unas pocas palabras.')
      return
    }

    setSubiendoResena(true)
    setErrorResena(null)
    setExitoResena(false)

    try {
      let imagenUrl: string | null = null
      if (fotoResena) {
        const { url, error } = await subirImagen(fotoResena, 'reviews')
        if (error || !url) throw new Error(error ?? 'No se pudo subir la imagen')
        imagenUrl = JSON.stringify([url])
      }

      const { ok, error } = await insertarResena({
        ...formResena,
        nombre_usuario: formResena.nombre_usuario.trim(),
        comentario: formResena.comentario.trim(),
        producto_id: id,
        imagen_url: imagenUrl,
      })

      if (!ok) {
        setErrorResena(error ?? 'No pudimos guardar tu reseña.')
        return
      }

      setFormResena({ nombre_usuario: '', puntuacion: 5, comentario: '' })
      setFotoResena(null)
      setVistaPreviaResena(null)
      setExitoResena(true)
    } catch (error) {
      // Sin este catch, un fallo al subir la fotoPromise quedaba rechazada sin
      // mostrar nada: el usuario apretaba Enviar y no pasaba nada.
      setErrorResena(
        error instanceof Error && error.message
          ? `No pudimos enviar tu reseña: ${error.message}`
          : 'No pudimos enviar tu reseña. Probá de nuevo.',
      )
    } finally {
      setSubiendoResena(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <Breadcrumbs
        items={[
          { label: 'Inicio', to: '/' },
          { label: 'Productos', to: '/catalogo' },
          { label: producto.categoria, to: `/catalogo?categoria=${slugify(producto.categoria)}` },
          { label: producto.nombre },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Galería */}
        <div>
          <figure className="relative w-full aspect-square md:aspect-[4/3] lg:aspect-[3/4] bg-neutral-100 rounded-xl overflow-hidden flex items-center justify-center">
            {producto.imagenes[imagenActiva] && (
              /* Esta es la imagen LCP de la página: eager + fetchpriority high
                 para que el navegador la empiece a bajar apenas parsea el HTML,
                 en vez de esperar a que entre en viewport. Las demás van lazy. */
              <img
                src={producto.imagenes[imagenActiva]}
                srcSet={srcsetGaleria.srcset}
                sizes={srcsetGaleria.sizes}
                alt={
                  imagenActiva === 0
                    ? `${producto.nombre} de ${producto.categoria}, vista frontal`
                    : `${producto.nombre}, foto ${imagenActiva + 1} de ${producto.imagenes.length}`
                }
                loading={imagenActiva === 0 ? 'eager' : 'lazy'}
                fetchPriority={imagenActiva === 0 ? 'high' : 'auto'}
                decoding={imagenActiva === 0 ? 'sync' : 'async'}
                width={600}
                height={800}
                className="w-full h-full object-contain p-2 md:p-4 select-none"
              />
            )}
          </figure>
          {producto.imagenes.length > 1 && (
            <div className="flex gap-2 mt-3">
              {producto.imagenes.map((img, i) => (
                <button
                  key={i}
                  aria-label={`Ver foto ${i + 1} de ${producto.nombre}`}
                  aria-current={i === imagenActiva}
                  className={`w-16 h-16 aspect-square bg-neutral-100 rounded-lg overflow-hidden flex items-center justify-center p-1 border ${
                    i === imagenActiva ? 'border-neutral' : 'border-line'
                  }`}
                  onClick={() => setImagenActiva(i)}
                >
                  <img
                    src={img}
                    srcSet={srcsetImagen(img, 128).srcset}
                    sizes={srcsetImagen(img, 128).sizes}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width={64}
                    height={64}
                    className="w-full h-full object-contain rounded"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detalles */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-display text-2xl md:text-3xl">{producto.nombre}</h1>
            <BotonCompartir titulo={producto.nombre} texto={`Mirá ${producto.nombre} en Ikigai Clothes`} />
          </div>

          <RatingProducto promedio={promedioResenas} cantidad={resenas.length} className="mt-2" />

          <p className="text-[11px] uppercase tracking-widest opacity-50 mt-3">
            {producto.categoria}
          </p>

          {/* Precio */}
          <div className="mt-5 space-y-1">
            {descuento > 0 && (
              <span className="inline-block bg-oferta text-white text-[10px] font-semibold uppercase tracking-widest px-2 py-1">
                -{descuento}% off
              </span>
            )}

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold">${formatearPrecio(precioOferta)}</span>
              {descuento > 0 && (
                <span className="text-sm opacity-50 line-through">
                  ${formatearPrecio(precioOriginal)}
                </span>
              )}
            </div>

            {descuento > 0 && (
              <p className="text-xs text-success">
                Ahorrás ${formatearPrecio(precioOriginal - precioOferta)}
              </p>
            )}

            {descuento_transferencia > 0 && (
              <div className="border border-success/40 bg-success/5 px-3 py-2 mt-3">
                <p className="text-sm font-semibold text-success">
                  Pagando por transferencia: ${formatearPrecio(precioTransferenciaFinal)}
                </p>
                {ahorroTransferencia > 0 && (
                  <p className="text-xs text-success/80">
                    Ahorrás ${formatearPrecio(ahorroTransferencia)} (
                    {Math.round(descuento_transferencia * 100)}% off)
                  </p>
                )}
              </div>
            )}

            {cuotas_sin_interes > 1 && (
              <p className="text-xs opacity-70">
                {cuotas_sin_interes} cuotas sin interés de $
                {formatearPrecio(montoCuota(precioOferta, cuotas_sin_interes))}
              </p>
            )}
          </div>

          {producto.descripcion && (
            <p className="mt-4 text-sm opacity-70 leading-relaxed">{producto.descripcion}</p>
          )}

          {/* Selector de talles */}
          {talles.length > 0 && (
            <div className="mt-6">
              <p className="text-xs uppercase tracking-widest mb-2">
                Talle
                {sinStock && (
                  <span className="ml-2 normal-case tracking-normal opacity-60">
                    · todos agotados
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {talles.map(({ talle: t, stock }) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={t === talleSeleccionado}
                    disabled={stock === 0}
                    onClick={() => setTalleSeleccionado(t)}
                    className={`min-w-12 h-10 px-4 border text-sm transition-colors ${
                      t === talleSeleccionado
                        ? 'bg-neutral text-neutral-content border-neutral'
                        : stock === 0
                          ? 'border-line opacity-40 line-through cursor-not-allowed'
                          : 'border-line hover:border-neutral'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Agregar al carrito */}
          <div className="mt-7">
            <button
              type="button"
              onClick={agregarAlCarrito}
              disabled={!talleSeleccionado || sinStock}
              className="btn btn-primary rounded-none w-full"
            >
              {sinStock
                ? 'Sin Stock'
                : talleSeleccionado
                  ? 'Agregar al carrito'
                  : 'Elegí un talle'}
            </button>
          </div>

          {/* Medios de pago y envío */}
          <ul className="mt-6 border-t border-line text-xs divide-y divide-line">
            <li className="flex items-center justify-between py-2.5">
              <span className="opacity-60">Medios de pago</span>
              <span>Mercado Pago · Transferencia</span>
            </li>
            <li className="flex items-center justify-between py-2.5">
              <span className="opacity-60">Envíos</span>
              <span>
                {envio_gratis_activo && umbral_envio_gratis > 0
                  ? `Gratis desde $${formatearPrecio(umbral_envio_gratis)}`
                  : 'A todo el país'}
              </span>
            </li>
            <li className="flex items-center justify-between py-2.5">
              <span className="opacity-60">Retiro</span>
              <span>Showroom sin cargo</span>
            </li>
          </ul>

          <div className="mt-6">
            <EnvioCalculator
              items={[
                {
                  producto_id: producto.id,
                  nombre: producto.nombre,
                  imagen: producto.imagenes[0] ?? '',
                  talle: talleSeleccionado ?? '',
                  precio_unitario: precioOferta,
                  cantidad: 1,
                },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Preguntas frecuentes */}
      <FAQSection />

      {/* Productos relacionados */}
      <ProductosRelacionados categoria={producto.categoria} productoId={producto.id} />

      {/* Reseñas */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold mb-6">Reseñas</h2>

        {/* Formulario de reseña */}
        {user ? (
          <form onSubmit={handleSubmitResena} className="card bg-base-100 shadow-sm p-6 mb-8">
          <h3 className="font-semibold mb-4">Dejá tu reseña</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              className="input input-bordered"
              placeholder="Tu nombre"
              value={formResena.nombre_usuario}
              onChange={(e) => {
                setFormResena(f => ({ ...f, nombre_usuario: e.target.value }))
                setErrorResena(null)
              }}
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
            onChange={(e) => {
              setFormResena(f => ({ ...f, comentario: e.target.value }))
              setErrorResena(null)
            }}
            required
          />

          {/* Foto opcional de la reseña */}
          <div className="mt-4">
            <span className="text-sm font-semibold">Sumá una foto (opcional)</span>
            <label className="mt-2 flex items-center justify-center w-full h-24 border-2 border-dashed border-base-300 rounded-xl cursor-pointer hover:border-primary transition-colors overflow-hidden relative">
              {vistaPreviaResena ? (
                <>
                  <img
                    src={vistaPreviaResena}
                    alt="Vista previa de la foto que vas a adjuntar a la reseña"
                    decoding="async"
                    className="w-full h-full object-contain rounded"
                  />
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

          {errorResena && (
            <div
              role="alert"
              className="alert alert-error mt-4 py-2 px-3 text-sm items-start"
            >
              <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span>{errorResena}</span>
            </div>
          )}

          {exitoResena && (
            <div role="status" className="alert alert-success mt-4 py-2 px-3 text-sm items-start">
              <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                ¡Gracias {formResena.nombre_usuario.trim().split(' ')[0] || 'por la reseña'}! Se publica
                apenas la aprobemos.
              </span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary mt-4 self-start px-6 py-3 rounded-xl cursor-pointer"
            disabled={subiendoResena}
            aria-busy={subiendoResena}
          >
            {subiendoResena ? 'Subiendo...' : 'Enviar Reseña'}
          </button>
        </form>
        ) : (
          <div className="card bg-base-100 shadow-sm p-6 mb-8 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-base-200 flex items-center justify-center mb-3">
              <svg className="h-6 w-6 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <p className="font-semibold mb-1">Dejá tu reseña</p>
            <p className="text-sm opacity-70 max-w-sm mx-auto mb-4">
              Iniciá sesión para dejar tu reseña sobre este producto.
            </p>
            <button
              type="button"
              className="btn btn-primary mx-auto px-6 py-3 rounded-xl cursor-pointer"
              onClick={() => abrirAuthModal()}
            >
              Iniciar sesión
            </button>
          </div>
        )}

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
                          <img
                            src={foto}
                            srcSet={srcsetImagen(foto, 80).srcset}
                            sizes={srcsetImagen(foto, 80).sizes}
                            alt={`Foto de la reseña de ${r.nombre_usuario}`}
                            loading="lazy"
                            decoding="async"
                            width={80}
                            height={80}
                            className="w-full h-full object-contain rounded"
                          />
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

      {/* Beneficios (antes del footer) */}
      <BeneficiosSection />

      {/* Lightbox de reseña */}
      {lightboxResena && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxResena(null)}
        >
          <img
            src={lightboxResena.url}
            srcSet={srcsetImagen(lightboxResena.url, 800).srcset}
            sizes="(max-width: 1024px) 100vw, 800px"
            alt="Foto de la reseña ampliada"
            decoding="async"
            className="max-w-full max-h-[90vh] rounded-lg object-contain"
          />
        </div>
      )}

      {/* Colisión de stock unitario */}
      {modalConflictoAbierto && (
        <ConflictModal
          abierto={modalConflictoAbierto}
          conflictos={conflictos}
          accionSolicitada="agregar_individual"
          onConfirmar={confirmarReemplazo}
          onCancelar={() => {
            setModalConflictoAbierto(false)
            setConflictos([])
          }}
        />
      )}
    </div>
  )
}
