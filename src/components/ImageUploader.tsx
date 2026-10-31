import { useState, useRef } from 'react'
import {
  comprimirImagen,
  blobToFile,
  tamañoEnKB,
  type CompressOptions,
} from '../lib/imageCompression'
import { subirImagen, type CarpetaImagen } from '../lib/adminApi'
import { convertirHEICaJPEG, esHEIC, esImagenSoportada } from '../lib/heic'
import { ImagenSegura } from './ImagenSegura'

interface ImageUploaderProps {
  carpeta: CarpetaImagen
  imagenActual?: string
  onUrl?: (url: string) => void
  onUrls?: (urls: string[]) => void
  multiple?: boolean
  proporcion?: 'cuadrado' | 'retrato' | 'apaisado' | 'vertical'
  altoMinimo?: string
  texto?: string
  compresion?: CompressOptions
}

const PROPORCION_TAILWIND: Record<NonNullable<ImageUploaderProps['proporcion']>, string> = {
  cuadrado: 'aspect-square',
  retrato: 'aspect-[3/4]',
  apaisado: 'aspect-[16/9]',
  vertical: 'aspect-[9/16]',
}

const MAX_IMAGENES_LOTE = 10

export function ImageUploader({
  carpeta,
  imagenActual,
  onUrl,
  onUrls,
  multiple = false,
  proporcion = 'retrato',
  altoMinimo = 'h-44',
  texto = 'Elegí o arrastrá una imagen',
  compresion,
}: ImageUploaderProps) {
  const [previewLocal, setPreviewLocal] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [dragActivo, setDragActivo] = useState(false)
  const [progreso, setProgreso] = useState<{ actual: number; total: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const mostrarImagen = previewLocal ?? imagenActual

  /**
   * Decodifica de forma segura cualquier imagen (incluyendo HEIC de iPhone) 
   * mediante un Canvas en memoria para evitar el error de decodificación.
   */
  async function prepararArchivo(archivo: File): Promise<File> {
    if (!esHEIC(archivo)) return archivo
    try {
      return await convertirHEICaJPEG(archivo)
    } catch {
      // Si heic2any falla, `comprimirImagen` todavía puede decodificarlo por
      // la vía nativa (<img> + canvas) sin cortar la subida.
      return archivo
    }
  }

  async function procesarArchivo(archivo: File | null) {
    if (!archivo) return
    if (!esImagenSoportada(archivo)) {
      setError('El archivo debe ser una imagen (JPG, PNG, WEBP, HEIC...).')
      return
    }
    setError(null)
    setAviso(null)
    setInfo(null)
    setSubiendo(true)
    try {
      const preparado = await prepararArchivo(archivo)
      const blob = await comprimirImagen(preparado, compresion)
      const archivoFinal = blobToFile(blob, preparado.name)
      
      setPreviewLocal(URL.createObjectURL(blob))
      setInfo(
        archivo.size > blob.size
          ? `Comprimida: ${tamañoEnKB(archivo.size)} → ${tamañoEnKB(blob.size)}`
          : `Optimizada: ${tamañoEnKB(blob.size)}`,
      )
      
      const { url, error: errUpload } = await subirImagen(archivoFinal, carpeta)
      if (errUpload || !url) throw new Error(errUpload ?? 'No se pudo subir la imagen')
      onUrl?.(url)
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error al subir la imagen'
      setError(mensaje)
    } finally {
      setSubiendo(false)
    }
  }

  async function procesarArchivos(archivos: FileList | File[]) {
    const lista = Array.from(archivos)
    if (!lista.length) return

    if (lista.length > MAX_IMAGENES_LOTE) {
      setError(`Máximo ${MAX_IMAGENES_LOTE} imágenes por tanda. Seleccionaste ${lista.length}.`)
      return
    }

    setError(null)
    setAviso(null)
    const urls: string[] = []
    const errores: string[] = []

    try {
      setSubiendo(true)
      setProgreso({ actual: 0, total: lista.length })

      for (const [indice, archivo] of lista.entries()) {
        try {
          if (!esImagenSoportada(archivo)) {
            errores.push(`"${archivo.name}" no es una imagen válida.`)
            setProgreso({ actual: indice + 1, total: lista.length })
            continue
          }

          setProgreso({ actual: indice + 1, total: lista.length })
          setInfo(`Procesando imagen ${indice + 1} de ${lista.length}...`)

          const preparado = await prepararArchivo(archivo)
          const blob = await comprimirImagen(preparado, compresion)
          const archivoFinal = blobToFile(blob, preparado.name)

          const { url, error: errUpload } = await subirImagen(archivoFinal, carpeta)
          if (errUpload || !url) {
            errores.push(`No se pudo subir "${archivo.name}": ${errUpload ?? 'error desconocido'}`)
            continue
          }

          urls.push(url)
        } catch (err) {
          const mensaje = `Error al procesar "${archivo.name}": ${
            err instanceof Error ? err.message : 'No se pudo decodificar'
          }`
          errores.push(mensaje)
          continue
        }
      }

      if (urls.length) {
        onUrls?.(urls)
        setInfo(`Subidas ${urls.length} de ${lista.length} imagen(es).`)
      }

      if (errores.length) {
        setError(errores[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir las imágenes')
    } finally {
      setSubiendo(false)
      setProgreso(null)
    }
  }

  function manejarDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActivo(false)
    if (multiple) {
      void procesarArchivos(e.dataTransfer.files ?? [])
    } else {
      void procesarArchivo(e.dataTransfer.files?.[0] ?? null)
    }
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        aria-label={multiple ? 'Carga masiva de imágenes' : texto}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragActivo(true)
        }}
        onDragLeave={() => setDragActivo(false)}
        onDrop={manejarDrop}
        className={`relative w-full ${altoMinimo} ${PROPORCION_TAILWIND[proporcion]} border-2 rounded-xl overflow-hidden cursor-pointer transition-colors ${
          mostrarImagen
            ? 'border-neutral-200 bg-white'
            : dragActivo
              ? 'border-dashed border-black bg-neutral-100'
              : 'border-dashed border-neutral-300 bg-neutral-50 hover:bg-neutral-100'
        } ${subiendo ? 'opacity-70 pointer-events-none' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple={multiple}
          accept="image/*,.heic,.heif,.HEIC,.HEIF,image/heic,image/heif,image/heic-sequence,image/heif-sequence"
          className="hidden"
          disabled={subiendo}
          onChange={(e) => {
            const files = e.target.files
            if (!files) return
            if (multiple) {
              void procesarArchivos(files)
            } else {
              void procesarArchivo(files[0] ?? null)
            }
            e.target.value = ''
          }}
        />

        {mostrarImagen && !multiple ? (
          <ImagenSegura
            src={mostrarImagen}
            carpeta={carpeta}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
            <svg
              className="h-8 w-8 text-neutral-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0021.75 19.5V4.5A1.5 1.5 0 0020.25 3H3.75A1.5 1.5 0 002.25 4.5v15A1.5 1.5 0 003.75 21z"
              />
            </svg>
            <span className="text-xs font-medium text-neutral-600">
              {multiple ? 'Arrastrá o seleccioná varias imágenes' : texto}
            </span>
            <span className="text-xs font-semibold text-neutral-900 underline underline-offset-2 decoration-neutral-300 hover:decoration-black">
              {multiple ? 'Seleccionar archivos' : 'Seleccionar archivo'}
            </span>
          </span>
        )}

        {subiendo && progreso && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 text-sm font-medium backdrop-blur-sm z-10">
            <span className="loading loading-spinner loading-sm text-primary" />
            Subiendo imagen {progreso.actual} de {progreso.total}...
          </div>
        )}
        {subiendo && !progreso && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 text-sm font-medium backdrop-blur-sm z-10">
            <span className="loading loading-spinner loading-sm text-primary" />
            Comprimiendo y subiendo...
          </div>
        )}

        {!subiendo && mostrarImagen && !multiple && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setPreviewLocal(null)
              setInfo(null)
              onUrl?.('')
            }}
            className="absolute top-1.5 right-1.5 btn btn-circle btn-xs text-white bg-black/50 border-0 hover:bg-black/70 z-10"
            aria-label="Quitar imagen"
          >
            ✕
          </button>
        )}
      </div>

      {info && <p className="text-xs text-success">{info}</p>}
      {aviso && <p className="text-xs text-warning">{aviso}</p>}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}