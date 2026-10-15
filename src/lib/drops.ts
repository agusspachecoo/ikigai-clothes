import type { ProductoConStock } from '../types/database'

/**
 * Relación `drops` que se embebe en las consultas públicas de productos.
 * Trae la fecha de lanzamiento para poder descartar en el frontend los
 * productos de drops futuros aunque la RLS no los oculte todavía.
 */
export const DROP_EMBED = 'drop:drops(id, fecha_lanzamiento, activo)'

/** `true` si el producto pertenece a un drop activo que aún no se lanzó. */
export function esDropFuturo(producto: Pick<ProductoConStock, 'drop'>): boolean {
  const drop = producto.drop
  if (!drop || !drop.activo) return false
  const fecha = new Date(drop.fecha_lanzamiento).getTime()
  return Number.isFinite(fecha) && fecha > Date.now()
}

/**
 * Descarta los productos de drops futuros de una lista pública. De esta forma
 * el catálogo nunca muestra el nombre/precio real de un lanzamiento pendiente:
 * esos productos se agregan aparte, ya enmascarados, vía `productos_proximos()`.
 */
export function filtrarDropsFuturos(productos: ProductoConStock[]): ProductoConStock[] {
  return productos.filter((p) => !esDropFuturo(p))
}
