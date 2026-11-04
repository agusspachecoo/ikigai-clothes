import { describe, expect, it } from 'vitest'
import {
  porcentajeAhorroTransferencia,
  porcentajeDesdeDescuentoTransferencia,
  precioListaDesdeTransferencia,
  precioTransferencia,
  precioTransferenciaProducto,
  tienePrecioTransferenciaPropio,
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

describe('precioListaDesdeTransferencia', () => {
  it('invierte el descuento global para obtener el precio de lista', () => {
    expect(precioListaDesdeTransferencia(40000, 0.2)).toBe(50000)
    expect(precioListaDesdeTransferencia(49000, 0.2)).toBe(61250)
    expect(precioListaDesdeTransferencia(45000, 0.1)).toBe(50000)
  })

  it('devuelve el mismo precio si el descuento es cero', () => {
    expect(precioListaDesdeTransferencia(40000, 0)).toBe(40000)
  })

  it('redondea a dos decimales', () => {
    expect(precioListaDesdeTransferencia(40000, 0.155)).toBe(47337.28)
  })

  it('hace round-trip con precioTransferencia', () => {
    const lista = precioListaDesdeTransferencia(40000, 0.2)
    expect(precioTransferencia(lista, 0.2)).toBe(40000)
  })

  it('devuelve 0 para precios inválidos y soporta descuentos inválidos', () => {
    expect(precioListaDesdeTransferencia(0, 0.2)).toBe(0)
    expect(precioListaDesdeTransferencia(Number.NaN, 0.2)).toBe(0)
    expect(precioListaDesdeTransferencia(40000, Number.NaN)).toBe(40000)
    expect(precioListaDesdeTransferencia(40000, 1)).toBe(40000)
    expect(precioListaDesdeTransferencia(40000, 1.5)).toBe(40000)
  })
})

describe('tienePrecioTransferenciaPropio', () => {
  it('solo acepta valores numéricos mayores a cero', () => {
    expect(tienePrecioTransferenciaPropio(40000)).toBe(true)
    expect(tienePrecioTransferenciaPropio(0)).toBe(false)
    expect(tienePrecioTransferenciaPropio(null)).toBe(false)
    expect(tienePrecioTransferenciaPropio(undefined)).toBe(false)
    expect(tienePrecioTransferenciaPropio(Number.NaN)).toBe(false)
  })
})

describe('precioTransferenciaProducto', () => {
  it('aplica el porcentaje global cuando el producto no define un precio propio', () => {
    expect(precioTransferenciaProducto(50000, 0.2)).toBe(40000)
    expect(precioTransferenciaProducto(50000, 0.5)).toBe(25000)
  })

  it('prioriza el precio de transferencia exacto guardado en el producto', () => {
    expect(precioTransferenciaProducto(48000, 0.2, 40000)).toBe(40000)
  })

  it('ignora precios propios nulos, cero o inválidos y usa el porcentaje global', () => {
    expect(precioTransferenciaProducto(48000, 0.2, null)).toBe(38400)
    expect(precioTransferenciaProducto(48000, 0.2, 0)).toBe(38400)
    expect(precioTransferenciaProducto(48000, 0.2, Number.NaN)).toBe(38400)
  })
})

describe('porcentajeAhorroTransferencia', () => {
  it('calcula el porcentaje real sobre el precio mostrado', () => {
    expect(porcentajeAhorroTransferencia(48000, 40000)).toBe(16.67)
    expect(porcentajeAhorroTransferencia(50000, 25000)).toBe(50)
  })

  it('devuelve 0 cuando no hay ahorro o los valores no son válidos', () => {
    expect(porcentajeAhorroTransferencia(48000, 48000)).toBe(0)
    expect(porcentajeAhorroTransferencia(48000, 50000)).toBe(0)
    expect(porcentajeAhorroTransferencia(0, 40000)).toBe(0)
  })
})
