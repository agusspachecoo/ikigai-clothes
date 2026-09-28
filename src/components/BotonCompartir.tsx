import { useState } from 'react'

/** Comparte el producto: Web Share si existe, si no copia el enlace. */
export function BotonCompartir({ titulo, texto }: { titulo: string; texto?: string }) {
  const [compartido, setCompartido] = useState(false)
  const enlace = typeof window !== 'undefined' ? window.location.href : ''

  async function compartir() {
    const datos = { title: titulo, text: texto ?? titulo, url: enlace }
    try {
      if (navigator.share) {
        await navigator.share(datos)
        return
      }
      await navigator.clipboard.writeText(enlace)
      setCompartido(true)
      window.setTimeout(() => setCompartido(false), 2000)
    } catch {
      // El usuario canceló el share o el navegador no lo soporta.
    }
  }

  return (
    <button
      type="button"
      onClick={compartir}
      className="inline-flex items-center gap-2 text-xs uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
        />
      </svg>
      {compartido ? 'Enlace copiado' : 'Compartir'}
    </button>
  )
}
