import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PedidosAdmin } from './PedidosAdmin'
import { comprobanteFirmado, getOrdenesAdmin } from '../../lib/adminApi'
import { IMAGEN_FALLBACK } from '../../lib/imagenes'

vi.mock('../../lib/adminApi', () => ({
  getOrdenesAdmin: vi.fn(),
  actualizarEstadoOrden: vi.fn(),
  comprobanteFirmado: vi.fn(),
  ESTADOS_ORDEN: [
    'pendiente',
    'pendiente_verificacion',
    'pagado',
    'enviado',
    'entregado',
    'cancelado',
  ],
  ESTADO_LABEL: {
    pendiente: 'Pendiente de pago',
    pendiente_verificacion: 'Pendiente de verificacion',
    pagado: 'Pagado',
    enviado: 'Enviado',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
  },
}))

const SIGNED_URL =
  'https://demo.supabase.co/storage/v1/object/sign/comprobantes/abc-123-456.jpg?token=token-demo&expiresIn=300'

const ORDEN = {
  id: '11111111-2222-3333-4444-555555555555',
  cliente_nombre: 'Martina Perez',
  cliente_email: 'martina@example.com',
  cliente_telefono: '111111111',
  cliente_dni: '12345678',
  direccion: 'Av. Siempre Viva 742',
  codigo_postal: '5000',
  metodo_pago: 'transferencia' as const,
  monto_total: 150000,
  costo_envio: 0,
  estado: 'pendiente' as const,
  estado_pago: 'pendiente' as const,
  estado_envio: 'pendiente' as const,
  comprobante_url: 'comprobantes/abc-123-456.jpg',
  cupon_codigo: null,
  descuento_cupon: 0,
  descuento_promociones: 0,
  descuento_outfit: 0,
  cupon_consumido: null,
  promociones_aplicadas: [],
  envio_detalle: null,
  created_at: '2026-10-01T12:00:00Z',
  orden_items: [],
}

describe('PedidosAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getOrdenesAdmin).mockResolvedValue({ data: [ORDEN], error: null })
    vi.mocked(comprobanteFirmado).mockResolvedValue({ url: SIGNED_URL, error: null })
  })

  it('muestra el comprobante con la URL normalizada y usa el fallback si falla', async () => {
    render(<PedidosAdmin />)

    fireEvent.click(await screen.findByRole('button', { name: 'Ver comprobante' }))

    const botones = Array.from(document.querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === 'Ver comprobante',
    )
    expect(botones.length).toBe(2)
    fireEvent.click(botones[botones.length - 1])

    await waitFor(() => expect(comprobanteFirmado).toHaveBeenCalled())

    const img = await waitFor(() => {
      const el = document.querySelector('img[alt="Comprobante de pago"]')
      expect(el).not.toBeNull()
      return el as HTMLImageElement
    })
    await waitFor(() => expect(img.getAttribute('src')).toBe(SIGNED_URL))

    fireEvent.error(img)
    await waitFor(() => expect(img.getAttribute('src')).toBe(IMAGEN_FALLBACK))
  })
})
