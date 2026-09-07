import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { getProductosAdmin, guardarProducto, eliminarProducto, setProductoActivo, getCategoriasAdmin, subirImagen } from '../../lib/adminApi'
import { comprimirImagen, blobToFile } from '../../lib/imageCompression'
import { imagenProducto } from '../../lib/imagenes'
import { CATEGORIAS_FALLBACK } from '../../lib/categorias'
import type { ProductoConStock } from '../../types/database'

const TALLES_SUGERIDOS = ['S', 'M', 'L', 'XL', 'XXL']

interface TalleRow {
  talle: string
  stock_disponible: string
}

interface FormState {
  id?: string
  nombre: string
  categoria: string
  precio: string
  precio_transferencia: string
  descripcion: string
  imagenes: string[]
  activo: boolean
  talles: TalleRow[]
}

function crearForm(producto: ProductoConStock | null): FormState {
  if (!producto) {
    return {
      nombre: '',
      categoria: '',
      precio: '',
      precio_transferencia: '',
      descripcion: '',
      imagenes: [''],
      activo: true,
      talles: ['S', 'M', 'L', 'XL'].map((t) => ({ talle: t, stock_disponible: '0' })),
    }
  }

  return {
    id: producto.id,
    nombre: producto.nombre,
    categoria: producto.categoria,
    precio: String(producto.precio),
    precio_transferencia: producto.precio_transferencia ? String(producto.precio_transferencia) : '',
    descripcion: producto.descripcion ?? '',
    imagenes: producto.imagenes.length > 0 ? [...producto.imagenes] : [''],
    activo: producto.activo,
    talles: producto.variaciones_stock.map((v) => ({
      talle: v.talle,
      stock_disponible: String(v.stock_disponible),
    })),
  }
}

