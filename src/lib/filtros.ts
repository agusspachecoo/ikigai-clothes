import { ordenarTalles } from './talles'
import type { ProductoConStock } from '../types/database'

export const ORDENES_CATALOGO = [
  { valor: 'nuevos', label: 'Novedades' },
  { valor: 'precio-asc', label: 'Precio: menor a mayor' },
  { valor: 'precio-desc', label: 'Precio: mayor a menor' },
  { valor: 'descuento', label: 'Mayor descuento' },
  { valor: 'nombre', label: 'Alfabético' },
] as const

export type OrdenCatalogo = (typeof ORDENES_CATALOGO)[number]['valor']

export interface EstadoFiltros {
  orden: OrdenCatalogo
  talles: string[]
  precioMin: number | null
  precioMax: number | null
  soloConStock: boolean
}

export const FILTROS_INICIALES: EstadoFiltros = {
  orden: 'nuevos',
  talles: [],
  precioMin: null,
  precioMax: null,
  soloConStock: false,
}

/** Talles presentes en el catálogo, ordenados por nombre de prenda. */
export function tallesDelCatalogo(productos: ProductoConStock[]): string[] {
  const set = new Set<string>()
  for (const p of productos) for (const v of p.variaciones_stock) set.add(v.talle)
  return ordenarTalles([...set])
}

export function hayFiltrosActivos(estado: EstadoFiltros): boolean {
  return (
    estado.talles.length > 0 ||
    estado.precioMin != null ||
    estado.precioMax != null ||
    estado.soloConStock
  )
}
