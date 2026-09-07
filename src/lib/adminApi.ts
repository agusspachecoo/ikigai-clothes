import { supabase } from './supabase'
import { slugify } from './categorias'
import type { ProductoConStock, OutfitConItems, Orden, OrdenItem, Resena } from '../types/database'
import type { ComunidadFoto, Categoria } from '../types/database'

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

export async function crearCategoria(nombre: string) {
  const base = slugify(nombre) || 'categoria'

  const { data } = await supabase.from('categorias').select('slug')
  const usados = new Set((data ?? []).map((x) => x.slug))

  let slug = base
  let sufijo = 2
  while (usados.has(slug)) slug = `${base}-${sufijo++}`

  const { error } = await supabase.from('categorias').insert([{ nombre, slug }])
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

export async function subirImagen(file: File, carpeta: 'productos' | 'outfits' | 'reviews' | 'comunidad' = 'productos') {
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
  imagenes: string[]
  activo: boolean
  talles: TalleInput[]
}

export async function guardarProducto(input: ProductoInput) {
  const payload = {
    nombre: input.nombre,
    descripcion: input.descripcion || null,
    categoria: input.categoria,
    precio: input.precio,
    precio_transferencia: input.precio_transferencia || null,
    imagenes: input.imagenes.filter(Boolean),
    activo: input.activo,
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

export const ESTADOS_ORDEN = ['pendiente', 'pagado', 'enviado', 'cancelado'] as const
export type EstadoOrden = (typeof ESTADOS_ORDEN)[number]

export const ESTADO_LABEL: Record<EstadoOrden, string> = {
  pendiente: 'Pendiente de pago',
  pagado: 'Pagado',
  enviado: 'Enviado',
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
  const { error } = await supabase.from('ordenes').update({ estado }).eq('id', id)
  return { error: error?.message ?? null }
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