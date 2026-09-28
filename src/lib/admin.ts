import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

/**
 * Acceso al panel de administración.
 *
 * El admin es un usuario de Supabase Auth con perfiles.es_admin = true.
 * La contraseña nunca vive en el frontend: se verifica contra Supabase y
 * el permiso real lo decide la política public.es_admin() en la base.
 */

export async function tienePermisoAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('es_admin')
    .eq('id', userId)
    .maybeSingle()

  if (error) return false
  return data?.es_admin === true
}

export async function iniciarSesionAdmin(
  email: string,
  password: string,
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error) {
    return { error: traducirError(error.message) }
  }

  // Puede haber sesión válida sin ser admin: en ese caso se corta.
  if (!data.user || !(await tienePermisoAdmin(data.user.id))) {
    await supabase.auth.signOut()
    return { error: 'Tu cuenta no tiene acceso al panel.' }
  }

  return { error: null }
}

export async function salirAdmin(): Promise<void> {
  await supabase.auth.signOut()
}

export interface EstadoAdmin {
  user: User | null
  esAdmin: boolean
  cargando: boolean
}

/** Sigue la sesión de Supabase y resuelve si el usuario es administrador. */
export function useEsAdmin(): EstadoAdmin {
  const [user, setUser] = useState<User | null>(null)
  const [esAdmin, setEsAdmin] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vigente = true

    async function resolver(sessionUser: User | null) {
      if (!vigente) return
      if (!sessionUser) {
        setUser(null)
        setEsAdmin(false)
        setCargando(false)
        return
      }
      setUser(sessionUser)
      const permitido = await tienePermisoAdmin(sessionUser.id)
      if (!vigente) return
      setEsAdmin(permitido)
      setCargando(false)
    }

    supabase.auth.getSession().then(({ data }) => {
      void resolver(data.session?.user ?? null)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      void resolver(sesion?.user ?? null)
    })

    return () => {
      vigente = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return { user, esAdmin, cargando }
}

function traducirError(mensaje: string): string {
  const msg = mensaje.toLowerCase()
  if (msg.includes('invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (msg.includes('email not confirmed')) return 'Confirmá tu email antes de ingresar.'
  return 'No pudimos iniciar sesión. Probá de nuevo.'
}
