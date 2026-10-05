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

export const DESCUENTO_OUTFIT_PCT = 0.05

/** Cantidad mínima de prendas para considerar que un outfit está completo. */
export const MIN_PRODUCTOS_OUTFIT = 2

export interface ItemOutfit {
  producto_id: string
  cantidad: number
  precio_unitario: number
}

export interface OutfitComposicion {
  producto_ids: string[]
}

/**
 * Ids de los productos que completan al menos un outfit entero en el carrito.
 *
 * Se devuelve un `Set` para que un producto compartido por dos outfits no
 * cuente dos veces. La presencia se evalúa por producto, sin importar el talle.
 */
export function productosEnOutfitsCompletos(
  items: ItemOutfit[],
  outfits: OutfitComposicion[],
): Set<string> {
  const enCarrito = new Set(items.map((i) => i.producto_id))
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
 *
 * `pct` es la fracción (0.05 = 5%). Por defecto usa DESCUENTO_OUTFIT_PCT.
 */
export function calcularDescuentoOutfit(
  items: ItemOutfit[],
  outfits: OutfitComposicion[],
  pct: number = DESCUENTO_OUTFIT_PCT,
): number {
  const porcentaje = Math.min(1, Math.max(0, Number(pct) || 0))
  if (porcentaje <= 0) return 0

  const incluidos = productosEnOutfitsCompletos(items, outfits)
  if (incluidos.size === 0) return 0

  const base = items
    .filter((i) => incluidos.has(i.producto_id))
    .reduce((n, i) => n + i.precio_unitario * i.cantidad, 0)

  return Math.round(base * porcentaje * 100) / 100
}
