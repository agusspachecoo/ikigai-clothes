import { createContext, useContext } from 'react'
import type { CartItem } from '../types/cart'
import type { CuponAplicado } from '../lib/cupones'
import type { Colision } from '../lib/conflictos'

/** Item nuevo tal como lo declara la UI, antes de validarlo contra el carrito. */
export type ItemNuevo = Omit<CartItem, 'cantidad'> & { cantidad?: number }

/** Detalle necesario para construir los CartItem de un outfit. */
export type DetallePrenda = {
  nombre: string
  imagen: string
  precio_unitario: number
}

export type ResultadoValidacion =
  | { ok: true }
  | { ok: false; colisiones: Colision[] }

export interface CartContextValue {
  items: CartItem[]
  count: number
  total: number
  /**
   * Agrega una prenda validando el stock unitario. Si el product_id ya está en
   * el carrito (suelto o dentro de un look) NO muta el estado: devuelve las
   * colisiones para que la UI abra el ConflictModal.
   */
  intentarAgregar: (nuevo: ItemNuevo) => ResultadoValidacion
  /** Reemplaza lo que colisiona y recién ahí agrega la prenda. */
  reemplazarConflictosYAgregar: (nuevo: ItemNuevo, colisiones: Colision[]) => void
  /** Agrega un combo completo como unidad transaccional. */
  intentarAgregarOutfit: (
    outfitId: string,
    outfitNombre: string,
    prendas: Array<{ producto_id: string; talle: string }>,
    detalle: Map<string, DetallePrenda>,
  ) => ResultadoValidacion
  /** Reemplaza los conflictos y agrega el combo completo. */
  reemplazarConflictosYAgregarOutfit: (
    outfitId: string,
    outfitNombre: string,
    prendas: Array<{ producto_id: string; talle: string }>,
    detalle: Map<string, DetallePrenda>,
    colisiones: Colision[],
  ) => void
  eliminarItem: (productoId: string, talle: string) => void
  removerOutfitCompleto: (outfitId: string) => void
  vaciar: () => void
  carritoAbierto: boolean
  setCarritoAbierto: (abierto: boolean) => void
  /** Cupón aplicado (se revalida contra el backend al pagar) */
  cupon: CuponAplicado | null
  /** Descuento del cupón recalculado sobre el subtotal actual */
  descuentoCupon: number
  /** Descuento por outfit completo (5% de las prendas del combo) */
  descuentoOutfit: number
  /** Total a cobrar: subtotal - descuento outfit - descuento del cupón */
  totalConDescuento: number
  aplicarCupon: (cupon: CuponAplicado) => void
  quitarCupon: () => void
}

export const CartContext = createContext<CartContextValue | null>(null)

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider')
  return ctx
}