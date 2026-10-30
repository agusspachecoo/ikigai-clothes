import { useEffect, useMemo, useState } from 'react'
import {
  getProductosAdmin,
  getPromocionesAdmin,
  guardarPromocion,
  eliminarPromocion,
  type PromocionInput,
  type PromocionGrupoInput,
} from '../../lib/adminApi'
import type { Promocion } from '../../lib/promociones'
import type { ProductoConStock } from '../../types/database'
import { formatearPrecio } from '../../lib/precios'
import { useCierreModal } from '../../hooks/useCierreModal'

interface EstadoModal {
  abierto: boolean
  promo: Promocion | null
}

function fechaInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : ''
}

function fechaInicioISO(fecha: string): string | null {
  return fecha ? new Date(`${fecha}T00:00:00`).toISOString() : null
}

function fechaFinISO(fecha: string): string | null {
  return fecha ? new Date(`${fecha}T23:59:59`).toISOString() : null
}

function grupoVacio(nombre: string, cantidad = 1): PromocionGrupoInput {
  return { nombre, cantidad_requerida: cantidad, producto_ids: [] }
}

function aInput(promo: Promocion, activo = promo.activo): PromocionInput {
  return {
    id: promo.id,
    nombre: promo.nombre,
    descripcion: promo.descripcion ?? null,
    tipo: promo.tipo,
    descuento_porcentaje: promo.descuento_porcentaje,
    precio_fijo: promo.precio_fijo,
    prioridad: promo.prioridad,
    activo,
    fecha_inicio: promo.fecha_inicio ?? null,
    fecha_fin: promo.fecha_fin ?? null,
    grupos: promo.grupos.map((grupo, index) => ({
      nombre: grupo.nombre ?? `Grupo ${index + 1}`,
      cantidad_requerida: grupo.cantidad_requerida,
      producto_ids: grupo.producto_ids,
    })),
  }
}

