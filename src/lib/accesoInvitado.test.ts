import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('./supabase', () => ({
  supabase: { functions: { invoke } },
}))

import { consultarPedidoInvitado, reclamarPedidoInvitado } from './accesoInvitado'

const ORDEN_ID = '22222222-2222-4222-8222-222222222222'
const TOKEN = 'token-de-invitado'

describe('consultarPedidoInvitado', () => {
  beforeEach(() => invoke.mockReset())

  it('consulta con el token y conserva el token en el resumen devuelto', async () => {
    invoke.mockResolvedValue({
      data: {
        orden: {
          id: ORDEN_ID,
          metodo: 'transferencia',
          items: [],
          total: 10_000,
          estado: 'pendiente',
        },
      },
      error: null,
    })

    const { pedido, error } = await consultarPedidoInvitado(ORDEN_ID, TOKEN)

    expect(invoke).toHaveBeenCalledWith('acceso-invitado', {
      body: { action: 'consultar', ordenId: ORDEN_ID, ordenToken: TOKEN },
    })
    expect(error).toBeNull()
    expect(pedido?.ordenToken).toBe(TOKEN)
  })

  it('no manda ordenToken vacío', async () => {
    invoke.mockResolvedValue({ data: { orden: { id: ORDEN_ID } }, error: null })

    await consultarPedidoInvitado(ORDEN_ID, '')

    expect(invoke.mock.calls[0]?.[1].body).toEqual({
      action: 'consultar',
      ordenId: ORDEN_ID,
    })
  })

  it('devuelve el error de la función sin exponer un pedido vacío', async () => {
    invoke.mockResolvedValue({ data: { error: 'Pedido no encontrado.' }, error: null })

    const { pedido, error } = await consultarPedidoInvitado(ORDEN_ID, TOKEN)

    expect(pedido).toBeNull()
    expect(error).toBe('Pedido no encontrado.')
  })
})

describe('reclamarPedidoInvitado', () => {
  beforeEach(() => invoke.mockReset())

  it('pide reclamar y devuelve ok=true solo si la función lo confirma', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null })

    const res = await reclamarPedidoInvitado(ORDEN_ID)

    expect(invoke).toHaveBeenCalledWith('acceso-invitado', {
      body: { action: 'reclamar', ordenId: ORDEN_ID },
    })
    expect(res).toEqual({ ok: true, error: null })
  })

  it('acepta respuestas sin ok como fallo, no como éxito', async () => {
    invoke.mockResolvedValue({ data: {}, error: null })

    const res = await reclamarPedidoInvitado(ORDEN_ID)

    expect(res.ok).toBe(false)
  })
})
