import { createContext, useContext } from 'react'

export interface FavoritosContextValue {
  /** Ids de producto marcados como favoritos por el usuario actual */
  favoritos: Set<string>
  cargando: boolean
  total: number
  esFavorito: (productoId: string) => boolean
  /** Agrega o quita un favorito. Requiere sesión. */
  alternar: (productoId: string) => Promise<{ error: string | null }>
  recargar: () => Promise<void>
}

export const FavoritosContext = createContext<FavoritosContextValue | null>(null)

export function useFavoritos() {
  const ctx = useContext(FavoritosContext)
  if (!ctx) throw new Error('useFavoritos debe usarse dentro de FavoritosProvider')
  return ctx
}
