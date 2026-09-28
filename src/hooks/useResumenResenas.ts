import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Producto } from '../types/database'

export interface ResumenResenas {
  promedio: number
  cantidad: number
}

export function useResumenResenas(productos: Producto[]) {
  const [stats, setStats] = useState<Record<string, ResumenResenas>>({})

  const claveIds = productos.map((p) => p.id).join('|')

  useEffect(() => {
    let cancelled = false

    async function fetchStats() {
      const ids = claveIds ? claveIds.split('|') : []
      if (ids.length === 0) {
        setStats({})
        return
      }

      const acumulado: Record<string, { suma: number; cantidad: number }> = {}

      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await supabase
          .from('resenas')
          .select('producto_id, puntuacion')
          .in('producto_id', ids.slice(i, i + 100))
          .eq('aprobado', true)

        if (cancelled) return
        if (!error && data) {
          for (const r of data) {
            const key = String(r.producto_id)
            const prev = acumulado[key] ?? { suma: 0, cantidad: 0 }
            prev.suma += Number(r.puntuacion) || 0
            prev.cantidad += 1
            acumulado[key] = prev
          }
        }
      }

      if (cancelled) return

      const resultado: Record<string, ResumenResenas> = {}
      for (const [id, aj] of Object.entries(acumulado)) {
        resultado[id] = {
          promedio: aj.cantidad ? Math.round((aj.suma / aj.cantidad) * 10) / 10 : 0,
          cantidad: aj.cantidad,
        }
      }
      setStats(resultado)
    }

    fetchStats()
    return () => { cancelled = true }
  }, [claveIds])

  return { stats }
}