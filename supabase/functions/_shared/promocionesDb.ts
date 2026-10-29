import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import type { Promocion } from './promociones.ts'

interface GrupoFila {
  cantidad_requerida: number
  orden: number | null
  promocion_grupo_productos: Array<{ producto_id: string }> | null
}

interface PromocionFila {
  id: string
  nombre: string
  descripcion: string | null
  tipo: 'pack' | 'combo'
  descuento_porcentaje: number | null
  precio_fijo: number | null
  prioridad: number | null
  activo: boolean
  fecha_inicio: string | null
  fecha_fin: string | null
  promocion_grupos: GrupoFila[] | null
}

export async function cargarPromocionesActivas(
  supabase: SupabaseClient,
): Promise<{ promociones: Promocion[]; error: string | null }> {
  const { data, error } = await supabase
    .from('promociones')
    .select(
      'id, nombre, descripcion, tipo, descuento_porcentaje, precio_fijo, prioridad, activo, fecha_inicio, fecha_fin, promocion_grupos(cantidad_requerida, orden, promocion_grupo_productos(producto_id))',
    )
    .eq('activo', true)
    .order('prioridad', { ascending: false })

  if (error) return { promociones: [], error: error.message }

  const promociones = ((data ?? []) as PromocionFila[]).map((fila) => ({
    id: String(fila.id),
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    tipo: fila.tipo,
    descuento_porcentaje: fila.descuento_porcentaje,
    precio_fijo: fila.precio_fijo,
    prioridad: Number(fila.prioridad) || 0,
    activo: fila.activo,
    fecha_inicio: fila.fecha_inicio,
    fecha_fin: fila.fecha_fin,
    grupos: (fila.promocion_grupos ?? [])
      .slice()
      .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0))
      .map((grupo) => ({
        cantidad_requerida: Number(grupo.cantidad_requerida) || 1,
        orden: Number(grupo.orden) || 0,
        producto_ids: (grupo.promocion_grupo_productos ?? []).map((producto) =>
          String(producto.producto_id),
        ),
      })),
  }))

  return { promociones, error: null }
}
