import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Talle } from '../types/database'

/**
 * Caché a nivel de módulo: la lista maestra de talles cambia poco y la usan
 * varios componentes (tarjetas, ficha, filtros). Se pide una sola vez por
 * sesión de navegador y se reutiliza, con un fallback por si Supabase no
 * responde (migración 024 sin aplicar, offline, etc.).
 */
let cacheActivos: string[] | null = null
let promesa: Promise<string[]> | null = null

function cargarActivos(): Promise<string[]> {
  if (cacheActivos) return Promise.resolve(cacheActivos)
  if (promesa) return promesa

  promesa = (async () => {
    const { data, error } = await supabase
      .from('talles')
      .select('nombre, orden')
      .eq('activo', true)
      .order('orden', { ascending: true })
    if (error || !data) return []
    const nombres = (data as Pick<Talle, 'nombre'>[]).map((t) => t.nombre)
    cacheActivos = nombres
    return nombres
  })()

  return promesa
}

/** Nombres de talles activos ordenados por la lista maestra. */
export function useTalles(): { orden: string[]; loading: boolean } {
  const [orden, setOrden] = useState<string[]>(() => cacheActivos ?? [])
  const [loading, setLoading] = useState(!cacheActivos)

  useEffect(() => {
    if (cacheActivos) return
    let activo = true
    cargarActivos().then((nombres) => {
      if (activo) {
        setOrden(nombres)
        setLoading(false)
      }
    })
    return () => {
      activo = false
    }
  }, [])

  return { orden, loading }
}
