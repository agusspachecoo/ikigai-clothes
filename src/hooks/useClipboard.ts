import { useCallback, useEffect, useRef, useState } from 'react'

type Estado = 'inactivo' | 'copiado' | 'error'

/**
 * Copia texto al portapapeles y avisa si funcionó.
 *
 * `navigator.clipboard` no existe en contextos sin HTTPS ni en navegadores
 * viejos, así que cae a un textarea oculto con `execCommand('copy')`. Sin ese
 * fallback el botón "Copiar CBU" queda muerto justo en el celular, que es
 * justamente donde el usuario lo va a usar.
 */
export function useClipboard(resetaMs = 2000) {
  const [estado, setEstado] = useState<Estado>('inactivo')
  // Qué texto quedó copiado. Un grupo de botones (CBU, Alias, importe) comparte
  // un único estado: sin esto, al copiar el CBU los tres botones cambian a
  // "Copiado" y nadie sabe cuál quedó en el portapapeles.
  const [ultimoCopiado, setUltimoCopiado] = useState<string | null>(null)
  const timeoutRef = useRef<number | null>(null)

  const marcar = useCallback(
    (nuevo: Estado, texto: string | null = null) => {
      setEstado(nuevo)
      setUltimoCopiado(nuevo === 'copiado' ? texto : null)
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
      timeoutRef.current = window.setTimeout(() => {
        setEstado('inactivo')
        setUltimoCopiado(null)
      }, resetaMs)
    },
    [resetaMs],
  )

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  const copiar = useCallback(
    async (texto: string) => {
      const valor = texto.trim()
      if (!valor) return false

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(valor)
          marcar('copiado', valor)
          return true
        }
      } catch {
        // Sigue con el fallback: el permiso puede estar denegado pero
        // execCommand todavía funciona.
      }

      try {
        const area = document.createElement('textarea')
        area.value = valor
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(area)
        marcar(ok ? 'copiado' : 'error', ok ? valor : null)
        return ok
      } catch {
        marcar('error')
        return false
      }
    },
    [marcar],
  )

  return { estado, ultimoCopiado, copiar }
}