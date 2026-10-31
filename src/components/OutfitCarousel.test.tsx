import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OutfitConItems } from '../types/database'
import { OutfitCarousel } from './OutfitCarousel'

function outfit(numero: number): OutfitConItems {
  return {
    id: `outfit-${numero}`,
    nombre: `Outfit ${numero}`,
    descripcion: null,
    precio_combo: 50_000,
    imagen_portada: `outfits/outfit-${numero}.jpg`,
    activo: true,
    created_at: '',
    outfit_items: [],
  }
}

function renderCarousel(outfits: OutfitConItems[]) {
  return render(
    <MemoryRouter>
      <OutfitCarousel outfits={outfits} />
    </MemoryRouter>,
  )
}

describe('OutfitCarousel', () => {
  let scrollIntoView: ReturnType<typeof vi.fn>

  beforeEach(() => {
    scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView as never
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('muestra todos los outfits y pagina de a 4 en escritorio', () => {
    renderCarousel([1, 2, 3, 4, 5].map(outfit))

    for (const numero of [1, 2, 3, 4, 5]) {
      expect(screen.getByText(`Outfit ${numero}`)).toBeInTheDocument()
    }

    expect(screen.getAllByRole('button', { name: /Ir a la vista/i })).toHaveLength(2)
  })

  it('al tocar la segunda pagina desplaza el carrusel al quinto outfit', () => {
    renderCarousel([1, 2, 3, 4, 5].map(outfit))

    fireEvent.click(screen.getByRole('button', { name: 'Ir a la vista 2 de outfits' }))

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    const quinto = screen.getByLabelText('Ver detalle del look Outfit 5')
    expect(scrollIntoView.mock.instances[0]).toBe(quinto.parentElement)
  })

  it('marca la ultima pagina como activa al llegar al final del carrusel', () => {
    const { container } = renderCarousel([1, 2, 3, 4, 5].map(outfit))
    const track = container.querySelector('[class*="snap-x"]') as HTMLDivElement
    const slides = Array.from(track.children) as HTMLElement[]

    slides.forEach((slide, indice) => {
      Object.defineProperty(slide, 'offsetLeft', { value: indice * 200, configurable: true })
    })
    Object.defineProperty(track, 'scrollWidth', { value: 1000, configurable: true })
    Object.defineProperty(track, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(track, 'scrollLeft', { value: 200, configurable: true })

    fireEvent.scroll(track)

    const dots = screen.getAllByRole('button', { name: /Ir a la vista/i })
    expect(dots[0]).toHaveAttribute('aria-current', 'false')
    expect(dots[1]).toHaveAttribute('aria-current', 'true')
  })

  it('en mobile muestra una pagina por outfit', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    )

    renderCarousel([1, 2, 3, 4, 5].map(outfit))

    expect(screen.getAllByRole('button', { name: /Ir a la vista/i })).toHaveLength(5)
  })
})
