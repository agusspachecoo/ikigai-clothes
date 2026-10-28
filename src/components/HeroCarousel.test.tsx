import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getBannersPublic } from '../lib/adminApi'
import type { Banner } from '../types/database'
import { HeroCarousel } from './HeroCarousel'

vi.mock('../lib/adminApi', () => ({
  getBannersPublic: vi.fn(),
}))

const BANNERS: Banner[] = [
  {
    id: 'banner-1',
    imagen_url: 'https://cdn.example.com/banner-1.jpg',
    imagen_mobile: null,
    titulo: 'Banner real',
    link_url: '/catalogo',
    orden: 0,
    activo: true,
    created_at: '',
  },
  {
    id: 'banner-2',
    imagen_url: 'https://cdn.example.com/banner-2.jpg',
    imagen_mobile: null,
    titulo: 'Segundo banner',
    link_url: '/outfits',
    orden: 1,
    activo: true,
    created_at: '',
  },
]

function renderHero() {
  return render(
    <MemoryRouter>
      <HeroCarousel />
    </MemoryRouter>,
  )
}

describe('HeroCarousel', () => {
  beforeEach(() => {
    vi.mocked(getBannersPublic).mockReset()
  })

  it('no muestra los banners por defecto mientras carga la configuración', async () => {
    let resolver!: (valor: { data: Banner[]; error: string | null }) => void
    vi.mocked(getBannersPublic).mockReturnValue(
      new Promise((resolve) => {
        resolver = resolve
      }),
    )

    renderHero()

    expect(screen.getByLabelText('Cargando banner')).toBeInTheDocument()
    expect(screen.queryByText('Ropa urbana con estilo')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    await act(async () => {
      resolver({ data: BANNERS, error: null })
    })

    const imagen = await screen.findByRole('img', { name: 'Banner real' })
    expect(imagen).toHaveAttribute('src', 'https://cdn.example.com/banner-1.jpg')

    fireEvent.load(imagen)

    expect(screen.queryByLabelText('Cargando banner')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Banner principal')).toHaveAttribute('aria-busy', 'false')
    expect(screen.getByLabelText('Slide siguiente')).toBeInTheDocument()
  })

  it('usa el placeholder local cuando la primera imagen falla', async () => {
    vi.mocked(getBannersPublic).mockResolvedValue({ data: BANNERS, error: null })

    renderHero()

    const imagen = await screen.findByRole('img', { name: 'Banner real' })
    fireEvent.error(imagen)

    const fallback = await screen.findByRole('img', { name: 'Banner real' })
    expect(fallback.getAttribute('src')).toContain('placeholder-imagen.svg')

    fireEvent.load(fallback)

    expect(screen.queryByLabelText('Cargando banner')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Slide siguiente')).toBeInTheDocument()
  })
})
