import { useState, useEffect } from 'react'
import { getCategoriasAdmin, crearCategoria, eliminarCategoria, getProductosAdmin } from '../../lib/adminApi'
import { slugify } from '../../lib/categorias'
import type { Categoria } from '../../types/database'

export function CategoriasAdmin() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [usos, setUsos] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [notificacion, setNotificacion] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [creando, setCreando] = useState(false)
  const [errorCrear, setErrorCrear] = useState<string | null>(null)

  useEffect(() => {
    let activo = true

    async function cargar() {
      setLoading(true)
      const [c, p] = await Promise.all([getCategoriasAdmin(), getProductosAdmin()])
      if (activo) {
        setCategorias(c.data)
        const conteo: Record<string, number> = {}
        for (const prod of p.data) {
          conteo[prod.categoria] = (conteo[prod.categoria] ?? 0) + 1
        }
        setUsos(conteo)
        setError(c.error ?? p.error)
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

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    setErrorCrear(null)

    const valor = nombre.trim()
    if (!valor) {
      setErrorCrear('Ingresá un nombre para la categoría.')
      return
    }
    if (categorias.some((c) => c.nombre.toLowerCase() === valor.toLowerCase())) {
      setErrorCrear('Ya existe una categoría con ese nombre.')
      return
    }

    setCreando(true)
    const { error: err } = await crearCategoria(valor)
    setCreando(false)

    if (err) {
      setErrorCrear(err)
      return
    }

    setNombre('')
    setNotificacion('Categoría creada')
    setRecarga((n) => n + 1)
  }

  async function handleEliminar(c: Categoria) {
    const enUso = usos[c.nombre] ?? 0
    const msg =
      enUso > 0
        ? `La categoría "${c.nombre}" tiene ${enUso} producto(s) asociado(s). Los productos se conservan pero dejarán de aparecer en los filtros. ¿Eliminar de todas formas?`
        : `¿Eliminar la categoría "${c.nombre}"?`

    if (!window.confirm(msg)) return

    const { error: err } = await eliminarCategoria(c.id)
    if (err) setNotificacion(`Error: ${err}`)
    else setNotificacion('Categoría eliminada')
    setRecarga((n) => n + 1)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Categorías</h1>
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
            Ejecutá la migración{' '}
            <span className="font-mono">003_dynamic_categories.sql</span> en Supabase para crear la
            tabla de categorías.
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
                    <th>Categoría</th>
                    <th>Slug</th>
                    <th>Productos</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {categorias.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium">{c.nombre}</td>
                      <td>
                        <span className="font-mono text-xs opacity-60">{c.slug}</span>
                      </td>
                      <td>
                        <span className="badge badge-outline">{usos[c.nombre] ?? 0}</span>
                      </td>
                      <td className="text-right">
                        <button
                          className="btn btn-xs btn-ghost text-error"
                          onClick={() => handleEliminar(c)}
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
            <h2 className="font-bold">Agregar categoría</h2>
            <label className="form-control">
              <span className="label-text text-sm mb-1">Nombre</span>
              <input
                type="text"
                className="input input-bordered"
                placeholder="Ej: Medias"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </label>

            <div className="text-xs opacity-60">
              {nombre.trim() && (
                <p>
                  Slug generado:{' '}
                  <span className="font-mono">{slugify(nombre.trim())}</span>
                </p>
              )}
              <p className="mt-1">
                La categoría aparece automáticamente en los filtros del catálogo y en el menú de la
                tienda.
              </p>
            </div>

            {errorCrear && <div className="alert alert-error text-sm">{errorCrear}</div>}

            <button type="submit" className="btn btn-primary btn-block" disabled={creando}>
              {creando ? <span className="loading loading-spinner loading-sm" /> : 'Crear categoría'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}