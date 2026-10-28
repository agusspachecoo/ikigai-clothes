import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ImagenSegura } from './ImagenSegura'

const BASE = 'https://demo.supabase.co'

describe('ImagenSegura', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('oculta una imagen rota sin romper la interfaz', () => {
    render(
      <ImagenSegura
        src="https://cdn.example.com/rota.webp"
        srcSet="https://cdn.example.com/rota.webp 1x"
        alt="Foto rota"
      />,
    )

    const imagen = screen.getByRole('img', { name: 'Foto rota' })
    expect(imagen).toHaveAttribute('data-local-fallback', '1')

    fireEvent.error(imagen)

    expect((imagen as HTMLElement).style.display).toBe('none')
    expect(imagen).not.toHaveAttribute('srcset')
  })

  it('vuelve a intentar cuando cambia la URL', () => {
    const { rerender } = render(
      <ImagenSegura src="https://cdn.example.com/rota.webp" alt="Foto" />,
    )
    const imagen = screen.getByRole('img', { name: 'Foto' })

    fireEvent.error(imagen)
    expect((imagen as HTMLElement).style.display).toBe('none')

    rerender(<ImagenSegura src="https://cdn.example.com/nueva.webp" alt="Foto" />)

    expect(imagen).toHaveAttribute('src', 'https://cdn.example.com/nueva.webp')
    expect((imagen as HTMLElement).style.display).not.toBe('none')
  })

  it('normaliza nombres de archivo relativos con el bucket público', () => {
    vi.stubEnv('VITE_SUPABASE_URL', BASE)

    render(<ImagenSegura src="reviews/foto.jpg" alt="Foto relativa" />)

    expect(screen.getByRole('img', { name: 'Foto relativa' })).toHaveAttribute(
      'src',
      `${BASE}/storage/v1/object/public/product-images/foto.jpg`,
    )
  })

  it('no asigna src cuando no recibe imagen', () => {
    render(<ImagenSegura alt="Sin foto" />)
    expect(screen.getByRole('img', { name: 'Sin foto' })).not.toHaveAttribute('src')
  })
})
