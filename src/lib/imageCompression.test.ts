import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  esHEIC: vi.fn(),
  convertir: vi.fn(),
}))

vi.mock('./heic', () => ({
  esHEIC: (archivo: File) => mocks.esHEIC(archivo),
  convertirHEICaJPEG: (archivo: File) => mocks.convertir(archivo),
}))

import { comprimirImagen } from './imageCompression'

const archivoHEIC = () => new File([new Uint8Array([0])], 'IMG_1234.HEIC', { type: '' })

describe('comprimirImagen con HEIC', () => {
  const descriptorCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
  const descriptorRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')

  beforeEach(() => {
    mocks.esHEIC.mockReset().mockReturnValue(true)
    mocks.convertir.mockReset()

    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode fail')))
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:test'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (descriptorCreate) Object.defineProperty(URL, 'createObjectURL', descriptorCreate)
    else delete (URL as unknown as Record<string, unknown>).createObjectURL
    if (descriptorRevoke) Object.defineProperty(URL, 'revokeObjectURL', descriptorRevoke)
    else delete (URL as unknown as Record<string, unknown>).revokeObjectURL
  })

  it('si heic2any falla, cae al lector nativo <img> y avisa con un mensaje claro', async () => {
    mocks.convertir.mockRejectedValue(new Error('boom'))

    class ImagenFalsa {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      decoding = ''
      naturalWidth = 0
      naturalHeight = 0
      set src(_valor: string) {
        queueMicrotask(() => this.onerror?.())
      }
    }
    vi.stubGlobal('Image', ImagenFalsa)

    await expect(comprimirImagen(archivoHEIC())).rejects.toThrow(
      /No se pudo procesar "IMG_1234.HEIC"/,
    )
    expect(mocks.convertir).toHaveBeenCalled()
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it('si el archivo no es HEIC, propaga el error original sin intentar convertir', async () => {
    mocks.esHEIC.mockReturnValue(false)

    await expect(
      comprimirImagen(new File([], 'foto.jpg', { type: 'image/jpeg' })),
    ).rejects.toThrow('decode fail')
    expect(mocks.convertir).not.toHaveBeenCalled()
  })
})
