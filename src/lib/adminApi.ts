import { supabase } from './supabase'
import { slugify } from './categorias'
import type { ProductoConStock, OutfitConItems, Orden, OrdenItem, Resena } from '../types/database'
import type { ComunidadFoto, Categoria, Banner } from '../types/database'

// ============================================
// CATEGORÍAS
// ============================================

export async function getCategoriasAdmin() {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .order('nombre', { ascending: true })
  return { data: (data ?? []) as Categoria[], error: error?.message ?? null }
}

export async function crearCategoria(nombre: string, imagenUrl: string | null = null) {
  const base = slugify(nombre) || 'categoria'

  const { data } = await supabase.from('categorias').select('slug')
  const usados = new Set((data ?? []).map((x) => x.slug))

  let slug = base
  let sufijo = 2
  while (usados.has(slug)) slug = `${base}-${sufijo++}`

  const { error } = await supabase
    .from('categorias')
    .insert([{ nombre, slug, imagen_url: imagenUrl || null }])
  return { error: error?.message ?? null }
}

/** Actualiza nombre e imagen representativa de una categoría. */
export async function actualizarCategoria(
  id: string,
  datos: { nombre?: string; imagen_url?: string | null },
) {
  const payload: Record<string, unknown> = {}
  if (datos.nombre !== undefined) payload.nombre = datos.nombre
  if (datos.imagen_url !== undefined) payload.imagen_url = datos.imagen_url || null

  if (Object.keys(payload).length === 0) return { error: null }

  const { error } = await supabase.from('categorias').update(payload).eq('id', id)
  return { error: error?.message ?? null }
}

