import { useState } from 'react'
import { Link } from 'react-router'
import { guardarProducto } from '../lib/adminApi'
import { ImageUploader } from './ImageUploader'
import { ordenarTalles } from '../lib/talles'
import { useCierreModal } from '../hooks/useCierreModal'
import { useTienda } from '../context/tienda'
import { porcentajeDesdeDescuentoTransferencia } from '../lib/precios'
import type { ProductoConStock } from '../types/database'

const LABEL_CLS =
  'block text-xs font-bold text-neutral-800 uppercase tracking-wider mb-1.5'
const INPUT_CLS =
  'w-full border-2 border-neutral-400 rounded-lg bg-white px-3.5 py-2.5 text-sm font-medium text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:ring-2 focus:ring-black outline-none transition-all'
const INPUT_SM_CLS =
  'border-2 border-neutral-300 rounded-lg bg-white px-2.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-black focus:ring-1 focus:ring-black outline-none'
const TITULO_SECCION_CLS =
  'text-xs font-extrabold uppercase tracking-[0.15em] text-neutral-600 mb-4 pb-2 border-b-2 border-neutral-300'

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
  porcentaje_recargo: string
  descripcion: string
  imagenes: string[]
  activo: boolean
  drop_id: string | null
  talles: TalleRow[]
}

