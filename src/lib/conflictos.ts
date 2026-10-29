import type { CartItem } from '../types/cart'

export interface Colision {
  producto_id: string
  itemEnCarrito: CartItem
  outfitEnCarritoId: string | null
  outfitEnCarritoNombre: string | null
}

export interface Variante {
  producto_id: string
  talle: string
}

export function claveVariante(producto_id: string, talle: string): string {
  return `${producto_id}::${talle}`
}

export function detectarColisiones(
  itemsEnCarrito: CartItem[],
  nuevasVariantes: Variante[],
): Colision[] {
  const nuevas = new Set(
    nuevasVariantes
      .filter((v) => v.producto_id && v.talle)
      .map((v) => claveVariante(v.producto_id, v.talle)),
  )
  if (nuevas.size === 0) return []

  const colisiones: Colision[] = []
  const yaVistos = new Set<string>()

  for (const item of itemsEnCarrito) {
    if (!item.talle) continue
    if (!nuevas.has(claveVariante(item.producto_id, item.talle))) continue

    const clave = item.outfitId
      ? `outfit:${item.outfitId}`
      : `item:${claveVariante(item.producto_id, item.talle)}`
    if (yaVistos.has(clave)) continue
    yaVistos.add(clave)

    colisiones.push({
      producto_id: item.producto_id,
      itemEnCarrito: item,
      outfitEnCarritoId: item.outfitId ?? null,
      outfitEnCarritoNombre: item.outfitNombre ?? null,
    })
  }

  return colisiones
}

export function idsOutfitsARemover(colisiones: Colision[]): string[] {
  const ids = new Set<string>()
  for (const c of colisiones) {
    if (c.outfitEnCarritoId) ids.add(c.outfitEnCarritoId)
  }
  return [...ids]
}

export function descripcionColision(c: Colision): string {
  return `La prenda “${c.itemEnCarrito.nombre}” talle ${c.itemEnCarrito.talle} ya se encuentra en tu carrito.`
}

export function descripcionColisionEnOutfit(c: Colision): string {
  return (
    `La prenda “${c.itemEnCarrito.nombre}” talle ${c.itemEnCarrito.talle} ` +
    `ya se encuentra en tu carrito, como parte del look “${c.outfitEnCarritoNombre ?? 'Outfit'}”.`
  )
}
