import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Drop, DropPreviewProducto, ProductoConStock } from '../types/database'

export interface DropVista {
  drop: Drop
  /** `true` si la fecha de lanzamiento ya pasó (o venció el temporizador). */
  lanzado: boolean
  /** Productos completos, sólo cuando el drop ya se lanzó. */
  productos: ProductoConStock[]
  /** Vista previa (id + primera imagen) de los drops que aún no salieron. */
  previews: DropPreviewProducto[]
}

interface Resultado {
  drops: DropVista[]
  loading: boolean
  recargar: () => void
}

async function cargarProductos(dropId: string): Promise<ProductoConStock[]> {
  const { data } = await supabase
    .from('productos')
    .select('*, variaciones_stock(*)')
    .eq('drop_id', dropId)
    .order('created_at', { ascending: true })
  return (data ?? []) as ProductoConStock[]
}

async function cargarPreview(dropId: string): Promise<DropPreviewProducto[]> {
  const { data } = await supabase.rpc('drop_preview', { p_drop_id: dropId })
  return (data ?? []) as DropPreviewProducto[]
}

/**
 * Carga los drops activos para la Home. Los que ya se lanzaron traen sus
 * productos completos (la RLS ya los permite); los futuros traen sólo la vista
 * previa difuminada a través de `drop_preview`.
 */
export function useDropsDestacados(): Resultado {
  const [drops, setDrops] = useState<DropVista[]>([])
  const [loading, setLoading] = useState(true)
  const [recarga, setRecarga] = useState(0)

  const recargar = useCallback(() => setRecarga((n) => n + 1), [])

  useEffect(() => {
    let activo = true

    async function cargar() {
      setLoading(true)

      const { data, error } = await supabase
        .from('drops')
        .select('*')
        .eq('activo', true)
        .order('fecha_lanzamiento', { ascending: true })

      if (error || !data) {
        if (activo) {
          setDrops([])
          setLoading(false)
        }
        return
      }

      const base = data as Drop[]
      const vistas = await Promise.all(
        base.map(async (drop): Promise<DropVista> => {
          const lanzado = new Date(drop.fecha_lanzamiento).getTime() <= Date.now()
          if (lanzado) {
            return { drop, lanzado, productos: await cargarProductos(drop.id), previews: [] }
          }
          return { drop, lanzado, productos: [], previews: await cargarPreview(drop.id) }
        }),
      )

      if (activo) {
        setDrops(vistas)
        setLoading(false)
      }
    }

    cargar()
    return () => { activo = false }
  }, [recarga])

  return { drops, loading, recargar }
}
