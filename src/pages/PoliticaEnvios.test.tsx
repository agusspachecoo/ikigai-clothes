import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { useTienda } from '../context/tienda'
import { PoliticaEnvios } from './PoliticaEnvios'

vi.mock('../context/tienda', () => ({
  useTienda: vi.fn(),
}))

vi.mock('../hooks/useSeo', () => ({
  useSeo: vi.fn(),
}))

const CONFIG = {
  umbral_envio_gratis: 150000,
  envio_gratis_activo: true,
  descuento_transferencia: 0.2,
  cuotas_sin_interes: 6,
  whatsapp: '5493755732335',
  direccion: 'Mosconi 331, Oberá, Misiones',
  horario_atencion: 'Lun a Sáb · 10 a 20 hs',
}

describe('PoliticaEnvios', () => {
  it('explica el cálculo, el envío gratis y los medios de pago configurados', () => {
    vi.mocked(useTienda).mockReturnValue(CONFIG as never)

    render(
      <MemoryRouter>
        <PoliticaEnvios />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Política de Envíos' })).toBeInTheDocument()
    expect(screen.getByText(/Calculá el costo exacto por código postal/)).toBeInTheDocument()
    expect(screen.getByText(/En compras desde/)).toBeInTheDocument()
    expect(screen.getByText('$150.000')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Mercado Pago' })).toBeInTheDocument()
    expect(screen.getByText(/6 cuotas sin interés/)).toBeInTheDocument()
    expect(screen.getByText(/20% de descuento/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'política de cambios y devoluciones' })).toHaveAttribute(
      'href',
      '/devoluciones',
    )
  })
})
