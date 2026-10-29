import { describe, expect, it } from 'vitest'
import type { CartItem } from '../types/cart'
import { detectarColisiones, idsOutfitsARemover } from './conflictos'

function item(parcial: Partial<CartItem> & Pick<CartItem, 'producto_id' | 'talle'>): CartItem {
  return {
    nombre: parcial.producto_id,
    imagen: '',
    precio_unitario: 10_000,
    cantidad: 1,
    ...parcial,
  }
}

describe('conflictos del carrito', () => {
  it('no colisiona si cambia el talle', () => {
    const carrito = [item({ producto_id: 'remera', talle: 'M' })]

    expect(detectarColisiones(carrito, [{ producto_id: 'remera', talle: 'L' }])).toEqual([])
  })

  it('detecta la misma variante', () => {
    const carrito = [item({ producto_id: 'remera', talle: 'M' })]

    expect(detectarColisiones(carrito, [{ producto_id: 'remera', talle: 'M' }])).toHaveLength(1)
  })

  it('agrupa las colisiones de un mismo look', () => {
    const carrito = [
      item({ producto_id: 'remera', talle: 'M', outfitId: 'look-1' }),
      item({ producto_id: 'pantalon', talle: '40', outfitId: 'look-1' }),
    ]

    const colisiones = detectarColisiones(carrito, [
      { producto_id: 'remera', talle: 'M' },
      { producto_id: 'pantalon', talle: '40' },
    ])

    expect(colisiones).toHaveLength(1)
    expect(idsOutfitsARemover(colisiones)).toEqual(['look-1'])
  })
})
