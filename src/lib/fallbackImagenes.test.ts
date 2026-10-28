import { afterEach, describe, expect, it } from 'vitest'
import { IMAGEN_FALLBACK } from './imagenes'
import { instalarFallbackGlobalImagenes } from './fallbackImagenes'

let cleanup: (() => void) | null = null

afterEach(() => {
  cleanup?.()
  cleanup = null
  document.querySelectorAll('img[data-test-global]').forEach((img) => img.remove())
})

describe('instalarFallbackGlobalImagenes', () => {
  it('reemplaza una imagen rota aunque no use ImagenSegura', () => {
    cleanup = instalarFallbackGlobalImagenes()
    const imagen = document.createElement('img')
    imagen.dataset.testGlobal = '1'
    imagen.src = 'https://cdn.example.com/rota.webp'
    document.body.appendChild(imagen)

    imagen.dispatchEvent(new Event('error'))

    expect(imagen.getAttribute('src')).toBe(IMAGEN_FALLBACK)
    expect(imagen).not.toHaveAttribute('srcset')
  })
})
