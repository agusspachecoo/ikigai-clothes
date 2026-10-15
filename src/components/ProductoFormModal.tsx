import { useState } from 'react'
import { Link } from 'react-router'
import { guardarProducto } from '../lib/adminApi'
import { ImageUploader } from './ImageUploader'
import { ordenarTalles } from '../lib/talles'
import { useCierreModal } from '../hooks/useCierreModal'
import type { ProductoConStock } from '../types/database'

const LABEL_CLS =
  'block text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1'
const INPUT_CLS =
  'w-full border border-neutral-300 rounded-lg bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:ring-1 focus:ring-black outline-none'
const INPUT_SM_CLS =
  'border border-neutral-300 rounded-lg bg-white px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:ring-1 focus:ring-black outline-none'
const TITULO_SECCION_CLS =
  'text-xs font-bold uppercase tracking-[0.15em] text-neutral-500 mb-4 pb-2 border-b border-neutral-200'

function SeccionForm({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className={TITULO_SECCION_CLS}>{titulo}</h3>
      {children}
    </section>
  )
}

interface TalleRow {
  talle: string
  stock_disponible: string
}

interface FormState {
  id?: string
  nombre: string
  sku: string
  categoria: string
  precio: string
  precio_transferencia: string
  discount_percent: string
  descripcion: string
  imagenes: string[]
  activo: boolean
  drop_id: string | null
  talles: TalleRow[]
}

function crearForm(
  producto: ProductoConStock | null,
  ordenTalles: string[],
  dropId?: string | null,
): FormState {
  if (!producto) {
    return {
      nombre: '',
      sku: '',
      categoria: '',
      precio: '',
      precio_transferencia: '',
      discount_percent: '',
      descripcion: '',
      imagenes: [''],
      activo: true,
      drop_id: dropId ?? null,
      talles: ['S', 'M', 'L', 'XL'].map((t) => ({ talle: t, stock_disponible: '0' })),
    }
  }

  return {
    id: producto.id,
    nombre: producto.nombre,
    sku: producto.sku ?? '',
    categoria: producto.categoria,
    precio: String(producto.precio),
    precio_transferencia: producto.precio_transferencia ? String(producto.precio_transferencia) : '',
    discount_percent: producto.discount_percent ? String(producto.discount_percent) : '',
    descripcion: producto.descripcion ?? '',
    imagenes: producto.imagenes.length > 0 ? [...producto.imagenes] : [''],
    activo: producto.activo,
    drop_id: producto.drop_id ?? dropId ?? null,
    talles: ordenarTalles(producto.variaciones_stock.map((v) => v.talle), ordenTalles).map(
      (talle) => {
        const v = producto.variaciones_stock.find((x) => x.talle === talle)
        return { talle, stock_disponible: String(v?.stock_disponible ?? 0) }
      },
    ),
  }
}

interface ProductoFormModalProps {
  producto: ProductoConStock | null
  categorias: string[]
  tallesSugeridos: string[]
  /** Si viene, el producto nuevo queda asignado a ese drop. */
  dropId?: string | null
  onCerrar: () => void
  onGuardado: (mensaje: string) => void
}

