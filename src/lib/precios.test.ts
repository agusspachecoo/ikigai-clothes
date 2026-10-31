import { describe, expect, it } from 'vitest'
import { porcentajeDesdeDescuentoTransferencia } from './precios'

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
