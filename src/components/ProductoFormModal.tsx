import { useState } from 'react'
import { Link } from 'react-router'
import { guardarProducto } from '../lib/adminApi'
import { ImageUploader } from './ImageUploader'
import { ImagenSegura } from './ImagenSegura'
import { ordenarTalles } from '../lib/talles'
import { useCierreModal } from '../hooks/useCierreModal'
import { useTienda } from '../context/tienda'
import {
  formatearPrecio,
  porcentajeAhorroTransferencia,
  porcentajeDesdeDescuentoTransferencia,
  precioBaseDesdeFinal,
  precioConDescuento,
  precioListaDesdeTransferencia,
  precioTransferencia,
  precioTransferenciaProducto,
  tienePrecioTransferenciaPropio,
} from '../lib/precios'
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

function colorHexValido(hex: string | null | undefined): string {
  const valor = hex?.trim() ?? ''
  return /^#[0-9a-fA-F]{6}$/.test(valor) ? valor : '#000000'
}

function clampDescuento(valor: string | number): number {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return 0
  return Math.min(99.99, Math.max(0, numero))
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
  precio_transferencia: string
  precio_lista: string
  discount_percent: string
  descripcion: string
  imagenes: string[]
  activo: boolean
  drop_id: string | null
  talles: TalleRow[]
  grupo_modelo: string
  color_hex: string
  color_nombre: string
}

function crearForm(
  producto: ProductoConStock | null,
  ordenTalles: string[],
  dropId: string | null | undefined,
  descuentoTransferencia: number,
): FormState {
  if (!producto) {
    return {
      nombre: '',
      sku: '',
      categoria: '',
      precio_transferencia: '',
      precio_lista: '',
      discount_percent: '0',
      descripcion: '',
      imagenes: [],
      activo: true,
      drop_id: dropId ?? null,
      talles: ['S', 'M', 'L', 'XL'].map((t) => ({ talle: t, stock_disponible: '0' })),
      grupo_modelo: '',
      color_hex: '#000000',
      color_nombre: '',
    }
  }

  const descuento = clampDescuento(producto.discount_percent ?? 0)
  const precioListaBase = Number(producto.precio) || 0
  const transferenciaBase = tienePrecioTransferenciaPropio(producto.precio_transferencia)
    ? Number(producto.precio_transferencia)
    : precioTransferencia(precioListaBase, descuentoTransferencia)
  const precioListaFinal = precioConDescuento(precioListaBase, descuento)
  const transferenciaFinal = precioTransferenciaProducto(
    precioListaFinal,
    descuentoTransferencia,
    transferenciaBase,
    descuento,
  )

  return {
    id: producto.id,
    nombre: producto.nombre,
    sku: producto.sku ?? '',
    categoria: producto.categoria,
    precio_transferencia: transferenciaFinal > 0 ? String(transferenciaFinal) : '',
    precio_lista: precioListaFinal > 0 ? String(precioListaFinal) : '',
    discount_percent: descuento > 0 ? String(descuento) : '0',
    descripcion: producto.descripcion ?? '',
    imagenes: producto.imagenes.filter(Boolean),
    activo: producto.activo,
    drop_id: producto.drop_id ?? dropId ?? null,
    talles: ordenarTalles(producto.variaciones_stock.map((v) => v.talle), ordenTalles).map(
      (talle) => {
        const v = producto.variaciones_stock.find((x) => x.talle === talle)
        return { talle, stock_disponible: String(v?.stock_disponible ?? 0) }
      },
    ),
    grupo_modelo: producto.grupo_modelo ?? '',
    color_hex: colorHexValido(producto.color_hex),
    color_nombre: producto.color_nombre ?? '',
  }
}

interface ProductoFormModalProps {
  producto: ProductoConStock | null
  categorias: string[]
  tallesSugeridos: string[]
  gruposModelo?: string[]
  dropId?: string | null
  onCerrar: () => void
  onGuardado: (mensaje: string) => void
}