function crearForm(
  producto: ProductoConStock | null,
  ordenTalles: string[],
  dropId: string | null | undefined,
  porcentajeGlobal: number,
): FormState {
  if (!producto) {
    return {
      nombre: '',
      sku: '',
      categoria: '',
      precio: '',
      precio_transferencia: '',
      discount_percent: '0',
      porcentaje_recargo: String(porcentajeGlobal),
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
    precio_transferencia: producto.precio_transferencia ? String(producto.precio_transferencia) : String(producto.precio),
    discount_percent: producto.discount_percent ? String(producto.discount_percent) : '0',
    porcentaje_recargo: String(porcentajeGlobal),
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
  const { descuento_transferencia } = useTienda()
  const porcentajeGlobal = porcentajeDesdeDescuentoTransferencia(descuento_transferencia)
  const [form, setForm] = useState<FormState>(() =>
    crearForm(producto, tallesSugeridos, dropId, porcentajeGlobal),
  )
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  useCierreModal(true, onCerrar)

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => {
      const nuevoForm = { ...f, [key]: value }

      if (key === 'precio_transferencia' || key === 'porcentaje_recargo') {
        const baseTransf = Number(key === 'precio_transferencia' ? value : nuevoForm.precio_transferencia) || 0
        const recargo = Number(key === 'porcentaje_recargo' ? value : nuevoForm.porcentaje_recargo) || 0

        if (baseTransf > 0) {
          const precioListaCalculado = Math.round(baseTransf * (1 + recargo / 100))
          nuevoForm.precio = String(precioListaCalculado)
        }
      }
      return nuevoForm
    })
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

  function agregarImagenes(urls: string[]) {
    setField('imagenes', [...form.imagenes, ...urls])
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

    const precioLista = Number(form.precio)
    const precioTransf = Number(form.precio_transferencia)

    if (!form.nombre.trim() || (!precioLista && !precioTransf)) {
      setErrorMsg('El nombre y al menos un precio válido son obligatorios.')
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
      precio: precioLista || precioTransf,
      precio_transferencia: precioTransf || null,
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
      <div className="modal-box w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] p-0 overflow-hidden rounded-2xl flex flex-col shadow-2xl">
        {/* Cabecera fija */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b-2 border-neutral-200 shrink-0 bg-neutral-50">
          <h2 className="text-xl font-extrabold text-neutral-900">
            {producto ? 'Editar producto' : 'Nuevo producto'}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="btn btn-ghost btn-sm btn-circle text-neutral-700 hover:bg-neutral-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Formulario contenedor con scroll en el medio */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 space-y-6 bg-white"
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

          {/* Bloque 2: Precios, Recargo y Descuento independientes */}
          <SeccionForm titulo="Precios y Descuentos">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-neutral-100 p-4 rounded-xl border-2 border-neutral-300">
              
              <label className={LABEL_CLS}>
                Precio de Transferencia ($)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={INPUT_CLS}
                  placeholder="Ej: 40000"
                  value={form.precio_transferencia}
                  onChange={(e) => setField('precio_transferencia', e.target.value)}
                  required
                />
                <span className="text-[11px] font-normal text-neutral-600 mt-1 block">Precio base abonando por transferencia.</span>
              </label>

              <label className={LABEL_CLS}>
                Recargo para Precio de Lista (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  className={INPUT_CLS}
                  placeholder={`Ej: ${porcentajeGlobal}`}
                  value={form.porcentaje_recargo}
                  onChange={(e) => setField('porcentaje_recargo', e.target.value)}
                />
                <span className="text-[11px] font-normal text-neutral-600 mt-1 block">
                  % extra sumado al de transferencia. Por defecto {porcentajeGlobal}% (config de la tienda).
                </span>
              </label>

              <label className={LABEL_CLS}>
                Precio de Lista / Web ($)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${INPUT_CLS} bg-emerald-50 border-emerald-600 font-bold text-emerald-900`}
                  placeholder="Calculado..."
                  value={form.precio}
                  onChange={(e) => setField('precio', e.target.value)}
                />
                <span className="text-[11px] font-medium text-emerald-700 mt-1 block">
                  Calculado automáticamente (+{Number(form.porcentaje_recargo) || 0}%).
                </span>
              </label>

              <label className={LABEL_CLS}>
                Descuento Promocional / OFF (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  className={`${INPUT_CLS} border-amber-500 bg-amber-50/50`}
                  placeholder="Ej: 10 (0 = sin descuento)"
                  value={form.discount_percent}
                  onChange={(e) => setField('discount_percent', e.target.value)}
                />
                <span className="text-[11px] font-medium text-amber-800 mt-1 block">Descuento extra opcional para ofertas.</span>
              </label>

              {(() => {
                const transf = Number(form.precio_transferencia) || 0
                const lista = Number(form.precio) || 0
                const desc = Number(form.discount_percent) || 0
                if (transf <= 0) return null
                return (
                  <div className="sm:col-span-2 bg-white p-3 rounded-lg border border-neutral-300 text-xs font-bold text-neutral-800 flex flex-col gap-1">
                    <span>Transferencia (Base): ${transf.toLocaleString('es-AR')}</span>
                    <span>Precio de Lista (Web): ${lista.toLocaleString('es-AR')}</span>
                    {desc > 0 && (
                      <span className="text-amber-700">Con Descuento ({desc}% OFF): Final rebajado.</span>
                    )}
                  </div>
                )
              })()}
            </div>
          </SeccionForm>

          {/* Bloque 3: Imágenes */}
          <SeccionForm titulo="Imágenes">
            <p className="text-xs text-neutral-600 font-medium mb-3">
              Formatos permitidos: JPG, PNG, WEBP, HEIC (iPhone). Recomendado: formato vertical 9:16
              (proporción de historia, 1080×1920), máx 5MB por imagen. Se comprime y convierte
              a WebP automáticamente (máx 800 KB) antes de subirse.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {form.imagenes.map((img, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-neutral-700">
                      Imagen {i + 1}
                      {i === 0 && <span className="ml-1 text-neutral-500 font-normal">(principal)</span>}
                    </p>
                    {form.imagenes.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error font-bold"
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
            <div className="mt-4 pt-4 border-t-2 border-neutral-200">
              <p className="text-xs text-neutral-600 font-medium mb-2">
                Cargá varias imágenes de una vez (máximo 10 por tanda). Se
                comprimen y suben en orden, y se agregan automáticamente al
                formulario.
              </p>
              <ImageUploader
                carpeta="productos"
                multiple
                onUrls={agregarImagenes}
                texto="Carga masiva de imágenes"
                altoMinimo="h-32"
              />
            </div>
            <button type="button" className="btn btn-outline btn-sm mt-3 border-2 font-bold" onClick={addImagen}>
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
                    className={`${INPUT_SM_CLS} w-24 font-bold`}
                    placeholder="Talle"
                    aria-label={`Talle ${i + 1}`}
                    value={t.talle}
                    onChange={(e) => setTalle(i, 'talle', e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    className={`${INPUT_SM_CLS} w-32 font-bold`}
                    placeholder="Stock"
                    aria-label={`Stock del talle ${i + 1}`}
                    value={t.stock_disponible}
                    onChange={(e) => setTalle(i, 'stock_disponible', e.target.value)}
                  />
                  {form.talles.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-error font-bold"
                      onClick={() => removeTalle(i)}
                    >
                      Quitar
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {tallesSugeridos
                .filter((t) => !form.talles.some((r) => r.talle.trim() === t))
                .map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="btn btn-xs btn-outline border-2 font-bold"
                    onClick={() => addTalleSugerido(t)}
                  >
                    + {t}
                  </button>
                ))}
              <Link to="/admin/talles" className="btn btn-xs btn-ghost font-bold text-neutral-700">
                Editar lista de talles
              </Link>
            </div>

            <label className="flex items-center gap-3 cursor-pointer mt-5 bg-neutral-50 p-3 rounded-lg border-2 border-neutral-300">
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-lg"
                checked={form.activo}
                onChange={(e) => setField('activo', e.target.checked)}
              />
              <span className="text-sm font-extrabold text-neutral-900">
                Visible en el catálogo de la tienda
              </span>
            </label>
          </SeccionForm>

          {errorMsg && (
            <div className="alert alert-error text-sm font-bold shadow-md" role="alert">
              {errorMsg}
            </div>
          )}
        </form>

        {/* Barra de acciones fija abajo del todo (fuera del form scrollable) */}
        <div className="px-4 sm:px-6 py-4 bg-neutral-100 border-t-2 border-neutral-300 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end shrink-0 shadow-inner">
          <button type="button" className="btn btn-outline border-2 font-bold" onClick={onCerrar}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="btn btn-primary font-bold px-6 text-base"
            disabled={guardando}
          >
            {guardando ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              'Guardar producto'
            )}
          </button>
        </div>
      </div>

      <form method="dialog" className="modal-backdrop">
        <button onClick={onCerrar}>cerrar</button>
      </form>
    </dialog>
  )
}