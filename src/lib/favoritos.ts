import { supabase } from './supabase'
import type { ProductoConStock } from '../types/database'

/**
 * Favoritos / wishlist.
 *
 * Es de las pocas tablas atadas a `auth.uid()` por RLS (ver 023): leer,
 * insertar o borrar exige sesión y solo sobre las filas propias. Por eso
 * todas las funciones reciben `userId` y filtran por él, aunque la política
 * ya lo fuerce: así el error es explícito y no un resultado vacío silencioso.
 */

export async function listarIdsFavoritos(
  userId: string,
): Promise<{ ids: string[]; error: string | null }> {
  const { data, error } = await supabase
    .from('favoritos')
    .select('producto_id')
    .eq('usuario_id', userId)

  if (error) return { ids: [], error: error.message }
  return { ids: (data ?? []).map((r) => String(r.producto_id)), error: null }
}

export async function agregarFavorito(
  userId: string,
  productoId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('favoritos').upsert(
    { usuario_id: userId, producto_id: productoId },
    { onConflict: 'usuario_id,producto_id', ignoreDuplicates: true },
  )
  return { error: error?.message ?? null }
}

export async function quitarFavorito(
  userId: string,
  productoId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('favoritos')
    .delete()
    .eq('usuario_id', userId)
    .eq('producto_id', productoId)
  return { error: error?.message ?? null }
}

/**
 * Productos favoritos con sus talles, listos para pintar en el perfil.
 *
 * Se trae el producto entero (con `variaciones_stock`) por el FK
 * `favoritos.producto_id → productos.id`, así la card reutiliza el stock real.
 */
export async function listarProductosFavoritos(
  userId: string,
): Promise<{ productos: ProductoConStock[]; error: string | null }> {
  const { data, error } = await supabase
    .from('favoritos')
    .select('producto_id, created_at, producto:productos(*, variaciones_stock(*))')
    .eq('usuario_id', userId)
    .order('created_at', { ascending: false })

  if (error) return { productos: [], error: error.message }

  const productos = (data ?? [])
    .map((r) => (r as unknown as { producto: ProductoConStock | null }).producto)
    .filter((p): p is ProductoConStock => p !== null)

  return { productos, error: null }
}