export function ProductoFormModal({
  producto,
  categorias,
  tallesSugeridos,
  gruposModelo = [],
  dropId,
  onCerrar,
  onGuardado,
}: ProductoFormModalProps) {
  const { descuento_transferencia } = useTienda()
  const porcentajeGlobal = porcentajeDesdeDescuentoTransferencia(descuento_transferencia)
  const [form, setForm] = useState<FormState>(() =>
    crearForm(producto, tallesSugeridos, dropId, descuento_transferencia),
  )
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  useCierreModal(true, onCerrar)

  const descuentoPromocional = clampDescuento(form.discount_percent)
  const precioTransferenciaNum = Number(form.precio_transferencia) || 0
  const precioListaNum = Number(form.precio_lista) || 0
  const precioTransferenciaBase = precioBaseDesdeFinal(
    precioTransferenciaNum,
    descuentoPromocional,
  )
  const precioListaBase = precioBaseDesdeFinal(precioListaNum, descuentoPromocional)
  const ahorroPromocional = Math.max(0, precioListaBase - precioListaNum)
  const ahorroTransferencia = Math.max(0, precioListaNum - precioTransferenciaNum)
  const porcentajeTransferenciaMostrado = porcentajeAhorroTransferencia(
    precioListaNum,
    precioTransferenciaNum,
  )

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setPrecioTransferencia(valor: string) {
    setForm((f) => {
      const transferencia = Number(valor) || 0
      const lista = precioListaDesdeTransferencia(transferencia, descuento_transferencia)
      return {
        ...f,
        precio_transferencia: valor,
        precio_lista: lista > 0 ? String(lista) : '',
      }
    })
  }

  function setPrecioLista(valor: string) {
    setForm((f) => {
      const lista = Number(valor) || 0
      const transferencia = precioTransferencia(lista, descuento_transferencia)
      return {
        ...f,
        precio_lista: valor,
        precio_transferencia: transferencia > 0 ? String(transferencia) : '',
      }
    })
  }

  function setDescuento(valor: string) {
    setForm((f) => {
      const descuentoAnterior = clampDescuento(f.discount_percent)
      const descuentoNuevo = clampDescuento(valor)
      const transferencia = precioConDescuento(
        precioBaseDesdeFinal(Number(f.precio_transferencia), descuentoAnterior),
        descuentoNuevo,
      )
      const lista = precioConDescuento(
        precioBaseDesdeFinal(Number(f.precio_lista), descuentoAnterior),
        descuentoNuevo,
      )
      return {
        ...f,
        discount_percent: valor,
        precio_transferencia: transferencia > 0 ? String(transferencia) : '',
        precio_lista: lista > 0 ? String(lista) : '',
      }
    })
  }

  function agregarImagenes(urls: string[]) {
    if (!urls.length) return
    setForm((f) => {
      const actuales = f.imagenes.filter(Boolean)
      const vistos = new Set(actuales)
      const nuevas = urls.filter((url) => {
        if (!url || vistos.has(url)) return false
        vistos.add(url)
        return true
      })
      if (!nuevas.length) return f
      return { ...f, imagenes: [...actuales, ...nuevas] }
    })
  }

  function removeImagen(i: number) {
    setForm((f) => ({ ...f, imagenes: f.imagenes.filter((_, idx) => idx !== i) }))
  }

  function moverImagen(i: number, direccion: -1 | 1) {
    setForm((f) => {
      const destino = i + direccion
      if (destino < 0 || destino >= f.imagenes.length) return f
      const imagenes = [...f.imagenes]
      ;[imagenes[i], imagenes[destino]] = [imagenes[destino], imagenes[i]]
      return { ...f, imagenes }
    })
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

    const descuento = clampDescuento(form.discount_percent)
    const precioTransfBase = precioBaseDesdeFinal(Number(form.precio_transferencia), descuento)
    const precioListaBase = precioBaseDesdeFinal(Number(form.precio_lista), descuento)

    if (!form.nombre.trim() || !(precioTransfBase > 0) || !(precioListaBase > 0)) {
      setErrorMsg('El nombre, el precio de transferencia y el precio de lista son obligatorios.')
      return
    }

    setGuardando(true)
    const res = await guardarProducto({
      id: form.id,
      nombre: form.nombre.trim(),
      sku: form.sku.trim() || null,
      descripcion: form.descripcion || null,
      categoria: form.categoria.trim() || 'Otros',
      precio: precioListaBase,
      precio_transferencia: precioTransfBase,
      discount_percent: descuento,
      imagenes: form.imagenes,
      activo: form.activo,
      drop_id: form.drop_id,
      grupo_modelo: form.grupo_modelo,
      color_hex: form.color_hex,
      color_nombre: form.color_nombre,
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

          {/* Bloque 2: Agrupación por color/modelo. Cada color es un producto
              independiente; el grupo solo los enlaza en la ficha. */}
          <SeccionForm titulo="Variante de color / Modelo agrupado (opcional)">
            <p className="text-xs text-neutral-600 font-medium mb-3">
              Usá el mismo grupo en todas las variantes para que se muestren como
              colores en la ficha del producto. Los datos de color se guardan
              solo si se indica un grupo.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">
              <label className={LABEL_CLS}>
                Grupo / Modelo
                <input
                  type="text"
                  list="grupos-modelo"
                  className={INPUT_CLS}
                  placeholder="Ej: Remera Oversize Ikigai"
                  value={form.grupo_modelo}
                  onChange={(e) => setField('grupo_modelo', e.target.value)}
                />
                <datalist id="grupos-modelo">
                  {gruposModelo.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </label>

              <label className={LABEL_CLS}>
                Color
                <input
                  type="color"
                  className="w-full h-[46px] border-2 border-neutral-400 rounded-lg bg-white p-1 cursor-pointer focus:border-black focus:ring-2 focus:ring-black outline-none"
                  value={form.color_hex}
                  onChange={(e) => setField('color_hex', e.target.value)}
                />
              </label>

              <label className={`${LABEL_CLS} sm:col-span-2`}>
                Nombre del color
                <input
                  type="text"
                  className={INPUT_CLS}
                  placeholder="Ej: Negro, Beige, Azul lavado"
                  value={form.color_nombre}
                  onChange={(e) => setField('color_nombre', e.target.value)}
                />
              </label>
            </div>
          </SeccionForm>

          {/* Bloque 3: Precios. Los inputs muestran los importes finales
              (con el OFF aplicado); al guardar se invierte el OFF. */}
          <SeccionForm titulo="Precios y Descuentos">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-neutral-100 p-4 rounded-xl border-2 border-neutral-300">
              <label className={LABEL_CLS}>
                Precio de Transferencia ($)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={INPUT_CLS}
                  placeholder="Ej: 36000"
                  value={form.precio_transferencia}
                  onChange={(e) => setPrecioTransferencia(e.target.value)}
                  required
                />
                <span className="text-[11px] font-normal text-neutral-600 mt-1 block">
                  Importe final abonando por transferencia (ya incluye el {porcentajeGlobal}% de la tienda).
                </span>
              </label>

              <label className={LABEL_CLS}>
                Descuento por Transferencia (%)
                <input
                  type="number"
                  className={`${INPUT_CLS} bg-neutral-200 text-neutral-600 cursor-not-allowed`}
                  value={porcentajeGlobal}
                  readOnly
                  disabled
                />
                <span className="text-[11px] font-normal text-neutral-600 mt-1 block">
                  Se toma de la configuración general de la tienda.
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
                  value={form.precio_lista}
                  onChange={(e) => setPrecioLista(e.target.value)}
                  required
                />
                <span className="text-[11px] font-medium text-emerald-700 mt-1 block">
                  Se calcula como transferencia / (1 - {porcentajeGlobal}%). Podés editarlo manualmente.
                </span>
              </label>

              <label className={LABEL_CLS}>
                Descuento Promocional / OFF (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  className={`${INPUT_CLS} border-amber-500 bg-amber-50/50`}
                  placeholder="Ej: 10 (0 = sin descuento)"
                  value={form.discount_percent}
                  onChange={(e) => setDescuento(e.target.value)}
                />
                <span className="text-[11px] font-medium text-amber-800 mt-1 block">
                  Al cambiarlo, los precios de arriba se recalculan en vivo.
                </span>
              </label>

              {precioTransferenciaNum > 0 && (
                <div className="sm:col-span-2 bg-white p-3 rounded-lg border border-neutral-300 text-xs font-bold text-neutral-800 flex flex-col gap-1.5">
                  <span className="uppercase tracking-wider text-neutral-600">
                    Vista previa del precio final
                  </span>
                  <div className="flex flex-wrap items-baseline gap-2">
                    {descuentoPromocional > 0 && (
                      <span className="text-sm font-medium text-neutral-500 line-through">
                        ${formatearPrecio(precioListaBase)}
                      </span>
                    )}
                    <span className="text-lg text-emerald-800">
                      ${formatearPrecio(precioListaNum)}
                    </span>
                    {descuentoPromocional > 0 && (
                      <span className="badge badge-sm badge-error text-white border-0">
                        -{descuentoPromocional}% off
                      </span>
                    )}
                  </div>
                  {descuentoPromocional > 0 && (
                    <span className="text-amber-700">
                      Ahorrás ${formatearPrecio(ahorroPromocional)} con este descuento.
                    </span>
                  )}
                  <span>
                    {`Precios guardados antes del OFF: Web $${formatearPrecio(precioListaBase)} · Transferencia $${formatearPrecio(precioTransferenciaBase)}`}
                  </span>
                  <span className="text-emerald-800">
                    {`Pagando por transferencia (${porcentajeTransferenciaMostrado}%): $${formatearPrecio(precioTransferenciaNum)}${ahorroTransferencia > 0 ? ` (Ahorrás $${formatearPrecio(ahorroTransferencia)})` : ''}`}
                  </span>
                </div>
              )}
            </div>
          </SeccionForm>

          {/* Bloque 4: Imágenes. Un único uploader para 1 o varias; la
              posición 0 del array sigue siendo la imagen principal. */}
          <SeccionForm titulo="Imágenes">
            <p className="text-xs text-neutral-600 font-medium mb-3">
              Formatos permitidos: JPG, PNG, WEBP, HEIC (iPhone). Recomendado: formato vertical 9:16
              (proporción de historia, 1080×1920), máx 5MB por imagen. Se comprime y convierte
              a WebP automáticamente (máx 800 KB) antes de subirse. Las imágenes nuevas se agregan
              a la galería en orden, conservando las existentes. La primera sigue siendo la principal
              hasta que la reordenenes; usá ✕ para quitar una imagen.
            </p>
            <ImageUploader
              carpeta="productos"
              multiple
              onUrls={agregarImagenes}
              texto="Elegí o arrastrá imágenes"
              altoMinimo="h-40"
            />
            {form.imagenes.length > 0 && (
              <div className="mt-4 pt-4 border-t-2 border-neutral-200">
                <p className="text-xs font-extrabold uppercase tracking-wider text-neutral-600 mb-2">
                  Imágenes del producto ({form.imagenes.length}) · la primera es la principal
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {form.imagenes.map((url, i) => (
                    <div key={`${url}-${i}`} className="space-y-1">
                      <div className="relative aspect-[9/16] rounded-lg overflow-hidden border-2 border-neutral-300 bg-neutral-100">
                        <ImagenSegura
                          src={url}
                          carpeta="productos"
                          alt={`Imagen ${i + 1} del producto`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-1 left-1 badge badge-sm badge-neutral">
                          {i + 1}
                        </span>
                        {i === 0 && (
                          <span className="absolute bottom-1 left-1 badge badge-sm badge-success text-white border-0">
                            principal
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImagen(i)}
                          aria-label={`Quitar imagen ${i + 1}`}
                          className="absolute top-1 right-1 btn btn-circle btn-xs text-white bg-black/50 border-0 hover:bg-black/70"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs flex-1"
                          disabled={i === 0}
                          onClick={() => moverImagen(i, -1)}
                          aria-label={`Mover imagen ${i + 1} antes`}
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs flex-1"
                          disabled={i === form.imagenes.length - 1}
                          onClick={() => moverImagen(i, 1)}
                          aria-label={`Mover imagen ${i + 1} después`}
                        >
                          →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SeccionForm>

          {/* Bloque 5: Stock y visibilidad */}
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