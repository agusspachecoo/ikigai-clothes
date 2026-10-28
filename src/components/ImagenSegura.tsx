import { useState, type ImgHTMLAttributes } from 'react'
import { obtenerUrlImagen } from '../lib/imagenes'

interface ImagenSeguraProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null
  /** Bucket público de Supabase Storage. */
  bucket?: string
  /** Carpeta usada para resolver nombres de archivo relativos. */
  carpeta?: string
}

/**
 * `<img>` para imágenes dinámicas de Supabase.
 *
 * Normaliza la URL con `obtenerUrlImagen` y, si la carga falla, oculta la
 * etiqueta para no dejar el ícono de imagen rota en la interfaz. Guarda la URL
 * fallida para que al cambiar la imagen se vuelva a intentar.
 */
export function ImagenSegura({
  src,
  bucket,
  carpeta,
  srcSet,
  onError,
  style,
  ...props
}: ImagenSeguraProps) {
  void bucket
  void carpeta
  const normalizada = obtenerUrlImagen(src ?? null)
  const [urlFallida, setUrlFallida] = useState<string | null>(null)
  const oculta = urlFallida === normalizada

  return (
    <img
      {...props}
      src={normalizada || undefined}
      srcSet={oculta ? undefined : srcSet}
      style={oculta ? { ...style, display: 'none' } : style}
      data-local-fallback="1"
      onError={(event) => {
        onError?.(event)
        ;(event.currentTarget as HTMLElement).style.display = 'none'
        if (!oculta) setUrlFallida(normalizada)
      }}
    />
  )
}
