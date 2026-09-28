export interface CompressOptions {
  maxWidth?: number
  quality?: number
  format?: 'image/webp' | 'image/jpeg'
  maxBytes?: number
}

export const BYTES_OBJETIVO = 800 * 1024

export async function comprimirImagen(
  file: File,
  { maxWidth = 1200, quality = 0.8, format = 'image/webp', maxBytes = BYTES_OBJETIVO }: CompressOptions = {},
): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const originalW = bitmap.width
  const originalH = bitmap.height

  const escalaInicial = Math.min(1, maxWidth / originalW)
  let w = Math.max(1, Math.round(originalW * escalaInicial))
  let h = Math.max(1, Math.round(originalH * escalaInicial))
  let calidad = quality

  const generar = async (ancho: number, alto: number, q: number) => {
    const canvas = document.createElement('canvas')
    canvas.width = ancho
    canvas.height = alto
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No se pudo inicializar el canvas')

    ctx.drawImage(bitmap, 0, 0, ancho, alto)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, format, q)
    })
    if (!blob) throw new Error('Falló la compresión de la imagen')
    return { blob, peso: blob.size }
  }

  let resultado = await generar(w, h, calidad)

  while (resultado.peso > maxBytes && calidad > 0.4) {
    calidad = Math.max(0.4, Number((calidad - 0.15).toFixed(2)))
    resultado = await generar(w, h, calidad)
  }

  while (resultado.peso > maxBytes && w > 200) {
    w = Math.max(200, Math.round(w * 0.8))
    h = Math.max(1, Math.round(h * 0.8))
    resultado = await generar(w, h, calidad)
  }

  bitmap.close()
  return resultado.blob
}

export function blobToFile(blob: Blob, nombreOriginal: string): File {
  const ext = blob.type === 'image/jpeg' ? 'jpg' : 'webp'
  const nombre = nombreOriginal.replace(/\.[^/.]+$/, '')
  return new File([blob], `${nombre}.${ext}`, { type: blob.type })
}

export function tamañoEnKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`
}