export function PromocionesAdmin() {
  const [promociones, setPromociones] = useState<Promocion[]>([])
  const [productos, setProductos] = useState<ProductoConStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notificacion, setNotificacion] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [modal, setModal] = useState<EstadoModal>({ abierto: false, promo: null })

  useEffect(() => {
    let activo = true

    async function cargar() {
      setLoading(true)
      const [promos, prods] = await Promise.all([getPromocionesAdmin(), getProductosAdmin()])
      if (!activo) return
      setPromociones(promos.data)
      setProductos(prods.data)
      setError(promos.error ?? prods.error)
      setLoading(false)
    }

    void cargar()
    return () => {
      activo = false
    }
  }, [recarga])

  useEffect(() => {
    if (!notificacion) return
    const timer = window.setTimeout(() => setNotificacion(null), 2500)
    return () => window.clearTimeout(timer)
  }, [notificacion])

  const nombresProductos = useMemo(
    () => new Map(productos.map((producto) => [producto.id, producto.nombre])),
    [productos],
  )

  async function alternarActivo(promo: Promocion) {
    const { error: err } = await guardarPromocion(aInput(promo, !promo.activo))
    if (err) setNotificacion(`Error: ${err}`)
    else setNotificacion(promo.activo ? 'Promoción desactivada' : 'Promoción activada')
    setRecarga((n) => n + 1)
  }

  async function borrar(promo: Promocion) {
    if (!window.confirm(`¿Eliminar la promoción "${promo.nombre}"?`)) return
    const { error: err } = await eliminarPromocion(promo.id)
    if (err) setNotificacion(`Error: ${err}`)
    else setNotificacion('Promoción eliminada')
    setRecarga((n) => n + 1)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Promociones</h1>
          <p className="text-sm opacity-60 mt-1">
            Packs por cantidad y combos automáticos sobre productos activos.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setModal({ abierto: true, promo: null })}
        >
          Nueva promoción
        </button>
      </div>

      {notificacion && (
        <div className="alert alert-success text-sm mb-4 shadow-sm">{notificacion}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-48 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="alert alert-error text-sm">{error}</div>
      ) : promociones.length === 0 ? (
        <div className="text-center py-16 opacity-60">No hay promociones configuradas.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {promociones.map((promo) => {
            const ahora = new Date()
            const vencida = Boolean(promo.fecha_fin && new Date(promo.fecha_fin) < ahora)
            const vigente =
              promo.activo &&
              !vencida &&
              (!promo.fecha_inicio || new Date(promo.fecha_inicio) <= ahora)

            return (
              <article
                key={promo.id}
                className={`card bg-base-100 shadow-sm border border-base-300 ${
                  promo.activo ? '' : 'opacity-60'
                }`}
              >
                <div className="card-body gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="card-title text-base">{promo.nombre}</h2>
                        <span className={`badge badge-sm ${promo.tipo === 'pack' ? 'badge-info' : 'badge-secondary'}`}>
                          {promo.tipo === 'pack' ? 'Pack' : 'Combo'}
                        </span>
                        <span className={`badge badge-sm ${vigente ? 'badge-success' : 'badge-neutral'}`}>
                          {!promo.activo
                            ? 'Inactiva'
                            : vencida
                              ? 'Vencida'
                              : vigente
                                ? 'Vigente'
                                : 'Programada'}
                        </span>
                      </div>
                      <p className="text-sm mt-1">
                        {promo.tipo === 'pack'
                          ? `${promo.grupos[0]?.cantidad_requerida ?? 0} unidades por $${formatearPrecio(
                              promo.precio_fijo ?? 0,
                            )}`
                          : `${promo.descuento_porcentaje ?? 0}% OFF en ${promo.grupos.length} grupos`}
                      </p>
                    </div>
                    <span className="text-xs opacity-50">Prioridad {promo.prioridad}</span>
                  </div>

                  <div className="space-y-1 text-xs opacity-70">
                    {promo.grupos.map((grupo, index) => (
                      <p key={`${promo.id}-${index}`}>
                        <span className="font-medium">{grupo.nombre || `Grupo ${index + 1}`}:</span>{' '}
                        {grupo.cantidad_requerida} ×{' '}
                        {grupo.producto_ids
                          .map((id) => nombresProductos.get(id) ?? 'Producto')
                          .join(', ')}
                      </p>
                    ))}
                    {(promo.fecha_inicio || promo.fecha_fin) && (
                      <p>
                        Vigencia: {fechaInput(promo.fecha_inicio) || 'desde ahora'} →{' '}
                        {fechaInput(promo.fecha_fin) || 'sin fin'}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-1">
                    <button
                      className="btn btn-xs btn-ghost"
                      onClick={() => setModal({ abierto: true, promo })}
                    >
                      Editar
                    </button>
                    <button className="btn btn-xs btn-ghost" onClick={() => alternarActivo(promo)}>
                      {promo.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button className="btn btn-xs btn-ghost text-error" onClick={() => borrar(promo)}>
                      Eliminar
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {modal.abierto && (
        <PromocionFormModal
          promo={modal.promo}
          productos={productos}
          promociones={promociones}
          onCerrar={() => setModal({ abierto: false, promo: null })}
          onGuardado={(mensaje) => {
            setModal({ abierto: false, promo: null })
            setNotificacion(mensaje)
            setRecarga((n) => n + 1)
          }}
        />
      )}
    </div>
  )
}

function PromocionFormModal({
  promo,
  productos,
  promociones,
  onCerrar,
  onGuardado,
}: {
  promo: Promocion | null
  productos: ProductoConStock[]
  promociones: Promocion[]
  onCerrar: () => void
  onGuardado: (mensaje: string) => void
}) {
  const [form, setForm] = useState<PromocionInput>(() =>
    promo
      ? aInput(promo)
      : {
          nombre: '',
          descripcion: null,
          tipo: 'pack',
          descuento_porcentaje: null,
          precio_fijo: 0,
          prioridad: 0,
          activo: true,
          fecha_inicio: null,
          fecha_fin: null,
          grupos: [grupoVacio('Productos del pack', 2)],
        },
  )
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  useCierreModal(true, onCerrar)

  const conflictos = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const otra of promociones) {
      if (!otra.activo || otra.id === form.id) continue
      for (const grupo of otra.grupos) {
        for (const productoId of grupo.producto_ids) {
          if (!mapa.has(productoId)) mapa.set(productoId, otra.nombre)
        }
      }
    }
    return mapa
  }, [promociones, form.id])

  const productosEnConflicto = useMemo(() => {
    const ids = new Set(form.grupos.flatMap((grupo) => grupo.producto_ids))
    return [...ids].filter((id) => conflictos.has(id))
  }, [form.grupos, conflictos])

  function cambiarTipo(tipo: 'pack' | 'combo') {
    setForm((actual) => ({
      ...actual,
      tipo,
      descuento_porcentaje: tipo === 'combo' ? (actual.descuento_porcentaje ?? 15) : null,
      precio_fijo: tipo === 'pack' ? (actual.precio_fijo || 0) : null,
      grupos:
        tipo === 'pack'
          ? [
              {
                ...(actual.grupos[0] ?? grupoVacio('Productos del pack', 2)),
                cantidad_requerida: Math.max(
                  2,
                  actual.grupos[0]?.cantidad_requerida ?? 2,
                ),
              },
            ]
          : actual.grupos.length >= 2
            ? actual.grupos
            : [...actual.grupos, grupoVacio('Grupo 2')],
    }))
  }

  function actualizarGrupo(indice: number, cambios: Partial<PromocionGrupoInput>) {
    setForm((actual) => ({
      ...actual,
      grupos: actual.grupos.map((grupo, i) =>
        i === indice ? { ...grupo, ...cambios } : grupo,
      ),
    }))
  }

  function agregarGrupo() {
    setForm((actual) => ({
      ...actual,
      grupos: [...actual.grupos, grupoVacio(`Grupo ${actual.grupos.length + 1}`)],
    }))
  }

  function quitarGrupo(indice: number) {
    setForm((actual) => ({
      ...actual,
      grupos: actual.grupos.filter((_, i) => i !== indice),
    }))
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)

    const nombre = form.nombre.trim()
    if (!nombre) return setErrorMsg('Ingresá un nombre para la promoción.')
    if (form.grupos.length === 0) return setErrorMsg('Agregá al menos un grupo de productos.')
    if (form.grupos.some((grupo) => grupo.producto_ids.length === 0)) {
      return setErrorMsg('Cada grupo necesita al menos un producto.')
    }
    if (form.grupos.some((grupo) => grupo.cantidad_requerida < 1)) {
      return setErrorMsg('La cantidad requerida debe ser mayor a 0.')
    }
    if (form.tipo === 'pack') {
      if (form.grupos.length !== 1) return setErrorMsg('El pack debe tener un solo grupo.')
      if (form.grupos[0].cantidad_requerida < 2) {
        return setErrorMsg('El pack debe llevar al menos 2 unidades.')
      }
      if (!form.precio_fijo || form.precio_fijo <= 0) {
        return setErrorMsg('Ingresá un precio fijo mayor a 0.')
      }
    } else {
      if (form.grupos.length < 2) return setErrorMsg('El combo necesita al menos dos grupos.')
      if (!form.descuento_porcentaje || form.descuento_porcentaje <= 0) {
        return setErrorMsg('Ingresá un porcentaje mayor a 0.')
      }
    }

    const todos = form.grupos.flatMap((grupo) => grupo.producto_ids)
    if (new Set(todos).size !== todos.length) {
      return setErrorMsg('Un producto no puede repetirse en dos grupos.')
    }

    if (form.fecha_inicio && form.fecha_fin && form.fecha_fin < form.fecha_inicio) {
      return setErrorMsg('La fecha de fin no puede ser anterior al inicio.')
    }

    setGuardando(true)
    const res = await guardarPromocion({
      ...form,
      nombre,
      descripcion: form.descripcion?.trim() || null,
      grupos: form.grupos.map((grupo, index) => ({
        ...grupo,
        nombre: grupo.nombre.trim() || `Grupo ${index + 1}`,
      })),
    })
    setGuardando(false)

    if (res.error) {
      setErrorMsg(res.error)
      return
    }

    onGuardado(promo ? 'Promoción actualizada' : 'Promoción creada')
  }

  return (
    <dialog className="modal modal-open" onClose={onCerrar}>
      <div className="modal-box max-w-3xl p-0 overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between p-5 border-b border-base-300">
          <h2 className="text-lg font-bold">{promo ? 'Editar promoción' : 'Nueva promoción'}</h2>
          <button className="btn btn-sm btn-circle btn-ghost" onClick={onCerrar} type="button">
            ✕
          </button>
        </div>

        <form onSubmit={guardar} className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="floating-label md:col-span-2">
              <span>Nombre</span>
              <input
                className="input input-bordered w-full"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej: 2 remeras por $35.000"
              />
            </label>

            <label className="floating-label md:col-span-2">
              <span>Descripción (opcional)</span>
              <textarea
                className="textarea textarea-bordered w-full"
                rows={2}
                value={form.descripcion ?? ''}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </label>

            <label className="floating-label">
              <span>Tipo</span>
              <select
                className="select select-bordered w-full"
                value={form.tipo}
                onChange={(e) => cambiarTipo(e.target.value as 'pack' | 'combo')}
              >
                <option value="pack">Pack por cantidad</option>
                <option value="combo">Combo cruzado</option>
              </select>
            </label>

            <label className="floating-label">
              <span>Prioridad</span>
              <input
                type="number"
                className="input input-bordered w-full"
                value={form.prioridad}
                onChange={(e) => setForm({ ...form, prioridad: Number(e.target.value) || 0 })}
              />
            </label>

            {form.tipo === 'pack' ? (
              <label className="floating-label">
                <span>Precio fijo del pack</span>
                <input
                  type="number"
                  min="1"
                  className="input input-bordered w-full"
                  value={form.precio_fijo ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, precio_fijo: Number(e.target.value) || null })
                  }
                />
              </label>
            ) : (
              <label className="floating-label">
                <span>Descuento (%)</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  className="input input-bordered w-full"
                  value={form.descuento_porcentaje ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      descuento_porcentaje: Number(e.target.value) || null,
                    })
                  }
                />
              </label>
            )}

            <label className="floating-label">
              <span>Inicio</span>
              <input
                type="date"
                className="input input-bordered w-full"
                value={fechaInput(form.fecha_inicio)}
                onChange={(e) =>
                  setForm({ ...form, fecha_inicio: fechaInicioISO(e.target.value) })
                }
              />
            </label>

            <label className="floating-label">
              <span>Fin</span>
              <input
                type="date"
                className="input input-bordered w-full"
                value={fechaInput(form.fecha_fin)}
                onChange={(e) => setForm({ ...form, fecha_fin: fechaFinISO(e.target.value) })}
              />
            </label>

            <label className="label cursor-pointer justify-start gap-3 md:col-span-2">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
              />
              <span className="label-text">Activa</span>
            </label>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Grupos de productos</h3>
              {form.tipo === 'combo' && (
                <button type="button" className="btn btn-xs btn-outline" onClick={agregarGrupo}>
                  Agregar grupo
                </button>
              )}
            </div>

            {form.grupos.map((grupo, indice) => (
              <div key={indice} className="rounded-2xl border border-base-300 p-4 space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="floating-label flex-1 min-w-40">
                    <span>Nombre del grupo</span>
                    <input
                      className="input input-bordered input-sm w-full"
                      value={grupo.nombre}
                      onChange={(e) => actualizarGrupo(indice, { nombre: e.target.value })}
                    />
                  </label>
                  <label className="floating-label w-32">
                    <span>Cantidad</span>
                    <input
                      type="number"
                      min="1"
                      className="input input-bordered input-sm w-full"
                      value={grupo.cantidad_requerida}
                      onChange={(e) =>
                        actualizarGrupo(indice, {
                          cantidad_requerida: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </label>
                  {form.tipo === 'combo' && form.grupos.length > 2 && (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost text-error"
                      onClick={() => quitarGrupo(indice)}
                    >
                      Quitar
                    </button>
                  )}
                </div>

                <SelectorProductos
                  productos={productos}
                  seleccionados={grupo.producto_ids}
                  conflictos={conflictos}
                  onToggle={(productoId) => {
                    const seleccionados = grupo.producto_ids.includes(productoId)
                      ? grupo.producto_ids.filter((id) => id !== productoId)
                      : [...grupo.producto_ids, productoId]
                    actualizarGrupo(indice, { producto_ids: seleccionados })
                  }}
                />
              </div>
            ))}
          </div>

          {productosEnConflicto.length > 0 && (
            <div className="alert alert-info text-sm">
              Estos productos también participan en otras promociones activas. Ahora un mismo
              producto puede estar en varias promociones al mismo tiempo.
            </div>
          )}

          {errorMsg && <div className="alert alert-error text-sm">{errorMsg}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={guardando}>
              {guardando ? 'Guardando...' : promo ? 'Guardar cambios' : 'Crear promoción'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  )
}

function SelectorProductos({
  productos,
  seleccionados,
  conflictos,
  onToggle,
}: {
  productos: ProductoConStock[]
  seleccionados: string[]
  conflictos: Map<string, string>
  onToggle: (productoId: string) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const termino = busqueda.trim().toLowerCase()

  const filtrados = productos.filter((producto) => {
    if (!termino) return true
    return `${producto.nombre} ${producto.categoria}`.toLowerCase().includes(termino)
  })

  return (
    <div>
      <input
        type="search"
        className="input input-bordered input-sm w-full mb-2"
        placeholder="Buscar producto por nombre o categoría..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />
      <div className="max-h-44 overflow-y-auto rounded-xl border border-base-300 divide-y divide-base-200">
        {filtrados.length === 0 ? (
          <p className="p-3 text-xs opacity-60">No se encontraron productos.</p>
        ) : (
          filtrados.map((producto) => {
            const marcado = seleccionados.includes(producto.id)
            const conflicto = conflictos.get(producto.id)
            const bloqueado = !producto.activo && !marcado

            return (
              <label
                key={producto.id}
                className={`flex items-center gap-3 p-2 text-sm ${
                  bloqueado ? 'opacity-50' : 'cursor-pointer hover:bg-base-200'
                }`}
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={marcado}
                  disabled={bloqueado}
                  onChange={() => onToggle(producto.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{producto.nombre}</span>
                  <span className="block text-xs opacity-60">
                    {producto.categoria} · ${formatearPrecio(producto.precio)}
                  </span>
                </span>
                {!producto.activo && <span className="badge badge-xs badge-neutral">Inactivo</span>}
                {conflicto && (
                  <span className="badge badge-xs badge-warning">Ya en {conflicto}</span>
                )}
              </label>
            )
          })
        )}
      </div>
      <p className="text-xs opacity-60 mt-1">{seleccionados.length} producto(s) seleccionado(s)</p>
    </div>
  )
}
