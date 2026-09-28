import type { VariacionStock } from '../types/database'

const ORDEN = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'UNICO', 'ÚNICO']

/** Ordena las talles por nombre de prenda; las numéricas quedan al final. */
export function ordenarTalles(talles: string[]): string[] {
  return [...talles].sort((a, b) => {
    const ia = ORDEN.indexOf(a.toUpperCase())
    const ib = ORDEN.indexOf(b.toUpperCase())
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    const na = Number(a)
    const nb = Number(b)
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
    return a.localeCompare(b, 'es')
  })
}

/** Talles del producto con stock, ordenados. */
export function tallesConStock(variaciones: VariacionStock[]): string[] {
  return ordenarTalles(
    variaciones.filter((v) => (v.stock_disponible ?? 0) > 0).map((v) => v.talle),
  )
}

/** Talles del producto, marcando cuáles tienen stock. */
export function tallesDisponibles(variaciones: VariacionStock[]): { talle: string; stock: number }[] {
  const vistos = new Map<string, number>()
  for (const v of variaciones) {
    vistos.set(v.talle, (vistos.get(v.talle) ?? 0) + (v.stock_disponible ?? 0))
  }
  return ordenarTalles([...vistos.keys()]).map((talle) => ({ talle, stock: vistos.get(talle) ?? 0 }))
}

export function stockDeTalle(variaciones: VariacionStock[], talle: string): number {
  return (
    variaciones
      .filter((v) => v.talle === talle)
      .reduce((n, v) => n + (v.stock_disponible ?? 0), 0)
  )
}
