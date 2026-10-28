import { useEffect, useMemo, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { leerRecuperacionDeUrl, urlRestablecerPassword } from '../lib/authUrls'
import { AuthContext } from './auth'
import type { ModoAuth, ResultadoAuth } from './auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)
  const [authModalAbierto, setAuthModalAbierto] = useState(false)
  const [authModalModo, setAuthModalModo] = useState<ModoAuth>('login')
  const [recuperacionPendiente, setRecuperacionPendiente] = useState(
    () => leerRecuperacionDeUrl().esRecuperacion,
  )

  useEffect(() => {
    let activo = true
    const recuperacionUrl = leerRecuperacionDeUrl()

    supabase.auth.getSession().then(async ({ data }) => {
      if (!activo) return

      let sesionActual = data.session

      // Fallback: si Supabase no procesó el enlace automáticamente, consumimos
      // el token capturado de la URL (implícito, PKCE o token_hash).
      if (!sesionActual && recuperacionUrl.esRecuperacion) {
        if (recuperacionUrl.accessToken && recuperacionUrl.refreshToken) {
          const { data: datosSesion } = await supabase.auth.setSession({
            access_token: recuperacionUrl.accessToken,
            refresh_token: recuperacionUrl.refreshToken,
          })
          if (!activo) return
          sesionActual = datosSesion.session
        } else if (recuperacionUrl.code) {
          const { data: datosSesion } = await supabase.auth.exchangeCodeForSession(
            recuperacionUrl.code,
          )
          if (!activo) return
          sesionActual = datosSesion.session
        } else if (recuperacionUrl.tokenHash) {
          const { data: datosSesion } = await supabase.auth.verifyOtp({
            type: 'recovery',
            token_hash: recuperacionUrl.tokenHash,
          })
          if (!activo) return
          sesionActual = datosSesion.session
        }
      }

      setSession(sesionActual)
      setUser(sesionActual?.user ?? null)
      setCargando(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!activo) return

      // `PASSWORD_RECOVERY` es el evento esperado. Algunos flujos (PKCE/code)
      // emiten `SIGNED_IN`: si la URL venía marcada como recuperación, lo
      // tratamos igual para no abrir el modal de login tradicional.
      const esRecuperacion =
        event === 'PASSWORD_RECOVERY' ||
        (event === 'SIGNED_IN' && recuperacionUrl.esRecuperacion)

      if (esRecuperacion) {
        setRecuperacionPendiente(true)
        setAuthModalAbierto(false)
      }
      if (event === 'SIGNED_OUT') setRecuperacionPendiente(false)
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setCargando(false)
    })

    return () => {
      activo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const abrirAuthModal = useCallback((modo: ModoAuth = 'login') => {
    setAuthModalModo(modo)
    setAuthModalAbierto(true)
  }, [])
  const cerrarAuthModal = useCallback(() => setAuthModalAbierto(false), [])

  const iniciarSesion = useCallback(async (email: string, password: string): Promise<ResultadoAuth> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: traducirError(error.message) }
    setAuthModalAbierto(false)
    return { error: null }
  }, [])

  const registrar = useCallback(async (email: string, password: string): Promise<ResultadoAuth> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) return { error: traducirError(error.message) }
    if (!data.session && data.user) {
      const sessionAntes = (await supabase.auth.getSession()).data.session
      if (!sessionAntes) return { error: null, confirmacionPendiente: true }
    }
    setAuthModalAbierto(false)
    return { error: null }
  }, [])

  const recuperarPassword = useCallback(async (email: string): Promise<ResultadoAuth> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: urlRestablecerPassword(),
    })
    if (error) return { error: traducirError(error.message) }
    return { error: null }
  }, [])

  const cambiarPassword = useCallback(async (password: string): Promise<ResultadoAuth> => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { error: traducirError(error.message) }
    setRecuperacionPendiente(false)
    return { error: null }
  }, [])

  const cerrarSesion = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = useMemo(
    () => ({
      user,
      session,
      cargando,
      authModalAbierto,
      authModalModo,
      recuperacionPendiente,
      abrirAuthModal,
      cerrarAuthModal,
      iniciarSesion,
      registrar,
      recuperarPassword,
      cambiarPassword,
      cerrarSesion,
    }),
    [user, session, cargando, authModalAbierto, authModalModo, recuperacionPendiente, abrirAuthModal, cerrarAuthModal, iniciarSesion, registrar, recuperarPassword, cambiarPassword, cerrarSesion],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function traducirError(mensaje: string): string {
  const msg = mensaje.toLowerCase()
  if (msg.includes('invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (msg.includes('email not confirmed')) return 'Confirmá tu email antes de iniciar sesión.'
  if (msg.includes('already registered')) return 'Ese email ya está registrado. Iniciá sesión.'
  if (msg.includes('invalid email') || msg.includes('invalid format')) {
    return 'Ingresá un email válido.'
  }
  if (msg.includes('should be different') || msg.includes('same password')) {
    return 'La nueva contraseña debe ser distinta a la anterior.'
  }
  if (msg.includes('auth session missing') || msg.includes('session expired')) {
    return 'Tu sesión venció. Pedí un nuevo enlace de recuperación.'
  }
  if (msg.includes('password')) return 'La contraseña debe tener al menos 8 caracteres.'
  if (msg.includes('rate limit')) return 'Demasiados intentos. Esperá unos minutos y volvé a intentar.'
  return mensaje
}