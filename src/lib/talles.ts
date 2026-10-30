import type { VariacionStock } from '../types/database'

// Orden de respaldo si la lista maestra (`useTalles`) todavía no cargó o la
// tabla `talles` no está disponible. Con la migración 024 el orden real viene
// de la tabla, editable desde el panel.
const ORDEN_FALLBACK = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'UNICO', 'ÚNICO']

/**
 * Ordena los talles según la lista maestra; las talles numéricas que no estén
 * en la lista quedan al final, ordenadas de menor a mayor.
 */
export function ordenarTalles(talles: string[], orden?: string[]): string[] {
  const fuente = orden && orden.length > 0 ? orden : ORDEN_FALLBACK
  const indices = new Map(fuente.map((t, i) => [t.toUpperCase(), i]))

  return [...talles].sort((a, b) => {
    const ia = indices.get(a.toUpperCase())
    const ib = indices.get(b.toUpperCase())
    if (ia !== undefined && ib !== undefined) return ia - ib
    if (ia !== undefined) return -1
    if (ib !== undefined) return 1
    const na = Number(a)
    const nb = Number(b)
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
    return a.localeCompare(b, 'es')
  })
}

/** Talles del producto con stock, ordenados. */
export function tallesConStock(variaciones: VariacionStock[], orden?: string[]): string[] {
  return ordenarTalles(
    variaciones.filter((v) => (v.stock_disponible ?? 0) > 0).map((v) => v.talle),
    orden,
  )
}

/** Talles del producto, marcando cuáles tienen stock. */
export function tallesDisponibles(
  variaciones: Array<Pick<VariacionStock, 'talle' | 'stock_disponible'>>,
  orden?: string[],
): { talle: string; stock: number }[] {
  const vistos = new Map<string, number>()
  for (const v of variaciones) {
    vistos.set(v.talle, (vistos.get(v.talle) ?? 0) + (v.stock_disponible ?? 0))
  }
  return ordenarTalles([...vistos.keys()], orden).map((talle) => ({
    talle,
    stock: vistos.get(talle) ?? 0,
  }))
}

export function stockDeTalle(variaciones: VariacionStock[], talle: string): number {
  return (
    variaciones
      .filter((v) => v.talle === talle)
      .reduce((n, v) => n + (v.stock_disponible ?? 0), 0)
  )
}

/** Indica si el producto tiene al menos una variación con stock disponible. */
export function tieneStock(variaciones: VariacionStock[] | null | undefined): boolean {
  if (!variaciones || variaciones.length === 0) return false
  return variaciones.some((v) => (v.stock_disponible ?? 0) > 0)
}
