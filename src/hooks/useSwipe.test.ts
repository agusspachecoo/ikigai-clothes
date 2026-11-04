import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TouchEvent } from 'react'
import { useSwipe } from './useSwipe'

function toque(clientX: number, clientY: number) {
  return { clientX, clientY } as Touch
}

function inicio(clientX: number, clientY: number) {
  return { touches: [toque(clientX, clientY)] } as unknown as TouchEvent
}

function movimiento(clientX: number, clientY: number) {
  return { touches: [toque(clientX, clientY)] } as unknown as TouchEvent
}

function fin(clientX: number, clientY: number) {
  return { changedTouches: [toque(clientX, clientY)] } as unknown as TouchEvent
}

describe('useSwipe', () => {
  it('detecta un swipe hacia la izquierda', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    const { result } = renderHook(() => useSwipe({ onSwipeLeft, onSwipeRight }))

    act(() => {
      result.current.handlers.onTouchStart(inicio(200, 100))
      result.current.handlers.onTouchMove(movimiento(140, 104))
      result.current.handlers.onTouchEnd(fin(120, 104))
    })

    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
    expect(onSwipeRight).not.toHaveBeenCalled()
    expect(result.current.consumirSwipe()).toBe(true)
  })

  it('detecta un swipe hacia la derecha', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    const { result } = renderHook(() => useSwipe({ onSwipeLeft, onSwipeRight }))

    act(() => {
      result.current.handlers.onTouchStart(inicio(100, 100))
      result.current.handlers.onTouchMove(movimiento(160, 104))
      result.current.handlers.onTouchEnd(fin(180, 104))
    })

    expect(onSwipeRight).toHaveBeenCalledTimes(1)
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('no dispara navegación con un toque o un desplazamiento corto', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    const { result } = renderHook(() => useSwipe({ onSwipeLeft, onSwipeRight }))

    act(() => {
      result.current.handlers.onTouchStart(inicio(100, 100))
      result.current.handlers.onTouchMove(movimiento(108, 101))
      result.current.handlers.onTouchEnd(fin(108, 101))
    })

    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(onSwipeRight).not.toHaveBeenCalled()
    expect(result.current.consumirSwipe()).toBe(false)
  })

  it('ignora los gestos verticales para no bloquear el scroll', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeRight = vi.fn()
    const { result } = renderHook(() => useSwipe({ onSwipeLeft, onSwipeRight }))

    act(() => {
      result.current.handlers.onTouchStart(inicio(100, 100))
      result.current.handlers.onTouchMove(movimiento(110, 180))
      result.current.handlers.onTouchEnd(fin(110, 180))
    })

    expect(onSwipeLeft).not.toHaveBeenCalled()
    expect(onSwipeRight).not.toHaveBeenCalled()
  })
})
