import { createContext, useContext } from 'react'
import type { CartItem } from '../types/cart'

export interface CartContextValue {
  items: CartItem[]
  count: number
  total: number
  agregarItem: (item: Omit<CartItem, 'cantidad'> & { cantidad?: number }) => void
  actualizarCantidad: (productoId: string, talle: string, cantidad: number) => void
  eliminarItem: (productoId: string, talle: string) => void
  vaciar: () => void
  carritoAbierto: boolean
  setCarritoAbierto: (abierto: boolean) => void
}

export const CartContext = createContext<CartContextValue | null>(null)

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider')
  return ctx
}