import { useCallback, useEffect, useRef } from 'react'
import type { TouchEvent } from 'react'

interface OpcionesSwipe {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  enabled?: boolean
  /** Distancia horizontal mínima para considerar el gesto un swipe. */
  threshold?: number
  /** Desplazamiento vertical máximo antes de descartar el gesto. */
  maxVertical?: number
  /** Duración máxima del gesto para no confundirlo con un arrastre lento. */
  maxDuracion?: number
}

const UMBRAL_HORIZONTAL = 12
const DURACION_BLOQUEO_CLICK = 400

/**
 * Detecta swipes horizontales en elementos táctiles.
 *
 * El elemento que recibe los handlers debe tener `touch-pan-y` para que el
 * navegador siga permitiendo el scroll vertical mientras el gesto horizontal
 * queda disponible para este hook.
 */
export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  enabled = true,
  threshold = 45,
  maxVertical = 60,
  maxDuracion = 800,
}: OpcionesSwipe = {}) {
  const inicio = useRef<{ x: number; y: number; t: number } | null>(null)
  const horizontal = useRef(false)
  const swipeado = useRef(false)
  const timeoutClick = useRef<number | null>(null)

  const limpiar = useCallback(() => {
    inicio.current = null
    horizontal.current = false
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutClick.current) window.clearTimeout(timeoutClick.current)
    }
  }, [])

  const onTouchStart = useCallback(
    (event: TouchEvent) => {
      if (!enabled || event.touches.length !== 1) {
        limpiar()
        return
      }
      const touch = event.touches[0]
      inicio.current = { x: touch.clientX, y: touch.clientY, t: Date.now() }
      horizontal.current = false
    },
    [enabled, limpiar],
  )

  const onTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!enabled || !inicio.current || event.touches.length !== 1) return

      const touch = event.touches[0]
      const dx = touch.clientX - inicio.current.x
      const dy = touch.clientY - inicio.current.y

      if (!horizontal.current) {
        if (Math.abs(dy) > maxVertical && Math.abs(dy) > Math.abs(dx)) {
          limpiar()
          return
        }
        if (Math.abs(dx) > UMBRAL_HORIZONTAL && Math.abs(dx) > Math.abs(dy) * 1.2) {
          horizontal.current = true
        }
      }
    },
    [enabled, limpiar, maxVertical],
  )

  const onTouchEnd = useCallback(
    (event: TouchEvent) => {
      if (!enabled || !inicio.current) {
        limpiar()
        return
      }

      const touch = event.changedTouches[0]
      if (!touch) {
        limpiar()
        return
      }

      const dx = touch.clientX - inicio.current.x
      const dy = touch.clientY - inicio.current.y
      const duracion = Date.now() - inicio.current.t
      const esSwipe =
        horizontal.current &&
        Math.abs(dx) >= threshold &&
        Math.abs(dx) > Math.abs(dy) * 1.2 &&
        duracion <= maxDuracion

      limpiar()

      if (!esSwipe) return

      swipeado.current = true
      if (timeoutClick.current) window.clearTimeout(timeoutClick.current)
      timeoutClick.current = window.setTimeout(() => {
        swipeado.current = false
      }, DURACION_BLOQUEO_CLICK)

      if (dx < 0) onSwipeLeft?.()
      else onSwipeRight?.()
    },
    [enabled, limpiar, maxDuracion, onSwipeLeft, onSwipeRight, threshold],
  )

  /** Evita que el click posterior al swipe dispare acciones como abrir el zoom. */
  const consumirSwipe = useCallback(() => {
    if (!swipeado.current) return false
    swipeado.current = false
    return true
  }, [])

  return {
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: limpiar,
    },
    consumirSwipe,
  }
}
