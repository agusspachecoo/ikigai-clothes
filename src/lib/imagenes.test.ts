import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  IMAGEN_FALLBACK,
  imagenProducto,
  normalizarUrlImagen,
  obtenerUrlImagen,
  srcsetImagen,
} from './imagenes'

const BASE = 'https://demo.supabase.co'

describe('normalizarUrlImagen', () => {
  it('construye la URL pública desde un path relativo del bucket', () => {
    expect(normalizarUrlImagen('productos/remera.webp', BASE)).toBe(
      `${BASE}/storage/v1/object/public/product-images/productos/remera.webp`,
    )
  })

  it('resuelve nombres de archivo sueltos y paths relativos', () => {
    expect(normalizarUrlImagen('foto.jpg', BASE)).toBe(
      `${BASE}/storage/v1/object/public/product-images/foto.jpg`,
    )
    expect(normalizarUrlImagen('reviews/foto.jpg', BASE)).toBe(
      `${BASE}/storage/v1/object/public/product-images/reviews/foto.jpg`,
    )
    expect(
      normalizarUrlImagen('foto.jpg', { supabaseUrl: BASE, carpeta: 'reviews' }),
    ).toBe(`${BASE}/storage/v1/object/public/product-images/reviews/foto.jpg`)
  })

  it('respeta buckets legacy escritos en el path', () => {
    expect(
      normalizarUrlImagen('/storage/v1/object/public/reviews/foto.jpg', BASE),
    ).toBe(`${BASE}/storage/v1/object/public/reviews/foto.jpg`)
  })

  it('acepta un bucket explícito para instalaciones con otra estructura', () => {
    expect(
      normalizarUrlImagen('foto.jpg', { supabaseUrl: BASE, bucket: 'reviews' }),
    ).toBe(`${BASE}/storage/v1/object/public/reviews/foto.jpg`)
    expect(
      normalizarUrlImagen('foto.jpg', {
        supabaseUrl: BASE,
        bucket: 'reviews',
        carpeta: 'reviews',
      }),
    ).toBe(`${BASE}/storage/v1/object/public/reviews/foto.jpg`)
  })

  it('deja intactos los assets locales', () => {
    expect(normalizarUrlImagen('/placeholder-imagen.svg', BASE)).toBe(
      '/placeholder-imagen.svg',
    )
  })

  it('quita el bucket duplicado en URLs absolutas', () => {
    expect(
      normalizarUrlImagen(
        `${BASE}/storage/v1/object/public/product-images/product-images/productos/remera.webp`,
      ),
    ).toBe(
      `${BASE}/storage/v1/object/public/product-images/productos/remera.webp`,
    )
  })

  it('normaliza render/image y conserva la query', () => {
    expect(
      normalizarUrlImagen(
        `${BASE}/storage/v1/render/image/public/product-images/product-images/productos/remera.webp?width=320`,
      ),
    ).toBe(
      `${BASE}/storage/v1/render/image/public/product-images/productos/remera.webp?width=320`,
    )
  })

  it('deja intactas las imágenes externas y los blobs', () => {
    expect(normalizarUrlImagen('https://cdn.example.com/remera.webp')).toBe(
      'https://cdn.example.com/remera.webp',
    )
    expect(normalizarUrlImagen('blob:https://ikigai.app/123')).toBe(
      'blob:https://ikigai.app/123',
    )
  })

  it('usa el placeholder local cuando no hay imagen', () => {
    expect(normalizarUrlImagen(null)).toBe(IMAGEN_FALLBACK)
    expect(normalizarUrlImagen('   ')).toBe(IMAGEN_FALLBACK)
    expect(imagenProducto(null, 2)).toBe(IMAGEN_FALLBACK)
  })
})


describe('obtenerUrlImagen', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', BASE)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('devuelve las URLs absolutas tal cual', () => {
    expect(obtenerUrlImagen('https://cdn.example.com/foto.webp')).toBe(
      'https://cdn.example.com/foto.webp',
    )
  })

  it('reconstruye nombres sueltos y rutas con prefijo', () => {
    expect(obtenerUrlImagen('foto.jpg')).toBe(
      `${BASE}/storage/v1/object/public/product-images/foto.jpg`,
    )
    expect(obtenerUrlImagen('reviews/foto.jpg')).toBe(
      `${BASE}/storage/v1/object/public/product-images/foto.jpg`,
    )
    expect(obtenerUrlImagen('/showroom/foto.jpg')).toBe(
      `${BASE}/storage/v1/object/public/product-images/showroom/foto.jpg`,
    )
  })

  it('respeta previews locales y valores vacíos', () => {
    expect(obtenerUrlImagen('blob:https://ikigai.app/123')).toBe(
      'blob:https://ikigai.app/123',
    )
    expect(obtenerUrlImagen(null)).toBe('')
    expect(obtenerUrlImagen('   ')).toBe('')
  })
})

describe('srcsetImagen', () => {
  it('genera variantes sin duplicar el bucket', () => {
    const { srcset } = srcsetImagen(
      `${BASE}/storage/v1/object/public/product-images/product-images/productos/remera.webp`,
      320,
    )

    expect(srcset).toContain(
      `${BASE}/storage/v1/render/image/public/product-images/productos/remera.webp?width=320&quality=75`,
    )
    expect(srcset).not.toContain('product-images/product-images')
  })

  it('no genera srcset para el placeholder', () => {
    expect(srcsetImagen(null, 320).srcset).toBeUndefined()
  })

  it('aplica la carpeta al normalizar un nombre suelto', () => {
    const { srcset } = srcsetImagen('foto.webp', 320, false, {
      supabaseUrl: BASE,
      carpeta: 'showroom',
    })

    expect(srcset).toContain(
      `${BASE}/storage/v1/render/image/public/product-images/showroom/foto.webp?width=320&quality=75`,
    )
  })
})
