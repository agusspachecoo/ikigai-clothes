import { describe, expect, it } from 'vitest'
import { calcularDescuentoOutfit, productosEnOutfitsCompletos } from './outfits'
import { claveLinea } from './promociones'

const outfits = [{ producto_ids: ['remera', 'pantalon'] }]
const items = [
  { producto_id: 'remera', talle: 'M', cantidad: 1, precio_unitario: 20_000 },
  { producto_id: 'pantalon', talle: '40', cantidad: 1, precio_unitario: 40_000 },
]

describe('descuento outfit', () => {
  it('aplica 5% solo a las prendas del look completo', () => {
    expect(calcularDescuentoOutfit(items, outfits)).toBe(3_000)
    expect(productosEnOutfitsCompletos(items, outfits)).toEqual(
      new Set(['remera', 'pantalon']),
    )
  })

  it('excluye las unidades consumidas por una promoción', () => {
    const consumidas = new Map([
      [claveLinea({ producto_id: 'remera', talle: 'M' }), 1],
    ])

    expect(calcularDescuentoOutfit(items, outfits, 0.05, consumidas)).toBe(2_000)
  })

  it('no considera completo el look si una prenda quedó toda consumida', () => {
    const consumidas = new Map([
      [claveLinea({ producto_id: 'remera', talle: 'M' }), 1],
      [claveLinea({ producto_id: 'pantalon', talle: '40' }), 1],
    ])

    expect(productosEnOutfitsCompletos(items, outfits).size).toBe(2)
    expect(calcularDescuentoOutfit(items, outfits, 0.05, consumidas)).toBe(0)
  })
})
