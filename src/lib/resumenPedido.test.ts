import { beforeEach, describe, expect, it } from 'vitest'
import {
  guardarResumen,
  leerResumen,
  podarResumen,
  type ResumenPedido,
} from './resumenPedido'

const base: ResumenPedido = {
  id: 'orden-1',
  metodo: 'transferencia',
  items: [],
  subtotal: 10_000,
  descuentoTransferencia: 1_000,
  descuentoCupon: 0,
  descuentoOutfit: 0,
  costoEnvio: 3_500,
  envioGratis: false,
  total: 12_500,
  cuponCodigo: null,
  envioLabel: 'Envío a domicilio',
  retiro: false,
  nombre: 'Ana',
  email: 'ana@example.com',
  ordenToken: 'token-invitado',
}

describe('resumenPedido', () => {
  beforeEach(() => sessionStorage.clear())

  it('guarda y recupera el token de acceso del invitado', () => {
    guardarResumen(base)

    expect(leerResumen('orden-1')?.ordenToken).toBe('token-invitado')
  })

  it('tolera resúmenes viejos sin token', () => {
    const viejo: Partial<ResumenPedido> = { ...base }
    delete viejo.ordenToken
    sessionStorage.setItem('ikigai:pedido:orden-1', JSON.stringify(viejo))

    expect(leerResumen('orden-1')?.ordenToken).toBeNull()
  })

  it('usa el último resumen cuando la URL no trae external_reference', () => {
    guardarResumen(base)

    expect(leerResumen('')?.id).toBe('orden-1')
  })

  it('poda solo los resúmenes viejos y conserva el actual', () => {
    guardarResumen(base)
    guardarResumen({ ...base, id: 'orden-vieja' })

    expect(podarResumen('orden-1')).toBe(1)
    expect(leerResumen('orden-vieja')).toBeNull()
    expect(leerResumen('orden-1')?.id).toBe('orden-1')
  })
})