export function ProductoFormModal({
  producto,
  categorias,
  tallesSugeridos,
  dropId,
  onCerrar,
  onGuardado,
}: ProductoFormModalProps) {
  const [form, setForm] = useState<FormState>(() => crearForm(producto, tallesSugeridos, dropId))
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  useCierreModal(true, onCerrar)

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

    const discount_percent = Math.max(0, Math.min(100, Number(form.discount_percent) || 0))

    setGuardando(true)
    const res = await guardarProducto({
      id: form.id,
      nombre: form.nombre.trim(),
      sku: form.sku.trim() || null,
      descripcion: form.descripcion || null,
      categoria: form.categoria.trim() || 'Otros',
      precio,
      precio_transferencia: form.precio_transferencia ? Number(form.precio_transferencia) : null,
      discount_percent,
      imagenes: form.imagenes,
      activo: form.activo,
      drop_id: form.drop_id,
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
    <dialog
      className="modal modal-open"
      onClose={onCerrar}
      aria-label={producto ? 'Editar producto' : 'Nuevo producto'}
    >
      <div className="modal-box w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] p-0 overflow-hidden rounded-2xl flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-neutral-200 shrink-0">
          <h2 className="text-lg font-bold text-neutral-900">
            {producto ? 'Editar producto' : 'Nuevo producto'}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="btn btn-ghost btn-sm btn-circle"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 space-y-6 pb-20 sm:pb-6"
        >
          {/* Bloque 1: Información básica */}
          <SeccionForm titulo="Información básica">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={LABEL_CLS}>
                Nombre
                <input
                  type="text"
                  className={INPUT_CLS}
                  placeholder="Ej: Remera Oversize Ikigai"
                  value={form.nombre}
                  onChange={(e) => setField('nombre', e.target.value)}
                  required
                />
              </label>

              <label className={LABEL_CLS}>
                SKU / Código (opcional)
                <input
                  type="text"
                  className={`${INPUT_CLS} font-mono`}
                  placeholder="Ej: IKI-REM-001"
                  value={form.sku}
                  onChange={(e) => setField('sku', e.target.value)}
                />
              </label>

              <label className={LABEL_CLS}>
                Categoría
                <input
                  type="text"
                  list="categorias"
                  className={INPUT_CLS}
                  placeholder="Ej: Remeras"
                  value={form.categoria}
                  onChange={(e) => setField('categoria', e.target.value)}
                  required
                />
                <datalist id="categorias">
                  {categorias.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>

              <label className={`${LABEL_CLS} sm:col-span-2`}>
                Descripción
                <textarea
                  className={INPUT_CLS}
                  rows={3}
                  placeholder="Material, calce, detalles de la prenda..."
                  value={form.descripcion}
                  onChange={(e) => setField('descripcion', e.target.value)}
                />
              </label>
            </div>
          </SeccionForm>

          {/* Bloque 2: Precios y descuentos */}
          <SeccionForm titulo="Precios y descuentos">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={LABEL_CLS}>
                Precio de Lista ($)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={INPUT_CLS}
                  placeholder="Ej: 59500"
                  value={form.precio}
                  onChange={(e) => setField('precio', e.target.value)}
                  required
                />
              </label>

              <label className={LABEL_CLS}>
                Precio Transferencia ($, opcional)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={INPUT_CLS}
                  placeholder="Ej: 47600"
                  value={form.precio_transferencia}
                  onChange={(e) => setField('precio_transferencia', e.target.value)}
                />
              </label>

              <label className={LABEL_CLS}>
                Descuento (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  className={INPUT_CLS}
                  placeholder="0 = sin descuento"
                  value={form.discount_percent}
                  onChange={(e) => setField('discount_percent', e.target.value)}
                />
              </label>

              {(() => {
                const base = Number(form.precio) || 0
                const desc = Math.max(0, Math.min(100, Number(form.discount_percent) || 0))
                if (base <= 0 || desc <= 0) return null
                const promo = Math.round(base * (100 - desc)) / 100
                return (
                  <p className="text-xs text-success font-semibold self-end pb-2">
                    Precio original ${base.toLocaleString('es-AR')} → Precio promocional{' '}
                    ${promo.toLocaleString('es-AR')} (ahorro $
                    {(base - promo).toLocaleString('es-AR')})
                  </p>
                )
              })()}
            </div>
          </SeccionForm>

          {/* Bloque 3: Imágenes */}
          <SeccionForm titulo="Imágenes">
            <p className="text-xs text-neutral-500 mb-3">
              Formatos permitidos: JPG, PNG, WEBP. Recomendado: formato vertical 9:16
              (proporción de historia, 1080×1920), máx 5MB por imagen. Se comprime y convierte
              a WebP automáticamente (máx 800 KB) antes de subirse.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {form.imagenes.map((img, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-neutral-500 font-medium">
                      Imagen {i + 1}
                      {i === 0 && <span className="ml-1 text-neutral-400">(principal)</span>}
                    </p>
                    {form.imagenes.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => removeImagen(i)}
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                  <ImageUploader
                    carpeta="productos"
                    imagenActual={img}
                    onUrl={(url) => setImagen(i, url)}
                    proporcion="vertical"
                    altoMinimo="h-48"
                  />
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-outline btn-sm mt-3" onClick={addImagen}>
              Agregar imagen
            </button>
          </SeccionForm>

          {/* Bloque 4: Stock y visibilidad */}
          <SeccionForm titulo="Stock por talle y visibilidad">
            <div className="space-y-2">
              {form.talles.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    className={`${INPUT_SM_CLS} w-24`}
                    placeholder="Talle"
                    aria-label={`Talle ${i + 1}`}
                    value={t.talle}
                    onChange={(e) => setTalle(i, 'talle', e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    className={`${INPUT_SM_CLS} w-32`}
                    placeholder="Stock"
                    aria-label={`Stock del talle ${i + 1}`}
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
              {tallesSugeridos
                .filter((t) => !form.talles.some((r) => r.talle.trim() === t))
                .map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="btn btn-xs btn-outline"
                    onClick={() => addTalleSugerido(t)}
                  >
                    + {t}
                  </button>
                ))}
              <Link to="/admin/talles" className="btn btn-xs btn-ghost">
                Editar lista de talles
              </Link>
            </div>

            <label className="flex items-center gap-3 cursor-pointer mt-4">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={form.activo}
                onChange={(e) => setField('activo', e.target.checked)}
              />
              <span className="text-sm font-medium text-neutral-900">
                Visible en el catálogo
              </span>
            </label>
          </SeccionForm>

          {errorMsg && (
            <div className="alert alert-error text-sm" role="alert">
              {errorMsg}
            </div>
          )}

          {/* Acciones fijas al final del scroll */}
          <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white border-t border-neutral-200 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <button type="button" className="btn btn-outline" onClick={onCerrar}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={guardando}>
              {guardando ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                'Guardar producto'
              )}
            </button>
          </div>
        </form>
      </div>

      <form method="dialog" className="modal-backdrop">
        <button onClick={onCerrar}>cerrar</button>
      </form>
    </dialog>
  )
}
