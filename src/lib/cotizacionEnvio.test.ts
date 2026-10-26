import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CartItem } from '../types/cart'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('./supabase', () => ({
  supabase: { functions: { invoke } },
}))

import { cotizarEnvio } from './cotizacionEnvio'

const item: CartItem = {
  producto_id: '11111111-1111-4111-8111-111111111111',
  nombre: 'Remera',
  imagen: '',
  talle: 'M',
  precio_unitario: 10_000,
  cantidad: 2,
}

describe('cotizarEnvio', () => {
  beforeEach(() => {
    invoke.mockReset()
  })

  it('manda solo producto, talle y cantidad; no confía en precios del navegador', async () => {
    invoke.mockResolvedValue({
      data: {
        codigo_postal: '5000',
        opciones: [
          {
            id_servicio: 'micorreo-d',
            costo: 5800,
            quote_token: 'firma',
          },
        ],
        mock: false,
      },
      error: null,
    })

    const res = await cotizarEnvio('5000', [item])

    expect(invoke).toHaveBeenCalledWith('cotizar-envio', {
      body: {
        codigo_postal: '5000',
        items: [
          {
            producto_id: item.producto_id,
            talle: 'M',
            cantidad: 2,
          },
        ],
        subtotal: 20_000,
      },
    })
    expect(res.opciones[0]?.quote_token).toBe('firma')
  })

  it('permite pasar el subtotal con descuentos para el umbral de envío gratis', async () => {
    invoke.mockResolvedValue({ data: { opciones: [], mock: true }, error: null })

    await cotizarEnvio('5000', [item], 15_000)

    expect(invoke.mock.calls[0]?.[1].body.subtotal).toBe(15_000)
  })

  it('devuelve un error visible y no opciones ante un CP corto', async () => {
    const res = await cotizarEnvio('12', [item])

    expect(invoke).not.toHaveBeenCalled()
    expect(res.opciones).toEqual([])
    expect(res.error).toMatch(/al menos 4 dígitos/)
  })

  it('propaga el mensaje de error de la Edge Function', async () => {
    invoke.mockResolvedValue({
      data: { error: 'No hay cobertura.' },
      error: null,
    })

    const res = await cotizarEnvio('9999', [item])

    expect(res.opciones).toEqual([])
    expect(res.error).toBe('No hay cobertura.')
  })
})
