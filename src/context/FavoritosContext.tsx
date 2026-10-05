import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './auth'
import { FavoritosContext } from './favoritos'
import { agregarFavorito, listarIdsFavoritos, quitarFavorito } from '../lib/favoritos'

/**
 * Estado global de favoritos.
 *
 * Se carga al iniciar sesión (y se vacía al cerrarla). El toggle es optimista:
 * el corazón cambia al instante y, si la escritura falla, se revierte. La RLS
 * de `favoritos` es la que garantiza que nadie toque filas ajenas.
 */
export function FavoritosProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set())
  const [cargando, setCargando] = useState(false)

  const recargar = useCallback(async () => {
    if (!user) {
      setFavoritos(new Set())
      return
    }
    setCargando(true)
    const { ids } = await listarIdsFavoritos(user.id)
    setFavoritos(new Set(ids))
    setCargando(false)
  }, [user])

  useEffect(() => {
    let activo = true

    async function cargar() {
      if (!user) {
        setFavoritos(new Set())
        return
      }
      setCargando(true)
      const { ids } = await listarIdsFavoritos(user.id)
      if (!activo) return
      setFavoritos(new Set(ids))
      setCargando(false)
    }

    cargar()
    return () => {
      activo = false
    }
  }, [user])

  const alternar = useCallback(
    async (productoId: string) => {
      if (!user) return { error: 'Necesitás iniciar sesión para guardar favoritos.' }

      const yaEs = favoritos.has(productoId)

      setFavoritos((prev) => {
        const next = new Set(prev)
        if (yaEs) next.delete(productoId)
        else next.add(productoId)
        return next
      })

      const { error } = yaEs
        ? await quitarFavorito(user.id, productoId)
        : await agregarFavorito(user.id, productoId)

      if (error) {
        // Rollback: la UI no puede quedar mintiendo si la DB rechazó el cambio.
        setFavoritos((prev) => {
          const next = new Set(prev)
          if (yaEs) next.add(productoId)
          else next.delete(productoId)
          return next
        })
      }

      return { error }
    },
    [user, favoritos],
  )

  const esFavorito = useCallback(
    (productoId: string) => favoritos.has(productoId),
    [favoritos],
  )

  const value = useMemo(
    () => ({
      favoritos,
      cargando,
      total: favoritos.size,
      esFavorito,
      alternar,
      recargar,
    }),
    [favoritos, cargando, esFavorito, alternar, recargar],
  )

  return <FavoritosContext.Provider value={value}>{children}</FavoritosContext.Provider>
}
