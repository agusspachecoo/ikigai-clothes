import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('./supabase', () => ({
  supabase: { functions: { invoke } },
}))

import { crearPreferenciaMP } from './mercadopago'

const ORDEN_ID = '33333333-3333-4333-8333-333333333333'

describe('crearPreferenciaMP', () => {
  beforeEach(() => invoke.mockReset())

  it('manda solo el ID de la orden y el token; nunca ítems ni precios', async () => {
    invoke.mockResolvedValue({
      data: { init_point: 'https://mercadopago.example/checkout' },
      error: null,
    })

    const res = await crearPreferenciaMP(ORDEN_ID, 'token')

    expect(invoke).toHaveBeenCalledWith('create-preference', {
      body: { ordenId: ORDEN_ID, ordenToken: 'token' },
    })
    expect(
      Object.keys(invoke.mock.calls[0]![1].body as Record<string, unknown>).sort(),
    ).toEqual(['ordenId', 'ordenToken'])
    expect(res.error).toBeNull()
  })

  it('omite el token si la orden se creó con sesión', async () => {
    invoke.mockResolvedValue({ data: { init_point: 'https://x' }, error: null })

    await crearPreferenciaMP(ORDEN_ID)

    expect(invoke.mock.calls[0]?.[1].body).toEqual({ ordenId: ORDEN_ID })
  })

  it('no devuelve init_point si el backend responde error', async () => {
    invoke.mockResolvedValue({ data: { error: 'La orden ya está paga.' }, error: null })

    const res = await crearPreferenciaMP(ORDEN_ID)

    expect(res.init_point).toBeNull()
    expect(res.error).toBe('La orden ya está paga.')
  })
})
