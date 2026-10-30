import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCart } from '../context/cart'
import { promocionDestacada, type Promocion } from '../lib/promociones'
import { PromocionBanner } from './PromocionBanner'

vi.mock('../context/cart', () => ({
  useCart: vi.fn(),
}))

vi.mock('../lib/promociones', () => ({
  promocionDestacada: vi.fn(),
}))

const PROMOCION: Promocion = {
  id: 'promo-1',
  nombre: '¡Llevá 2 musculosas por $35.000!',
  descripcion: null,
  tipo: 'pack',
  descuento_porcentaje: null,
  precio_fijo: 35000,
  prioridad: 10,
  activo: true,
  fecha_inicio: null,
  fecha_fin: null,
  grupos: [{ cantidad_requerida: 2, producto_ids: ['producto-1', 'producto-2'] }],
}

function renderBanner() {
  return render(
    <MemoryRouter>
      <PromocionBanner />
    </MemoryRouter>,
  )
}

describe('PromocionBanner', () => {
  beforeEach(() => {
    vi.mocked(promocionDestacada).mockReset()
  })

  it('muestra la promoción destacada con el CTA al catálogo', () => {
    vi.mocked(promocionDestacada).mockReturnValue(PROMOCION)
    vi.mocked(useCart).mockReturnValue({ promociones: [PROMOCION], items: [] } as never)

    renderBanner()

    expect(screen.getByText('¡Llevá 2 musculosas por $35.000!')).toBeInTheDocument()
    expect(screen.getByText('Pack exclusivo · Llevá 2 unidades con beneficio')).toBeInTheDocument()

    const cta = screen.getByRole('link', { name: /ver productos/i })
    expect(cta).toHaveAttribute('href', '/catalogo?promo=promo-1')
  })

  it('no renderiza el banner cuando no hay promoción destacada', () => {
    vi.mocked(promocionDestacada).mockReturnValue(null)
    vi.mocked(useCart).mockReturnValue({ promociones: [], items: [] } as never)

    const { container } = renderBanner()

    expect(container).toBeEmptyDOMElement()
  })
})
