import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Resena } from '../types/database'

interface ResenaInput {
  producto_id: string
  nombre_usuario: string
  puntuacion: number
  comentario: string
  imagen_url?: string | null
}

export function useResenas(productoId: string | null) {
  const [resenas, setResenas] = useState<Resena[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!productoId) return

    let cancelled = false

    async function fetchResenas() {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('resenas')
        .select('*')
        .eq('producto_id', productoId as string)
        .eq('aprobado', true)
        .order('created_at', { ascending: false })

      if (!cancelled) {
        if (err) setError(err.message)
        else setResenas(data as Resena[])
        setLoading(false)
      }
    }

    fetchResenas()
    return () => { cancelled = true }
  }, [productoId])

  async function insertarResena(resena: ResenaInput) {
    const { error: err } = await supabase
      .from('resenas')
      .insert([resena])

    return !err
  }

  return { resenas, loading, error, insertarResena }
}
