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

  /**
   * Devuelve `{ ok, error }`. Antes devolvía solo un booleano y el hook se
   * tragaba el mensaje de Postgres, así que la UI no tenía con qué explicar
   * un fallo al usuario.
   */
  async function insertarResena(
    resena: ResenaInput,
  ): Promise<{ ok: boolean; error: string | null }> {
    const { error: err } = await supabase
      .from('resenas')
      .insert([resena])

    if (!err) return { ok: true, error: null }

    // 42501 = RLS bloqueó el insert. Suele ser un token de storage vencido o
    // una sesión que no coincide con el usuario del comentario.
    const mensaje =
      err.code === '42501'
        ? 'No pudimos publicar tu reseña. Recargá la página e intentá de nuevo.'
        : err.code === '23514'
          ? 'Falta completar algún dato de la reseña.'
          : 'No pudimos guardar tu reseña. Probá de nuevo en unos segundos.'
    return { ok: false, error: err.message ? `${mensaje} (${err.message})` : mensaje }
  }

  return { resenas, loading, error, insertarResena }
}
