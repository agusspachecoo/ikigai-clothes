import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { getProductosAdmin, eliminarProducto, setProductoActivo, getCategoriasAdmin, getTallesAdmin } from '../../lib/adminApi'
import { ProductoFormModal } from '../../components/ProductoFormModal'
import { imagenProducto } from '../../lib/imagenes'
import { CATEGORIAS_FALLBACK } from '../../lib/categorias'
import type { ProductoConStock } from '../../types/database'

const TALLES_FALLBACK = ['S', 'M', 'L', 'XL', 'XXL', '38', '40', '42', '44', '46', '48']

export function ProductosAdmin() {
  const [productos, setProductos] = useState<ProductoConStock[]>([])
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS_FALLBACK)
  const [tallesSugeridos, setTallesSugeridos] = useState<string[]>(TALLES_FALLBACK)
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
      const [p, c, t] = await Promise.all([
        getProductosAdmin(),
        getCategoriasAdmin(),
        getTallesAdmin(),
      ])
      if (activo) {
        setProductos(p.data)
        setCategorias(c.data.length > 0 ? c.data.map((cat) => cat.nombre) : CATEGORIAS_FALLBACK)
        if (t.data.length > 0) {
          setTallesSugeridos(t.data.filter((x) => x.activo).map((x) => x.nombre))
        }
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

  // La búsqueda cubre nombre, SKU y categoría. El SKU va primero porque es lo
// que se tipea cuando se busca por código interno.
  const filtrados = productos.filter(
    (p) =>
      (!categoria || p.categoria === categoria) &&
      (!busqueda ||
        (p.sku ?? '').toLowerCase().includes(busqueda.toLowerCase()) ||
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
        <Link to="/admin/talles" className="text-sm link link-hover">
          Gestionar talles
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
                              <img
                                src={imagenProducto(p.imagenes[0], i)}
                                alt={`Foto de ${p.nombre}`}
                                loading="lazy"
                                decoding="async"
                                width={48}
                                height={60}
                              />
                            </div>
                          </div>
                          <div>
                            <span className="font-medium">{p.nombre}</span>
                            {p.sku && (
                              <span className="block font-mono text-[11px] opacity-60">{p.sku}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-outline">{p.categoria}</span>
                      </td>
                      <td className="font-semibold">
                        ${Number(p.precio).toLocaleString('es-AR')}
                        {Number(p.discount_percent) > 0 && (
                          <span className="badge badge-error badge-sm ml-2 text-white border-0">
                            -{p.discount_percent}%
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="text-sm">
                          {p.variaciones_stock.length} talles · {stockTotal} uds
                        </span>
                        {stockTotal === 0 && (
                          <span className="badge badge-neutral badge-sm ml-2">Sin Stock</span>
                        )}
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
          tallesSugeridos={tallesSugeridos}
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
