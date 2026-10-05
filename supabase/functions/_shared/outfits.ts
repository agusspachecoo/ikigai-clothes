// ============================================================
// IKIGAI CLOTHES - Descuento por outfit completo
// ============================================================
// Regla de negocio: si el carrito contiene TODOS los productos de un outfit
// activo (mínimo 2), esas prendas reciben 5% de descuento.
//
// El descuento se aplica solo a los productos que forman el outfit, no al
// subtotal completo: si no, agregar un combo barato descontaría todo el
// carrito, incluidas las prendas que no pertenecen a ningún look.
//
// Réplica exacta de `src/lib/outfits.ts`. Si cambiás la fórmula de un lado,
// cambiala del otro: el total del carrito y el de la orden tienen que coincidir
// o Mercado Pago rechaza el pago.

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
 * cuente dos veces. La presencia se evalúa por producto, sin importar el talle:
 * si el user tiene las dos prendas (en cualquier talle) el combo está completo.
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
