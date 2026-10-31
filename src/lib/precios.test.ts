import { describe, expect, it } from 'vitest'
import {
  porcentajeDesdeDescuentoTransferencia,
  precioTransferenciaProducto,
} from './precios'

describe('porcentajeDesdeDescuentoTransferencia', () => {
  it('muestra el mismo numero que la config global (20% → 20)', () => {
    expect(porcentajeDesdeDescuentoTransferencia(0.2)).toBe(20)
  })

  it('convierte fracciones con decimales sin redondear de mas', () => {
    expect(porcentajeDesdeDescuentoTransferencia(0.1)).toBe(10)
    expect(porcentajeDesdeDescuentoTransferencia(0.155)).toBe(15.5)
  })

  it('sin descuento devuelve 0', () => {
    expect(porcentajeDesdeDescuentoTransferencia(0)).toBe(0)
  })

  it('un descuento del 100% devuelve 100', () => {
    expect(porcentajeDesdeDescuentoTransferencia(1)).toBe(100)
  })

  it('valores invalidos devuelven 0', () => {
    expect(porcentajeDesdeDescuentoTransferencia(Number.NaN)).toBe(0)
  })
})

describe('precioTransferenciaProducto', () => {
  it('prioriza el precio de transferencia guardado en la base', () => {
    expect(precioTransferenciaProducto(42000, 50000, 0.2)).toBe(42000)
  })

  it('ignora el descuento global si el producto tiene precio propio', () => {
    expect(precioTransferenciaProducto(45000, 50000, 0.5)).toBe(45000)
  })

  it('calcula con el descuento global si el campo es nulo', () => {
    expect(precioTransferenciaProducto(null, 50000, 0.2)).toBe(40000)
  })

  it('calcula con el descuento global si el campo esta vacio o en 0', () => {
    expect(precioTransferenciaProducto(0, 50000, 0.2)).toBe(40000)
    expect(precioTransferenciaProducto(undefined, 50000, 0.2)).toBe(40000)
  })
})
