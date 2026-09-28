import { useState, useRef } from 'react'
import { comprimirImagen, blobToFile, tamañoEnKB } from '../lib/imageCompression'
import { subirImagen } from '../lib/adminApi'

type CarpetaSubida = 'productos' | 'outfits' | 'reviews' | 'comunidad'

interface ImageUploaderProps {
  carpeta: CarpetaSubida
  imagenActual?: string
  onUrl: (url: string) => void
  proporcion?: 'cuadrado' | 'retrato' | 'apaisado'
  altoMinimo?: string
  texto?: string
}

const PROPORCION_TAILWIND: Record<NonNullable<ImageUploaderProps['proporcion']>, string> = {
  cuadrado: 'aspect-square',
  retrato: 'aspect-[3/4]',
  apaisado: 'aspect-[16/9]',
}

export function ImageUploader({
  carpeta,
  imagenActual,
  onUrl,
  proporcion = 'retrato',
  altoMinimo = 'h-44',
  texto = 'Elegí o arrastrá una imagen',
}: ImageUploaderProps) {
  const [previewLocal, setPreviewLocal] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [dragActivo, setDragActivo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const mostrarImagen = previewLocal ?? imagenActual

  async function procesarArchivo(archivo: File | null) {
    if (!archivo) return
    if (!archivo.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen.')
      return
    }
    setError(null)
    setInfo(null)
    setSubiendo(true)
    try {
      const blob = await comprimirImagen(archivo)
      const archivoFinal = blobToFile(blob, archivo.name)
      setPreviewLocal(URL.createObjectURL(blob))
      setInfo(`Comprimida a ${tamañoEnKB(blob.size)}`)
      const { url, error: errUpload } = await subirImagen(archivoFinal, carpeta)
      if (errUpload || !url) throw new Error(errUpload ?? 'No se pudo subir la imagen')
      onUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir la imagen')
    } finally {
      setSubiendo(false)
    }
  }

  function manejarDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActivo(false)
    procesarArchivo(e.dataTransfer.files?.[0] ?? null)
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        aria-label={texto}
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
        className={`relative w-full ${altoMinimo} ${PROPORCION_TAILWIND[proporcion]} ${
          dragActivo ? 'border-primary bg-primary/5' : 'border-base-300'
        } border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-colors hover:border-primary ${
          subiendo ? 'opacity-70 pointer-events-none' : ''
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={subiendo}
          onChange={(e) => {
            procesarArchivo(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />

        {mostrarImagen ? (
          <img src={mostrarImagen} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-sm opacity-60 text-center px-3">
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0021.75 19.5V4.5A1.5 1.5 0 0020.25 3H3.75A1.5 1.5 0 002.25 4.5v15A1.5 1.5 0 003.75 21z"
              />
            </svg>
            {texto}
          </span>
        )}

        {subiendo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70 text-sm font-medium">
            <span className="loading loading-spinner loading-sm text-primary" />
            Comprimiendo y subiendo...
          </div>
        )}

        {!subiendo && mostrarImagen && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setPreviewLocal(null)
              setInfo(null)
              onUrl('')
            }}
            className="absolute top-1.5 right-1.5 btn btn-circle btn-xs text-white bg-black/50 border-0 hover:bg-black/70"
            aria-label="Quitar imagen"
          >
            ✕
          </button>
        )}
      </div>

      {info && <p className="text-xs text-success">{info}</p>}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}