export async function eliminarCategoria(id: string) {
  const { error } = await supabase.from('categorias').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ============================================
// STORAGE (IMÁGENES)
// ============================================

export const BUCKET_IMAGENES = 'product-images'

export type CarpetaImagen =
  | 'productos'
  | 'outfits'
  | 'reviews'
  | 'comunidad'
  | 'showroom'
  | 'categorias'
  | 'banners'

/** Convierte una URL pública de imágenes a su path en Storage. */
function pathDeImagen(valor: string): string | null {
  const base = `${BUCKET_IMAGENES}/`
  if (valor.startsWith(base)) return valor

  try {
    const url = new URL(valor)
    const idx = url.pathname.indexOf(`/object/public/${base}`)
    if (idx !== -1) return decodeURIComponent(url.pathname.slice(idx + `/object/public/`.length))
  } catch {
    return null
  }
  return null
}

/**
 * Borra una imagen de `product-images` a partir de su URL pública.
 *
 * Pensado para llamarse DESPUÉS de que la fila ya apunta a la nueva imagen. Si
 * se borra antes de guardar y el guardado falla (o el usuario cancela el
 * modal), la fila queda apuntando a un archivo que ya no existe.
 */
export async function eliminarImagen(url: string | null | undefined) {
  const path = url ? pathDeImagen(url) : null
  // `pathDeImagen` devuelve null si la URL no es de este bucket: no se toca nada.
  if (!path) return { error: null }

  const { error } = await supabase.storage.from(BUCKET_IMAGENES).remove([path])
  return { error: error?.message ?? null }
}

/**
 * Sube una imagen ya comprimida.
 *
 * Esta función NO borra nada. Las imágenes viejas se limpian con
 * `eliminarImagen()`, y solo recién después de que la fila en la base ya apunte
 * a la nueva. Encadenar el borrado acá parecía más cómodo pero rompe los
 * formularios: con un modal de edición, subir una foto y cancelar dejaba la
 * fila apuntando a un archivo que ya se había borrado.
 *
 * Antes esta función tenía un `borrarAnterior` que purgaba la carpeta entera.
 * Con `categorias` eso significaba que subir la foto de "Buzos" borraba la de
 * "Remeras", porque todas comparten carpeta. No volver a un borrado por carpeta.
 */
export async function subirImagen(file: File, carpeta: CarpetaImagen = 'productos') {
  const ext = file.type === 'image/jpeg' ? 'jpg' : 'webp'
  const nombre = `${carpeta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage.from(BUCKET_IMAGENES).upload(nombre, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })

  if (error) return { url: null, error: error.message }

  const { data } = supabase.storage.from(BUCKET_IMAGENES).getPublicUrl(nombre)
  return { url: data.publicUrl, error: null }
}

// ============================================
// PRODUCTOS
// ============================================

export async function getProductosAdmin() {
  const { data, error } = await supabase
    .from('productos')
    .select('*, variaciones_stock(*)')
    .order('created_at', { ascending: false })
  return { data: (data ?? []) as ProductoConStock[], error: error?.message ?? null }
}

export interface TalleInput {
  talle: string
  stock_disponible: number
}

export interface ProductoInput {
  id?: string
  nombre: string
  descripcion: string | null
  categoria: string
  precio: number
  precio_transferencia: number | null
  discount_percent: number
  imagenes: string[]
  activo: boolean
  talles: TalleInput[]
  sku?: string | null
}

export async function guardarProducto(input: ProductoInput) {
  const payload = {
    nombre: input.nombre,
    descripcion: input.descripcion || null,
    categoria: input.categoria,
    precio: input.precio,
    precio_transferencia: input.precio_transferencia || null,
    discount_percent: input.discount_percent,
    imagenes: input.imagenes.filter(Boolean),
    activo: input.activo,
    // Vacío o solo espacios se guarda como NULL: el índice único ignora los
    // NULL, así que varios productos pueden quedarse sin SKU.
    sku: input.sku?.trim() || null,
  }

  let productoId = input.id ?? ''

  if (input.id) {
    const { error } = await supabase.from('productos').update(payload).eq('id', input.id)
    if (error) return { id: null, error: error.message }
  } else {
    const { data, error } = await supabase.from('productos').insert([payload]).select('id').single()
    if (error || !data) return { id: null, error: error?.message ?? 'No se pudo crear el producto' }
    productoId = data.id as string
  }

  const { error: errVar } = await supabase
    .from('variaciones_stock')
    .delete()
    .eq('producto_id', productoId)
  if (errVar) return { id: productoId, error: errVar.message }

  const variaciones = input.talles
    .filter((t) => t.talle.trim() !== '')
    .map((t) => ({
      producto_id: productoId,
      talle: t.talle.trim(),
      stock_disponible: Number(t.stock_disponible) || 0,
    }))

  if (variaciones.length > 0) {
    const { error: errIns } = await supabase.from('variaciones_stock').insert(variaciones)
    if (errIns) return { id: productoId, error: errIns.message }
  }

  return { id: productoId, error: null }
}

export async function eliminarProducto(id: string) {
  const { error } = await supabase.from('productos').delete().eq('id', id)
  return { error: error?.message ?? null }
}

export async function setProductoActivo(id: string, activo: boolean) {
  const { error } = await supabase.from('productos').update({ activo }).eq('id', id)
  return { error: error?.message ?? null }
}

// ============================================
// OUTFITS
// ============================================

export async function getOutfitsAdmin() {
  const { data, error } = await supabase
    .from('outfits')
    .select('*, outfit_items(*, producto:productos(*))')
    .order('created_at', { ascending: false })
  return { data: (data ?? []) as OutfitConItems[], error: error?.message ?? null }
}

export interface OutfitInput {
  id?: string
  nombre: string
  descripcion: string
  precio_combo: number
  imagen_portada: string
  activo: boolean
  producto_ids: string[]
}

export async function guardarOutfit(input: OutfitInput) {
  const payload = {
    nombre: input.nombre,
    descripcion: input.descripcion || null,
    precio_combo: input.precio_combo,
    imagen_portada: input.imagen_portada,
    activo: input.activo,
  }

  let outfitId = input.id ?? ''

  if (input.id) {
    const { error } = await supabase.from('outfits').update(payload).eq('id', input.id)
    if (error) return { id: null, error: error.message }
  } else {
    const { data, error } = await supabase.from('outfits').insert([payload]).select('id').single()
    if (error || !data) return { id: null, error: error?.message ?? 'No se pudo crear el outfit' }
    outfitId = data.id as string
  }

  const { error: errDel } = await supabase.from('outfit_items').delete().eq('outfit_id', outfitId)
  if (errDel) return { id: outfitId, error: errDel.message }

  const items = input.producto_ids.map((pid) => ({ outfit_id: outfitId, producto_id: pid }))
  if (items.length > 0) {
    const { error: errIns } = await supabase.from('outfit_items').insert(items)
    if (errIns) return { id: outfitId, error: errIns.message }
  }

  return { id: outfitId, error: null }
}

export async function eliminarOutfit(id: string) {
  const { error } = await supabase.from('outfits').delete().eq('id', id)
  return { error: error?.message ?? null }
}

export async function setOutfitActivo(id: string, activo: boolean) {
  const { error } = await supabase.from('outfits').update({ activo }).eq('id', id)
  return { error: error?.message ?? null }
}

// ============================================
// ORDENES
// ============================================

export type OrdenConItems = Orden & {
  orden_items: (OrdenItem & { producto: { nombre: string } | null })[]
}

export const ESTADOS_ORDEN = ['pendiente', 'pendiente_verificacion', 'pagado', 'enviado', 'entregado', 'cancelado'] as const
export type EstadoOrden = (typeof ESTADOS_ORDEN)[number]

export const ESTADO_LABEL: Record<EstadoOrden, string> = {
  pendiente: 'Pendiente de pago',
  pendiente_verificacion: 'Pendiente de verificación',
  pagado: 'Pagado',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

export async function getOrdenesAdmin() {
  const { data, error } = await supabase
    .from('ordenes')
    .select('*, orden_items(*, producto:productos(nombre))')
    .order('created_at', { ascending: false })
  return { data: (data ?? []) as OrdenConItems[], error: error?.message ?? null }
}

export async function actualizarEstadoOrden(id: string, estado: EstadoOrden) {
  // Al marcarla como pagada, el descuento de stock y el consumo del cupón
  // se ejecutan en la Edge Function `admin-estado-orden` (con service_role).
  // Esto evita revocar EXECUTE sobre descontar_stock() al navegador.
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return { error: 'Sesión de administrador no válida.' }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const res = await fetch(`${supabaseUrl}/functions/v1/admin-estado-orden`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ orden_id: id, estado }),
    })

    const payload = await res.json().catch(() => ({} as unknown))

    if (!res.ok || !(payload as { ok?: boolean }).ok) {
      const err = (payload as { error?: string })?.error ?? 'No se pudo actualizar el pedido.'
      return { error: err }
    }

    return { error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado al actualizar el pedido.'
    return { error: msg }
  }
}

export async function actualizarComprobanteOrden(id: string, comprobanteUrl: string) {
  const { error } = await supabase
    .from('ordenes')
    .update({ comprobante_url: comprobanteUrl, estado: 'pendiente_verificacion' })
    .eq('id', id)
  return { error: error?.message ?? null }
}

export const BUCKET_COMPROBANTES = 'comprobantes'

export async function subirComprobante(file: File, ordenId: string) {
  const ext = file.name.split('.').pop() || 'jpg'
  const nombre = `comprobantes/${ordenId}-${Date.now()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET_COMPROBANTES).upload(nombre, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })

  if (error) return { url: null, error: error.message }

  // El bucket es privado (migración 022): se guarda el path, no una URL pública.
  // Ver `comprobanteFirmado()` para abrirlo.
  return { url: nombre, error: null }
}

