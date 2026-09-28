import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Perfil } from '../types/database'

export interface DatosPerfil {
  nombre: string
  apellido: string
  dni: string
  telefono: string
}

export function usePerfil(userId: string | undefined) {
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [cargando, setCargando] = useState(false)
  const [cargandoPerfil, setCargandoPerfil] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchPerfil() {
      if (!userId) {
        setPerfil(null)
        setCargandoPerfil(false)
        return
      }

      setCargandoPerfil(true)
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (!cancelled) {
        if (!error && data) setPerfil(data as Perfil)
        setCargandoPerfil(false)
      }
    }

    fetchPerfil()
    return () => { cancelled = true }
  }, [userId])

  async function actualizarPerfil(datos: DatosPerfil) {
    if (!userId) return { error: 'No hay sesión iniciada' }

    setCargando(true)
    const updates: Record<string, string | null> = {
      nombre: datos.nombre.trim() || null,
      apellido: datos.apellido.trim() || null,
      dni: datos.dni.trim() || null,
      telefono: datos.telefono.trim() || null,
    }

    const { error } = await supabase
      .from('perfiles')
      .upsert({ id: userId, ...updates })

    if (!error) {
      setPerfil(prev => prev ? { ...prev, ...updates } : prev)
    }
    setCargando(false)
    return { error: error ? error.message : null }
  }

  return { perfil, cargandoPerfil, cargando, actualizarPerfil }
}