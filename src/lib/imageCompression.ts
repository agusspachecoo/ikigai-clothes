import { convertirHEICaJPEG, esHEIC } from './heic'

export interface CompressOptions {
  maxWidth?: number
  quality?: number
  format?: 'image/webp' | 'image/jpeg'
  maxBytes?: number
}

export const BYTES_OBJETIVO = 800 * 1024

interface FuenteImagen {
  ancho: number
  alto: number
  dibujar: (ctx: CanvasRenderingContext2D, ancho: number, alto: number) => void
  liberar: () => void
}

function fuenteDesdeBitmap(bitmap: ImageBitmap): FuenteImagen {
  return {
    ancho: bitmap.width,
    alto: bitmap.height,
    dibujar: (ctx, ancho, alto) => ctx.drawImage(bitmap, 0, 0, ancho, alto),
    liberar: () => bitmap.close(),
  }
}

/**
 * Último recurso: dejar que el navegador decodifique la imagen con `<img>` y
 * volcarla a un canvas. Algunos entornos (Safari) pueden mostrar HEIC así
 * aunque `createImageBitmap` falle.
 */
function cargarConImagenHtml(file: File): Promise<FuenteImagen> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.decoding = 'async'

    img.onload = () => {
      const ancho = img.naturalWidth
      const alto = img.naturalHeight
      if (!ancho || !alto) {
        URL.revokeObjectURL(url)
        reject(new Error('La imagen no tiene dimensiones válidas'))
        return
      }
      resolve({
        ancho,
        alto,
        dibujar: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
        liberar: () => URL.revokeObjectURL(url),
      })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('El navegador no pudo decodificar la imagen'))
    }

    img.src = url
  })
}

/**
 * Intenta decodificar el archivo por varias vías, de la más rápida a la más
 * compatible:
 *  1. `createImageBitmap` nativo (Safari ya entiende HEIC).
 *  2. `heic2any` → JPEG, para Chrome/Firefox.
 *  3. `<img>` + canvas, por si el entorno soporta el formato por esa vía.
 */
async function cargarFuente(file: File): Promise<FuenteImagen> {
  try {
    return fuenteDesdeBitmap(await createImageBitmap(file))
  } catch (err) {
    if (!esHEIC(file)) throw err
  }

  try {
    const jpeg = await convertirHEICaJPEG(file)
    return fuenteDesdeBitmap(await createImageBitmap(jpeg))
  } catch {
    // La librería no cargó o el archivo está corrupto: probamos el fallback nativo.
  }

  try {
    return await cargarConImagenHtml(file)
  } catch {
    throw new Error(
      `No se pudo procesar "${file.name}" (HEIC). Convertila a JPG o PNG e intentá de nuevo.`,
    )
  }
}

export async function comprimirImagen(
  file: File,
  { maxWidth = 1200, quality = 0.8, format = 'image/webp', maxBytes = BYTES_OBJETIVO }: CompressOptions = {},
): Promise<Blob> {
  const fuente = await cargarFuente(file)
  const originalW = fuente.ancho
  const originalH = fuente.alto

  try {
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

      fuente.dibujar(ctx, ancho, alto)

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

    return resultado.blob
  } finally {
    fuente.liberar()
  }
}

export function blobToFile(blob: Blob, nombreOriginal: string): File {
  const ext = blob.type === 'image/jpeg' ? 'jpg' : 'webp'
  const nombre = nombreOriginal.replace(/\.[^/.]+$/, '')
  return new File([blob], `${nombre}.${ext}`, { type: blob.type })
}

export function tamañoEnKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`
}
