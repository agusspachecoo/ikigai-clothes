import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { CartItem } from '../types/cart'
import { CartContext } from './cart'

const STORAGE_KEY = 'ikigai-cart'

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as CartItem[]) : []
    } catch {
      return []
    }
  })

  const [carritoAbierto, setCarritoAbierto] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  function agregarItem(item: Omit<CartItem, 'cantidad'> & { cantidad?: number }) {
    const cantidad = item.cantidad ?? 1
    setItems((prev) => {
      const existente = prev.find(
        (i) => i.producto_id === item.producto_id && i.talle === item.talle,
      )
      if (existente) {
        return prev.map((i) =>
          i.producto_id === item.producto_id && i.talle === item.talle
            ? { ...i, cantidad: i.cantidad + cantidad }
            : i,
        )
      }
      return [
        ...prev,
        {
          producto_id: item.producto_id,
          nombre: item.nombre,
          imagen: item.imagen,
          talle: item.talle,
          precio_unitario: item.precio_unitario,
          cantidad,
        },
      ]
    })
  }

  function actualizarCantidad(productoId: string, talle: string, cantidad: number) {
    setItems((prev) =>
      prev.map((i) =>
        i.producto_id === productoId && i.talle === talle
          ? { ...i, cantidad: Math.max(1, cantidad) }
          : i,
      ),
    )
  }

  function eliminarItem(productoId: string, talle: string) {
    setItems((prev) => prev.filter((i) => !(i.producto_id === productoId && i.talle === talle)))
  }

  function vaciar() {
    setItems([])
  }

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.cantidad, 0),
      total: items.reduce((n, i) => n + i.cantidad * i.precio_unitario, 0),
      agregarItem,
      actualizarCantidad,
      eliminarItem,
      vaciar,
      carritoAbierto,
      setCarritoAbierto,
    }),
    [items, carritoAbierto],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}