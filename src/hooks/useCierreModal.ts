import { useEffect, useRef } from 'react'

export function useCierreModal(abierto: boolean, onCerrar: () => void) {
  const onCerrarRef = useRef(onCerrar)

  useEffect(() => {
    onCerrarRef.current = onCerrar
  }, [onCerrar])

  useEffect(() => {
    if (!abierto) return

    function onKeydown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onCerrarRef.current()
    }

    function onPopstate() {
      onCerrarRef.current()
    }

    window.history.pushState({ __ikigaiModalAbierto: true }, '')

    document.addEventListener('keydown', onKeydown)
    window.addEventListener('popstate', onPopstate)

    return () => {
      document.removeEventListener('keydown', onKeydown)
      window.removeEventListener('popstate', onPopstate)
    }
  }, [abierto])
}