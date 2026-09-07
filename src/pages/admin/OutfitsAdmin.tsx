import { useState, useEffect } from 'react'
import {
  getOutfitsAdmin,
  guardarOutfit,
  eliminarOutfit,
  setOutfitActivo,
  getProductosAdmin,
  subirImagen,
  type OutfitInput,
} from '../../lib/adminApi'
import { comprimirImagen, blobToFile } from '../../lib/imageCompression'
import { imagenOutfit, imagenProducto } from '../../lib/imagenes'
import type { OutfitConItems, ProductoConStock } from '../../types/database'

interface EstadoModal {
  abierto: boolean
  outfit: OutfitConItems | null
}

export function OutfitsAdmin() {
  const [outfits, setOutfits] = useState<OutfitConItems[]>([])
  const [productos, setProductos] = useState<ProductoConStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [notificacion, setNotificacion] = useState<string | null>(null)
  const [modal, setModal] = useState<EstadoModal>({ abierto: false, outfit: null })

  useEffect(() => {
    let activo = true

    async function cargar() {
      setLoading(true)
      const [o, p] = await Promise.all([getOutfitsAdmin(), getProductosAdmin()])
      if (activo) {
        setOutfits(o.data)
        setProductos(p.data)
        setError(o.error ?? p.error)
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

  async function handleEliminar(o: OutfitConItems) {
    if (!window.confirm(`¿Eliminar el outfit "${o.nombre}"?`)) return
    const { error: err } = await eliminarOutfit(o.id)
    if (err) setNotificacion(`Error: ${err}`)
    else setNotificacion('Outfit eliminado')
    setRecarga((n) => n + 1)
  }

  async function handleToggleActivo(o: OutfitConItems) {
    const { error: err } = await setOutfitActivo(o.id, !o.activo)
    if (err) setNotificacion(`Error: ${err}`)
    else setNotificacion(o.activo ? 'Outfit desactivado' : 'Outfit activado')
    setRecarga((n) => n + 1)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Outfits / Combos</h1>
        <button className="btn btn-primary" onClick={() => setModal({ abierto: true, outfit: null })}>
          Nuevo outfit
        </button>
      </div>

      {notificacion && (
        <div className="alert alert-success text-sm mb-4 shadow-sm">{notificacion}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-72 w-full rounded-2xl"></div>
          ))}
        </div>
      ) : error ? (
        <div className="alert alert-error text-sm">{error}</div>
      ) : outfits.length === 0 ? (
        <div className="text-center py-16 opacity-60">No hay outfits</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {outfits.map((o, i) => (
            <div key={o.id} className={`card bg-base-100 shadow-sm overflow-hidden ${o.activo ? '' : 'opacity-50'}`}>
              <figure className="aspect-[3/4] bg-base-300">
                <img
                  src={imagenOutfit(o.imagen_portada, i)}
                  alt={o.nombre}
                  className="w-full h-full object-cover"
                />
              </figure>
              <div className="card-body">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="card-title text-base">{o.nombre}</h2>
                  <span className={`badge ${o.activo ? 'badge-success' : 'badge-neutral'}`}>
                    {o.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="text-primary font-bold">
                  ${Number(o.precio_combo).toLocaleString('es-AR')}
                </p>
                <p className="text-sm opacity-60">
                  {o.outfit_items.length} prendas:{' '}
                  {o.outfit_items.map((it) => it.producto?.nombre).filter(Boolean).join(', ')}
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    className="btn btn-xs btn-ghost"
                    onClick={() => setModal({ abierto: true, outfit: o })}
                  >
                    Editar
                  </button>
                  <button className="btn btn-xs btn-ghost" onClick={() => handleToggleActivo(o)}>
                    {o.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    className="btn btn-xs btn-ghost text-error"
                    onClick={() => handleEliminar(o)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.abierto && (
        <OutfitFormModal
          outfit={modal.outfit}
          productos={productos}
          onCerrar={() => setModal({ abierto: false, outfit: null })}
          onGuardado={(mensaje) => {
            setModal({ abierto: false, outfit: null })
            setNotificacion(mensaje)
            setRecarga((n) => n + 1)
          }}
        />
      )}
    </div>
  )
}

interface FormProps {
  outfit: OutfitConItems | null
  productos: ProductoConStock[]
  onCerrar: () => void
  onGuardado: (mensaje: string) => void
}

function OutfitFormModal({ outfit, productos, onCerrar, onGuardado }: FormProps) {
  const [form, setForm] = useState<OutfitInput>(() => ({
    id: outfit?.id,
    nombre: outfit?.nombre ?? '',
    descripcion: outfit?.descripcion ?? '',
    precio_combo: outfit ? Number(outfit.precio_combo) : 0,
    imagen_portada: outfit?.imagen_portada ?? '',
    activo: outfit?.activo ?? true,
    producto_ids: outfit?.outfit_items.map((it) => it.producto_id) ?? [],
  }))
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)

  function toggleProducto(id: string) {
    setForm((f) => ({
      ...f,
      producto_ids: f.producto_ids.includes(id)
        ? f.producto_ids.filter((x) => x !== id)
        : [...f.producto_ids, id],
    }))
  }

  async function handleSubir(file: File | null) {
    if (!file) return
    setSubiendo(true)
    setErrorMsg(null)
    try {
      const blob = await comprimirImagen(file)
      const archivo = blobToFile(blob, file.name)
      const { url, error } = await subirImagen(archivo, 'outfits')
      if (error) throw new Error(error)
      if (url) setForm((f) => ({ ...f, imagen_portada: url }))
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al subir la imagen')
    } finally {
      setSubiendo(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)

    if (!form.nombre.trim() || !form.imagen_portada.trim() || form.precio_combo <= 0) {
      setErrorMsg('El nombre, la imagen de portada y un precio válido son obligatorios.')
      return
    }

    if (form.producto_ids.length === 0) {
      setErrorMsg('Seleccioná al menos una prenda para el look.')
      return
    }

    setGuardando(true)
    const res = await guardarOutfit({
      ...form,
      nombre: form.nombre.trim(),
    })
    setGuardando(false)

    if (res.error) {
      setErrorMsg(res.error)
      return
    }

    onGuardado(outfit ? 'Outfit actualizado' : 'Outfit creado')
  }

  return (
    <dialog className="modal modal-open" onClose={onCerrar}>
      <div className="modal-box max-w-3xl p-0 overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between p-5 border-b border-base-300">
          <h2 className="text-lg font-bold text-gray-900">{outfit ? 'Editar outfit' : 'Nuevo outfit'}</h2>
          <button onClick={onCerrar} className="btn btn-ghost btn-circle btn-sm" aria-label="Cerrar">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="floating-label">
              <span>Nombre del look</span>
              <input
                type="text"
                className="input input-bordered w-full"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
            </label>

            <label className="floating-label">
              <span>Precio del combo ($)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="input input-bordered w-full"
                value={form.precio_combo}
                onChange={(e) => setForm({ ...form, precio_combo: Number(e.target.value) })}
                required
              />
            </label>
          </div>

          <label className="floating-label">
            <span>Descripción</span>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={2}
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
          </label>

          {/* Imagen portada (selfie vestidor, vertical) */}
          <div>
            <p className="font-semibold text-sm mb-2 text-gray-900">Imagen de portada (vertical, tipo selfie de vestidor)</p>
            <div className="flex items-center gap-3">
              <div className="w-24 h-32 bg-base-300 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                {form.imagen_portada ? (
                  <img src={form.imagen_portada} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs opacity-40 px-2 text-center">Imagen vertical</span>
                )}
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <input
                  type="url"
                  className="input input-bordered w-full"
                  placeholder="https://... (URL de la imagen)"
                  value={form.imagen_portada}
                  onChange={(e) => setForm({ ...form, imagen_portada: e.target.value })}
                  required
                />
                <label className="btn btn-outline btn-sm w-fit">
                  {subiendo ? <span className="loading loading-spinner loading-sm" /> : 'Subir imagen'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={subiendo}
                    onChange={(e) => handleSubir(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Prendas del look */}
          <div>
            <p className="font-semibold text-sm mb-2 text-gray-900">
              Prendas que componen el look ({form.producto_ids.length} seleccionadas)
            </p>
            {productos.length === 0 ? (
              <p className="text-sm opacity-60">No hay productos disponibles.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {productos.map((p, i) => {
                  const seleccionado = form.producto_ids.includes(p.id)
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => toggleProducto(p.id)}
                      className={`flex items-center gap-3 p-2 rounded-xl border-2 text-left cursor-pointer transition-colors ${
                        seleccionado
                          ? 'border-primary bg-primary/5'
                          : 'border-base-300 hover:border-primary/40'
                      } ${p.activo ? '' : 'opacity-50'}`}
                    >
                      <img
                        src={imagenProducto(p.imagenes[0], i)}
                        alt=""
                        className="w-10 h-12 object-cover rounded-lg bg-base-300 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.nombre}</p>
                        <p className="text-xs opacity-50">
                          {p.categoria} · ${Number(p.precio).toLocaleString('es-AR')}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary checkbox-sm"
                        checked={seleccionado}
                        readOnly
                      />
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={form.activo}
              onChange={(e) => setForm({ ...form, activo: e.target.checked })}
            />
            <span className="text-sm font-medium">Visible en la web</span>
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