export function ProductosAdmin() {
  const [productos, setProductos] = useState<ProductoConStock[]>([])
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS_FALLBACK)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [recarga, setRecarga] = useState(0)
  const [notificacion, setNotificacion] = useState<string | null>(null)
  const [modoModal, setModoModal] = useState<{ abierto: boolean; producto: ProductoConStock | null }>({
    abierto: false,
    producto: null,
  })

  useEffect(() => {
    let activo = true

    async function cargar() {
      setLoading(true)
      const [p, c] = await Promise.all([getProductosAdmin(), getCategoriasAdmin()])
      if (activo) {
        setProductos(p.data)
        setCategorias(c.data.length > 0 ? c.data.map((cat) => cat.nombre) : CATEGORIAS_FALLBACK)
        setError(p.error ?? c.error)
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

  const filtrados = productos.filter(
    (p) =>
      (!categoria || p.categoria === categoria) &&
      (!busqueda ||
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.categoria.toLowerCase().includes(busqueda.toLowerCase())),
  )

  async function handleEliminar(p: ProductoConStock) {
    if (!window.confirm(`¿Eliminar definitivamente "${p.nombre}"?`)) return
    const { error: err } = await eliminarProducto(p.id)
    if (err) setNotificacion(`Error: ${err}`)
    else setNotificacion('Producto eliminado')
    setRecarga((n) => n + 1)
  }

  async function handleToggleActivo(p: ProductoConStock) {
    const { error: err } = await setProductoActivo(p.id, !p.activo)
    if (err) setNotificacion(`Error: ${err}`)
    else setNotificacion(p.activo ? 'Producto desactivado' : 'Producto activado')
    setRecarga((n) => n + 1)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Productos</h1>
        <button
          className="btn btn-primary"
          onClick={() => setModoModal({ abierto: true, producto: null })}
        >
          Nuevo producto
        </button>
      </div>

      {notificacion && (
        <div className="alert alert-success text-sm mb-4 shadow-sm">{notificacion}</div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="input input-bordered flex items-center gap-2">
          <svg className="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            className="grow"
            placeholder="Buscar por nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>
        <select
          className="select select-bordered"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <Link to="/admin/categorias" className="text-sm link link-hover">
          Gestionar categorías
        </Link>
        <span className="text-sm opacity-60">{filtrados.length} productos</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-20 w-full rounded-lg"></div>
          ))}
        </div>
      ) : error ? (
        <div className="alert alert-error text-sm">{error}</div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 opacity-60">No hay productos</div>
      ) : (
        <div className="card bg-base-100 shadow-sm">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>Talles</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p, i) => {
                  const stockTotal = p.variaciones_stock.reduce((n, v) => n + v.stock_disponible, 0)
                  return (
                    <tr key={p.id} className={p.activo ? '' : 'opacity-50'}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="avatar">
                            <div className="w-10 h-12 rounded-lg bg-base-300">
                              <img src={imagenProducto(p.imagenes[0], i)} alt="" />
                            </div>
                          </div>
                          <span className="font-medium">{p.nombre}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-outline">{p.categoria}</span>
                      </td>
                      <td className="font-semibold">${Number(p.precio).toLocaleString('es-AR')}</td>
                      <td>
                        <span className="text-sm">
                          {p.variaciones_stock.length} talles · {stockTotal} uds
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${p.activo ? 'badge-success' : 'badge-neutral'}`}>
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button
                          className="btn btn-xs btn-ghost"
                          onClick={() => setModoModal({ abierto: true, producto: p })}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-xs btn-ghost"
                          onClick={() => handleToggleActivo(p)}
                        >
                          {p.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          className="btn btn-xs btn-ghost text-error"
                          onClick={() => handleEliminar(p)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modoModal.abierto && (
        <ProductoFormModal
          producto={modoModal.producto}
          categorias={categorias}
          onCerrar={() => setModoModal({ abierto: false, producto: null })}
          onGuardado={(mensaje) => {
            setModoModal({ abierto: false, producto: null })
            setNotificacion(mensaje)
            setRecarga((n) => n + 1)
          }}
        />
      )}
    </div>
  )
}

interface FormProps {
  producto: ProductoConStock | null
  categorias: string[]
  onCerrar: () => void
  onGuardado: (mensaje: string) => void
}

function ProductoFormModal({ producto, categorias, onCerrar, onGuardado }: FormProps) {
  const [form, setForm] = useState<FormState>(() => crearForm(producto))
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState<number | null>(null)

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function addImagen() {
    setField('imagenes', [...form.imagenes, ''])
  }

  function setImagen(i: number, value: string) {
    const imagenes = [...form.imagenes]
    imagenes[i] = value
    setField('imagenes', imagenes)
  }

  function removeImagen(i: number) {
    setField('imagenes', form.imagenes.filter((_, idx) => idx !== i))
  }

  async function handleFile(i: number, file: File | null) {
    if (!file) return
    setSubiendo(i)
    setErrorMsg(null)
    try {
      const blob = await comprimirImagen(file)
      const archivo = blobToFile(blob, file.name)
      const { url, error } = await subirImagen(archivo, 'productos')
      if (error) throw new Error(error)
      if (url) setImagen(i, url)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al subir la imagen')
    } finally {
      setSubiendo(null)
    }
  }

  function addTalleSugerido(t: string) {
    if (form.talles.some((r) => r.talle.trim() === t)) return
    setField('talles', [...form.talles, { talle: t, stock_disponible: '0' }])
  }

  function setTalle(i: number, campo: keyof TalleRow, value: string) {
    const talles = [...form.talles]
    talles[i] = { ...talles[i], [campo]: value }
    setField('talles', talles)
  }

  function removeTalle(i: number) {
    setField('talles', form.talles.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)

    const precio = Number(form.precio)
    if (!form.nombre.trim() || !form.precio || precio <= 0) {
      setErrorMsg('El nombre y un precio válido son obligatorios.')
      return
    }

    setGuardando(true)
    const res = await guardarProducto({
      id: form.id,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion || null,
      categoria: form.categoria.trim() || 'Otros',
      precio,
      precio_transferencia: form.precio_transferencia ? Number(form.precio_transferencia) : null,
      imagenes: form.imagenes,
      activo: form.activo,
      talles: form.talles.map((t) => ({
        talle: t.talle,
        stock_disponible: Number(t.stock_disponible) || 0,
      })),
    })
    setGuardando(false)

    if (res.error) {
      setErrorMsg(res.error)
      return
    }

    onGuardado(form.id ? 'Producto actualizado' : 'Producto creado')
  }

  return (
    <dialog className="modal modal-open" onClose={onCerrar}>
      <div className="modal-box max-w-3xl p-0 overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between p-5 border-b border-base-300">
          <h2 className="text-lg font-bold text-gray-900">
            {producto ? 'Editar producto' : 'Nuevo producto'}
          </h2>
          <button onClick={onCerrar} className="btn btn-ghost btn-circle btn-sm" aria-label="Cerrar">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="floating-label">
              <span>Nombre</span>
              <input
                type="text"
                className="input input-bordered w-full"
                value={form.nombre}
                onChange={(e) => setField('nombre', e.target.value)}
                required
              />
            </label>

            <label className="floating-label">
              <span>Categoría</span>
              <input
                type="text"
                list="categorias"
                className="input input-bordered w-full"
                value={form.categoria}
                onChange={(e) => setField('categoria', e.target.value)}
                placeholder="Ej: Remeras"
                required
              />
              <datalist id="categorias">
                {categorias.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>

            <label className="floating-label">
              <span>Precio ($)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input input-bordered w-full"
                value={form.precio}
                onChange={(e) => setField('precio', e.target.value)}
                required
              />
            </label>

            <label className="floating-label">
              <span>Precio transferencia ($, opcional)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input input-bordered w-full"
                value={form.precio_transferencia}
                onChange={(e) => setField('precio_transferencia', e.target.value)}
              />
            </label>
          </div>

          <label className="floating-label">
            <span>Descripción</span>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={2}
              value={form.descripcion}
              onChange={(e) => setField('descripcion', e.target.value)}
            />
          </label>

          {/* Imágenes */}
          <div>
            <p className="font-semibold text-sm mb-2 text-gray-900">Imágenes (frente, dorso, detalles)</p>
            <div className="space-y-2">
              {form.imagenes.map((img, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-12 h-14 bg-base-300 rounded-lg overflow-hidden shrink-0">
                    {img && <img src={img} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <input
                    type="url"
                    className="input input-bordered flex-1 input-sm"
                    placeholder="https://... (URL de la imagen)"
                    value={img}
                    onChange={(e) => setImagen(i, e.target.value)}
                  />
                  {subiendo === i && (
                    <span className="loading loading-spinner loading-sm text-primary shrink-0" />
                  )}
                  <label className="btn btn-outline btn-sm shrink-0">
                    {subiendo === i ? 'Subiendo…' : 'Subir'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={subiendo !== null}
                      onChange={(e) => handleFile(i, e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {form.imagenes.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-error shrink-0"
                      onClick={() => removeImagen(i)}
                    >
                      Quitar
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-outline btn-sm mt-2" onClick={addImagen}>
              Agregar imagen
            </button>
          </div>

          {/* Stock por talle */}
          <div>
            <p className="font-semibold text-sm mb-2 text-gray-900">Stock por talle</p>
            <div className="space-y-2">
              {form.talles.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    className="input input-bordered input-sm w-24"
                    placeholder="Talle"
                    value={t.talle}
                    onChange={(e) => setTalle(i, 'talle', e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    className="input input-bordered input-sm w-32"
                    placeholder="Stock"
                    value={t.stock_disponible}
                    onChange={(e) => setTalle(i, 'stock_disponible', e.target.value)}
                  />
                  {form.talles.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-error"
                      onClick={() => removeTalle(i)}
                    >
                      Quitar
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {TALLES_SUGERIDOS.filter(
                (t) => !form.talles.some((r) => r.talle.trim() === t),
              ).map((t) => (
                <button
                  key={t}
                  type="button"
                  className="btn btn-xs btn-outline"
                  onClick={() => addTalleSugerido(t)}
                >
                  + {t}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={form.activo}
              onChange={(e) => setField('activo', e.target.checked)}
            />
            <span className="text-sm font-medium text-gray-900">Visible en el catálogo</span>
          </label>

          {errorMsg && <div className="alert alert-error text-sm">{errorMsg}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={guardando}>
              {guardando ? <span className="loading loading-spinner loading-sm" /> : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  )
}