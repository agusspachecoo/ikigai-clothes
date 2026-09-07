export interface CompressOptions {
  maxWidth?: number
  quality?: number
  format?: 'image/webp' | 'image/jpeg'
}

export async function comprimirImagen(
  file: File,
  { maxWidth = 1200, quality = 0.8, format = 'image/webp' }: CompressOptions = {},
): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const originalW = bitmap.width
  const originalH = bitmap.height

  const scale = Math.min(1, maxWidth / originalW)
  const w = Math.round(originalW * scale)
  const h = Math.round(originalH * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo inicializar el canvas')

  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, format, quality)
  })

  if (!blob) throw new Error('Falló la compresión de la imagen')

  return blob
}

export function blobToFile(blob: Blob, nombreOriginal: string): File {
  const ext = blob.type === 'image/jpeg' ? 'jpg' : 'webp'
  const nombre = nombreOriginal.replace(/\.[^/.]+$/, '')
  return new File([blob], `${nombre}.${ext}`, { type: blob.type })
}

export function tamañoEnKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`
}
