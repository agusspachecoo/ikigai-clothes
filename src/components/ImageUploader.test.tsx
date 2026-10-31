import { fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImageUploader } from './ImageUploader'

const mocks = vi.hoisted(() => ({
  esHEIC: vi.fn(),
  esImagenSoportada: vi.fn(),
  convertir: vi.fn(),
  comprimir: vi.fn(),
  blobToFile: vi.fn(),
  subir: vi.fn(),
}))

vi.mock('../lib/heic', () => ({
  esHEIC: (archivo: File) => mocks.esHEIC(archivo),
  esImagenSoportada: (archivo: File) => mocks.esImagenSoportada(archivo),
  convertirHEICaJPEG: (archivo: File) => mocks.convertir(archivo),
}))

vi.mock('../lib/imageCompression', () => ({
  comprimirImagen: (archivo: File, opciones: unknown) => mocks.comprimir(archivo, opciones),
  blobToFile: (blob: Blob, nombre: string) => mocks.blobToFile(blob, nombre),
  tamañoEnKB: () => '10 KB',
}))

vi.mock('../lib/adminApi', () => ({
  subirImagen: (archivo: File, carpeta: string) => mocks.subir(archivo, carpeta),
}))

vi.mock('./ImagenSegura', () => ({ ImagenSegura: () => null }))

const descriptorCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')

function seleccionar(container: HTMLElement, archivo: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [archivo] } })
}

describe('ImageUploader con HEIC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.esImagenSoportada.mockReturnValue(true)
    mocks.esHEIC.mockReturnValue(false)
    mocks.comprimir.mockResolvedValue(new Blob(['webp'], { type: 'image/webp' }))
    mocks.blobToFile.mockImplementation(
      (blob: Blob, nombre: string) => new File([blob], nombre, { type: blob.type }),
    )
    mocks.subir.mockResolvedValue({ url: 'https://cdn.test/foto.webp', error: null })

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:preview'),
    })
  })

  afterEach(() => {
    if (descriptorCreate) Object.defineProperty(URL, 'createObjectURL', descriptorCreate)
    else delete (URL as unknown as Record<string, unknown>).createObjectURL
  })

  it('convierte HEIC a JPEG antes de comprimir y subir', async () => {
    mocks.esHEIC.mockReturnValue(true)
    const jpeg = new File(['jpeg'], 'IMG_1234.jpg', { type: 'image/jpeg' })
    mocks.convertir.mockResolvedValue(jpeg)

    const onUrl = vi.fn()
    const { container } = render(<ImageUploader carpeta="productos" onUrl={onUrl} />)
    const heic = new File([new Uint8Array([0])], 'IMG_1234.HEIC', { type: 'image/heic' })

    seleccionar(container, heic)

    await waitFor(() => expect(onUrl).toHaveBeenCalledWith('https://cdn.test/foto.webp'))
    expect(mocks.convertir).toHaveBeenCalledWith(heic)
    expect(mocks.comprimir).toHaveBeenCalledWith(jpeg, undefined)

    const archivoSubido = mocks.subir.mock.calls[0][0] as File
    expect(archivoSubido.type).toBe('image/webp')
  })

  it('si la conversion falla, comprime el original sin cortar la subida', async () => {
    mocks.esHEIC.mockReturnValue(true)
    mocks.convertir.mockRejectedValue(new Error('heic2any boom'))

    const onUrl = vi.fn()
    const { container } = render(<ImageUploader carpeta="productos" onUrl={onUrl} />)
    const heic = new File([new Uint8Array([0])], 'IMG_1234.HEIC', { type: 'image/heic' })

    seleccionar(container, heic)

    await waitFor(() => expect(onUrl).toHaveBeenCalled())
    expect(mocks.comprimir).toHaveBeenCalledWith(heic, undefined)
  })
})
