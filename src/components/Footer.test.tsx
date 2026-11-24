import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTienda } from '../context/tienda'
import { Footer } from './Footer'

vi.mock('../context/tienda', () => ({
  useTienda: vi.fn(),
}))

const CONFIG = {
  umbral_envio_gratis: 150000,
  envio_gratis_activo: true,
  descuento_transferencia: 0.2,
  cuotas_sin_interes: 6,
  whatsapp: '5493755732335',
  email_contacto: 'ikigaiclothes.contacto@gmail.com',
  instagram: 'https://www.instagram.com/ikigai_clothess/',
  nombre_tienda: 'IKIGAI CLOTHES',
  direccion: 'Mosconi 331, Oberá, Misiones',
  horario_atencion: 'Lun a Sáb · 10 a 20 hs',
  razon_social: 'IKIGAI CLOTHES',
  cuit: '',
  data_fiscal_url: '',
  imagen_showroom: '',
}

function renderFooter() {
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  )
}

describe('Footer', () => {
  beforeEach(() => {
    vi.mocked(useTienda).mockReturnValue({ ...CONFIG } as never)
  })

  it('destaca WhatsApp y muestra horario y dirección configurados', () => {
    renderFooter()

    expect(screen.getByRole('link', { name: /atención directa por whatsapp/i })).toHaveAttribute(
      'href',
      'https://wa.me/5493755732335',
    )
    expect(screen.getByText('+54 9 3755 73-2335')).toBeInTheDocument()
    expect(screen.getByText('Lun a Sáb · 10 a 20 hs')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mosconi 331, Oberá, Misiones' })).toBeInTheDocument()
  })

  it('muestra enlaces visibles a envíos, cambios y privacidad', () => {
    renderFooter()

    expect(screen.getByRole('link', { name: 'Política de Envíos' })).toHaveAttribute(
      'href',
      '/politica-de-envios',
    )
    expect(screen.getByRole('link', { name: 'Cambios y Devoluciones' })).toHaveAttribute(
      'href',
      '/devoluciones',
    )
    expect(screen.getByRole('link', { name: 'Envíos' })).toHaveAttribute(
      'href',
      '/politica-de-envios',
    )
    expect(screen.getByRole('link', { name: 'Privacidad' })).toHaveAttribute(
      'href',
      '/politica-de-privacidad',
    )
  })

  it('muestra logos reconocibles de medios de pago en lugar de etiquetas genéricas', () => {
    renderFooter()

    const grupo = screen.getByRole('group', { name: 'Medios de pago aceptados' })
    expect(within(grupo).getByRole('img', { name: 'Visa' })).toBeInTheDocument()
    expect(within(grupo).getByRole('img', { name: 'Mastercard' })).toBeInTheDocument()
    expect(within(grupo).getByRole('img', { name: 'American Express' })).toBeInTheDocument()
    expect(within(grupo).getByRole('img', { name: 'Mercado Pago' })).toBeInTheDocument()
    expect(within(grupo).getByRole('img', { name: 'Transferencia bancaria' })).toBeInTheDocument()
    expect(within(grupo).queryByText('Tarjetas')).not.toBeInTheDocument()
  })

  it('resume garantías e identidad legal configurable', () => {
    vi.mocked(useTienda).mockReturnValue({
      ...CONFIG,
      razon_social: 'Ikigai SRL',
      cuit: '30-12345678-9',
    } as never)

    renderFooter()

    expect(
      screen.getByText(
        'Envíos a todo el país · 6 cuotas sin interés · 20% OFF transferencia · Cambios y devoluciones',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Ikigai SRL · CUIT/CUIL 30-12345678-9')).toBeInTheDocument()
  })
})