const EXPIRACION_COMPROBANTE_SEG = 300

/** Acepta un path (`comprobantes/x.png`) o una URL pública legacy. */
function pathDeComprobante(valor: string): string {
  const base = `${BUCKET_COMPROBANTES}/`
  if (valor.startsWith(base)) return valor

  try {
    const url = new URL(valor)
    const idx = url.pathname.indexOf(`/object/public/${base}`)
    if (idx !== -1) return decodeURIComponent(url.pathname.slice(idx + `/object/public/`.length))
  } catch {
    return valor
  }
  return valor
}

/**
 * Genera una signed URL corta para ver el comprobante. El bucket es privado y
 * la lectura la exige `es_admin()`, así que solo el panel puede obtenerla.
 */
export async function comprobanteFirmado(
  valor: string | null | undefined,
): Promise<{ url: string | null; error: string | null }> {
  if (!valor) return { url: null, error: 'La orden no tiene comprobante' }

  const { data, error } = await supabase.storage
    .from(BUCKET_COMPROBANTES)
    .createSignedUrl(pathDeComprobante(valor), EXPIRACION_COMPROBANTE_SEG)

  if (error) return { url: null, error: error.message }
  return { url: data.signedUrl, error: null }
}

// ============================================
// RESEÑAS
// ============================================

