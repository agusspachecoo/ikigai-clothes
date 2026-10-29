// ============================================================
// IKIGAI CLOTHES - Descuento por outfit completo
// ============================================================
// Espejo de `supabase/functions/_shared/outfits.ts`. Se usa para mostrar el
// descuento en el carrito y el checkout; el pago siempre lo recalcula la Edge
// Function. Si cambiás la fórmula acá, cambiala también allá.
//
// Regla: si el carrito contiene TODOS los productos de un outfit activo
// (mínimo 2), esas prendas reciben 5% de descuento. No se aplica al subtotal
// completo para que un combo barato no descuente las prendas sueltas.

import { tieneStock } from './talles'
import { claveLinea } from './promociones'
import type { OutfitConItems } from '../types/database'

export const DESCUENTO_OUTFIT_PCT = 0.05

/** Cantidad mínima de prendas para considerar que un outfit está completo. */
export const MIN_PRODUCTOS_OUTFIT = 2

export interface ItemOutfit {
  producto_id: string
  talle?: string
  cantidad: number
  precio_unitario: number
}

export interface OutfitComposicion {
  producto_ids: string[]
}

/**
 * Ids de los productos que completan al menos un outfit entero en el carrito.
 */
export function productosEnOutfitsCompletos(
  items: ItemOutfit[],
  outfits: OutfitComposicion[],
): Set<string> {
  const enCarrito = new Set(items.map((item) => item.producto_id))
  const incluidos = new Set<string>()

  for (const outfit of outfits) {
    const ids = outfit.producto_ids.filter(Boolean)
    if (ids.length < MIN_PRODUCTOS_OUTFIT) continue
    if (ids.every((id) => enCarrito.has(id))) {
      for (const id of ids) incluidos.add(id)
    }
  }

  return incluidos
}

/**
 * Descuento por outfit, en pesos, redondeado a 2 decimales.
 */
export function calcularDescuentoOutfit(
  items: ItemOutfit[],
  outfits: OutfitComposicion[],
  pct: number = DESCUENTO_OUTFIT_PCT,
  unidadesConsumidas: Map<string, number> = new Map(),
): number {
  const porcentaje = Math.min(1, Math.max(0, Number(pct) || 0))
  if (porcentaje <= 0) return 0

  const incluidos = productosEnOutfitsCompletos(items, outfits)
  if (incluidos.size === 0) return 0

  const base = items
    .filter((i) => incluidos.has(i.producto_id))
    .reduce((n, i) => {
      const consumidas =
        unidadesConsumidas.get(
          claveLinea({ producto_id: i.producto_id, talle: i.talle ?? '' }),
        ) ?? 0
      return n + i.precio_unitario * Math.max(0, i.cantidad - consumidas)
    }, 0)

  return Math.round(base * porcentaje * 100) / 100
}

/** Verifica que todas las prendas del outfit tengan stock disponible. */
export function outfitTieneStock(outfit: OutfitConItems): boolean {
  if (!outfit.outfit_items || outfit.outfit_items.length === 0) return false
  return outfit.outfit_items.every((item) => {
    const producto = item.producto
    if (!producto) return false
    return tieneStock(producto.variaciones_stock)
  })
}
