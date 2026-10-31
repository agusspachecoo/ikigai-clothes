import { beforeEach, describe, expect, it, vi } from 'vitest'
import { convertirHEICaJPEG, esHEIC, esImagenSoportada } from './heic'

const heic2anyMock = vi.fn()

vi.mock('heic2any', () => ({
  default: (...args: unknown[]) => heic2anyMock(...args),
}))

function archivo(nombre: string, tipo = ''): File {
  return new File([new Uint8Array([0])], nombre, { type: tipo })
}

describe('esHEIC', () => {
  it('detecta HEIC por MIME', () => {
    expect(esHEIC(archivo('foto.bin', 'image/heic'))).toBe(true)
    expect(esHEIC(archivo('foto.bin', 'image/heif'))).toBe(true)
  })

  it('detecta HEIC por extension, sin importar mayusculas', () => {
    expect(esHEIC(archivo('IMG_1234.HEIC'))).toBe(true)
    expect(esHEIC(archivo('IMG_1234.heic'))).toBe(true)
    expect(esHEIC(archivo('IMG_1234.HEIF'))).toBe(true)
  })

  it('no marca otros formatos como HEIC', () => {
    expect(esHEIC(archivo('foto.jpg', 'image/jpeg'))).toBe(false)
    expect(esHEIC(archivo('foto.webp', 'image/webp'))).toBe(false)
  })
})

describe('esImagenSoportada', () => {
  it('acepta imagenes normales y HEIC con MIME vacio', () => {
    expect(esImagenSoportada(archivo('foto.jpg', 'image/jpeg'))).toBe(true)
    expect(esImagenSoportada(archivo('IMG_1234.HEIC'))).toBe(true)
  })

  it('rechaza archivos que no son imagen', () => {
    expect(esImagenSoportada(archivo('contrato.pdf', 'application/pdf'))).toBe(false)
  })
})

describe('convertirHEICaJPEG', () => {
  beforeEach(() => {
    heic2anyMock.mockReset()
  })

  it('convierte a un File JPEG con extension .jpg', async () => {
    heic2anyMock.mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))

    const salida = await convertirHEICaJPEG(archivo('IMG_1234.HEIC', 'image/heic'))

    expect(heic2anyMock).toHaveBeenCalledWith({
      blob: expect.any(File),
      toType: 'image/jpeg',
      quality: 0.9,
    })
    expect(salida.name).toBe('IMG_1234.jpg')
    expect(salida.type).toBe('image/jpeg')
  })

  it('toma la primera imagen si heic2any devuelve un array', async () => {
    heic2anyMock.mockResolvedValue([
      new Blob(['a'], { type: 'image/jpeg' }),
      new Blob(['b'], { type: 'image/jpeg' }),
    ])

    const salida = await convertirHEICaJPEG(archivo('live.heic', 'image/heic'))

    expect(salida.name).toBe('live.jpg')
  })

  it('lanza un error claro si la conversion falla', async () => {
    heic2anyMock.mockRejectedValue(new Error('boom'))

    await expect(convertirHEICaJPEG(archivo('rota.heic'))).rejects.toThrow(
      /No se pudo convertir "rota.heic"/,
    )
  })
})