export type ResenaConProducto = Resena & { producto: { nombre: string } | null }

export async function getResenasAdmin() {
  const { data, error } = await supabase
    .from('resenas')
    .select('*, producto:productos(nombre)')
    .order('created_at', { ascending: false })
  return { data: (data ?? []) as ResenaConProducto[], error: error?.message ?? null }
}

export async function setResenaAprobada(id: string, aprobado: boolean) {
  const { error } = await supabase.from('resenas').update({ aprobado }).eq('id', id)
  return { error: error?.message ?? null }
}

export async function eliminarResena(id: string) {
  const { error } = await supabase.from('resenas').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ============================================
// FOTOS DE LA COMUNIDAD
// ============================================

export async function getComunidadFotosAdmin() {
  const { data, error } = await supabase
    .from('comunidad_fotos')
    .select('*')
    .order('orden', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
  return { data: (data ?? []) as ComunidadFoto[], error: error?.message ?? null }
}

export async function insertarComunidadFoto(input: {
  nombre_usuario: string
  imagen_url: string
  instagram_handle?: string | null
  orden?: number | null
}) {
  const { error } = await supabase
    .from('comunidad_fotos')
    .insert([{ ...input, aprobado: true }])
  return { error: error?.message ?? null }
}

export async function getComunidadFotosPublic() {
  const { data, error } = await supabase
    .from('comunidad_fotos')
    .select('*')
    .eq('aprobado', true)
    .order('orden', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
  return { data: (data ?? []) as ComunidadFoto[], error: error?.message ?? null }
}

export async function setComunidadFotoAprobada(id: string, aprobado: boolean) {
  const { error } = await supabase.from('comunidad_fotos').update({ aprobado }).eq('id', id)
  return { error: error?.message ?? null }
}

export async function eliminarComunidadFoto(id: string) {
  const { error } = await supabase.from('comunidad_fotos').delete().eq('id', id)
  return { error: error?.message ?? null }
}

// ============================================
// BANNERS (CARRUSEL HERO)
// ============================================

export interface BannerInput {
  imagen_url: string
  /** Versión vertical para mobile. Si queda vacía se usa imagen_url. */
  imagen_mobile?: string | null
  titulo?: string | null
  link_url?: string | null
}

export async function getBannersPublic() {
  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true })
  return { data: (data ?? []) as Banner[], error: error?.message ?? null }
}

export async function getBannersAdmin() {
  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .order('orden', { ascending: true })
  return { data: (data ?? []) as Banner[], error: error?.message ?? null }
}

export async function guardarBanners(items: BannerInput[]) {
  const { error: errDel } = await supabase.from('banners').delete()
  if (errDel) return { error: errDel.message }

  const limpios = items.filter((i) => i.imagen_url.trim() !== '')
  if (limpios.length === 0) return { error: null }

  const rows = limpios.map((item, orden) => ({
    imagen_url: item.imagen_url.trim(),
    imagen_mobile: item.imagen_mobile?.trim() || null,
    titulo: item.titulo?.trim() || null,
    link_url: item.link_url?.trim() || null,
    orden,
    activo: true,
  }))

  const { error } = await supabase.from('banners').insert(rows)
  return { error: error?.message ?? null }
}