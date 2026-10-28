import { describe, expect, it } from 'vitest'
import { tieneStock } from './talles'
import { outfitTieneStock } from './outfits'
import type { OutfitConItems, VariacionStock } from '../types/database'

describe('tieneStock', () => {
  it('devuelve false si no hay variaciones', () => {
    expect(tieneStock([])).toBe(false)
    expect(tieneStock(null)).toBe(false)
    expect(tieneStock(undefined)).toBe(false)
  })

  it('devuelve true si alguna variación tiene stock', () => {
    const variaciones: VariacionStock[] = [
      { id: '1', producto_id: 'p', talle: 'M', stock_disponible: 0 },
      { id: '2', producto_id: 'p', talle: 'L', stock_disponible: 2 },
    ]
    expect(tieneStock(variaciones)).toBe(true)
  })

  it('devuelve false si todo está en 0', () => {
    const variaciones: VariacionStock[] = [
      { id: '1', producto_id: 'p', talle: 'M', stock_disponible: 0 },
    ]
    expect(tieneStock(variaciones)).toBe(false)
  })
})

describe('outfitTieneStock', () => {
  it('devuelve false si no hay items', () => {
    const outfit = { outfit_items: [] } as unknown as OutfitConItems
    expect(outfitTieneStock(outfit)).toBe(false)
  })

  it('devuelve true solo si todas las prendas tienen stock', () => {
    const outfit = {
      outfit_items: [
        { producto: { variaciones_stock: [{ id: '1', producto_id: 'a', talle: 'M', stock_disponible: 1 }] } },
        { producto: { variaciones_stock: [{ id: '2', producto_id: 'b', talle: 'S', stock_disponible: 0 }, { id: '3', producto_id: 'b', talle: 'L', stock_disponible: 3 }] } },
      ],
    } as unknown as OutfitConItems
    expect(outfitTieneStock(outfit)).toBe(true)
  })

  it('devuelve false si alguna prenda sin stock', () => {
    const outfit = {
      outfit_items: [
        { producto: { variaciones_stock: [{ id: '1', producto_id: 'a', talle: 'M', stock_disponible: 1 }] } },
        { producto: { variaciones_stock: [{ id: '2', producto_id: 'b', talle: 'S', stock_disponible: 0 }] } },
      ],
    } as unknown as OutfitConItems
    expect(outfitTieneStock(outfit)).toBe(false)
  })
})
