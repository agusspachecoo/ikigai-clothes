import type { CartItem } from '../types/cart'

/**
 * Stock unitario: cada prenda física existe en 1 sola unidad. Dos entradas del
 * carrito nunca pueden competir por el mismo product_id, sin importar el talle.
 */
export interface Colision {
  producto_id: string
  /** Prenda del carrito que YA ocupa el lugar de la nueva. */
  itemEnCarrito: CartItem
  /** Si el conflicto viene de un outfit, qué outfit hay que sacar completo. */
  outfitEnCarritoId: string | null
  outfitEnCarritoNombre: string | null
}

/**
 * Devuelve todos los product_ids que ocupa un item del carrito.
 * - Prenda individual: `[item.producto_id]`
 * - Prenda de outfit: los ids de todas las prendas del combo (si vienen
 *   guardados en `outfit_product_ids`) o, en su defecto, la propia prenda.
 */
export function getContainedProductIds(item: CartItem): string[] {
  if (item.outfitId) {
    const ids = item.outfit_product_ids?.filter(Boolean)
    if (ids && ids.length > 0) return ids
  }
  return [item.producto_id]
}

/** Ids de producto de un item que se está por agregar (misma regla que el carrito). */
export function getNewItemProductIds(nuevo: {
  producto_id: string
  outfitId?: string | null
  outfit_product_ids?: string[]
}): string[] {
  if (nuevo.outfitId && nuevo.outfit_product_ids?.length) return nuevo.outfit_product_ids
  return [nuevo.producto_id]
}

/**
 * Cruza los ids del item nuevo contra los ids ya presentes en el carrito.
 * La comparación es SOLO por product_id: el talle no exime de la colisión
 * porque no hay stock para un segundo ejemplar.
 *
 * No muta nada: el llamador aborta la operación y abre el modal, o bien
 * reemplaza lo que colisiona si el usuario lo confirma.
 */
export function detectarColisiones(
  itemsEnCarrito: CartItem[],
  nuevo: {
    producto_id: string
    outfitId?: string | null
    outfit_product_ids?: string[]
  },
): Colision[] {
  const nuevosIds = new Set(getNewItemProductIds(nuevo))
  const colisiones: Colision[] = []
  // Una prenda de outfit ocupa varias filas del carrito y todas declaran la
  // misma lista aplanada. Se avisa una vez por prenda, no una por fila.
  const yaVistos = new Set<string>()

  for (const item of itemsEnCarrito) {
    for (const id of getContainedProductIds(item)) {
      if (!nuevosIds.has(id)) continue
      const clave = `${id}::${item.outfitId ?? ''}`
      if (yaVistos.has(clave)) continue
      yaVistos.add(clave)
      colisiones.push({
        producto_id: id,
        itemEnCarrito: item,
        outfitEnCarritoId: item.outfitId ?? null,
        outfitEnCarritoNombre: item.outfitNombre ?? null,
      })
    }
  }

  return colisiones
}

/**
 * Cuántos ids de outfit hay que descartar para liberar las colisiones.
 * Si alguna viene de un outfit, se saca el outfit completo.
 */
export function idsOutfitsARemover(colisiones: Colision[]): string[] {
  const ids = new Set<string>()
  for (const c of colisiones) {
    if (c.outfitEnCarritoId) ids.add(c.outfitEnCarritoId)
  }
  return [...ids]
}

/** Descripción legible para el modal de advertencia. */
export function descripcionColision(c: Colision): string {
  return `La prenda “${c.itemEnCarrito.nombre}” ya se encuentra en tu carrito.`
}

/** Texto del call-out cuando el conflicto viene de un look completo. */
export function descripcionColisionEnOutfit(c: Colision): string {
  return `La prenda “${c.itemEnCarrito.nombre}” ya se encuentra en tu carrito, como parte del look “${
    c.outfitEnCarritoNombre ?? 'Outfit'
  }”.`
}