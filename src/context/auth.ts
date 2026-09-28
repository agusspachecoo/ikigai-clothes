import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type ModoAuth = 'login' | 'registro'

export interface ResultadoAuth {
  error: string | null
  confirmacionPendiente?: boolean
}

export interface AuthContextValue {
  user: User | null
  session: Session | null
  cargando: boolean
  authModalAbierto: boolean
  authModalModo: ModoAuth
  abrirAuthModal: (modo?: ModoAuth) => void
  cerrarAuthModal: () => void
  iniciarSesion: (email: string, password: string) => Promise<ResultadoAuth>
  registrar: (email: string, password: string) => Promise<ResultadoAuth>
  cerrarSesion: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}