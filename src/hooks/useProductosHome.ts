import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { ProductoConStock } from '../types/database'

const ESTADOS_PAGADOS = ['pagado', 'enviado', 'entregado']

interface ResultadoTop {
  productos: ProductoConStock[]
  loading: boolean
}

async function cargarProductosPorIds(ids: string[]): Promise<ProductoConStock[]> {
  const unicos = [...new Set(ids)]
  const mapa = new Map<string, ProductoConStock>()

  for (let i = 0; i < unicos.length; i += 100) {
    const { data, error } = await supabase
      .from('productos')
      .select('*, variaciones_stock(*)')
      .in('id', unicos.slice(i, i + 100))

    if (error) continue
    for (const p of data as ProductoConStock[]) {
      mapa.set(p.id, p)
    }
  }

  return [...mapa.values()]
}

async function crearFallback(limit: number): Promise<ProductoConStock[]> {
  const { data } = await supabase
    .from('productos')
    .select('*, variaciones_stock(*)')
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data ?? []) as ProductoConStock[]
}

async function completarConRecientes(
  actuales: ProductoConStock[],
  limit: number,
): Promise<ProductoConStock[]> {
  if (actuales.length >= limit) return actuales.slice(0, limit)

  const faltantes = limit - actuales.length
  let completados: ProductoConStock[]

  if (actuales.length > 0) {
    const { data } = await supabase
      .from('productos')
      .select('*, variaciones_stock(*)')
      .eq('activo', true)
      .not('id', 'in', `(${actuales.map((p) => p.id).join(',')})`)
      .order('created_at', { ascending: false })
      .limit(faltantes)

    completados = [...actuales, ...((data ?? []) as ProductoConStock[])]
  } else {
    completados = await crearFallback(limit)
  }

  return completados.slice(0, limit)
}

export function useMasVendidos(limit = 8): ResultadoTop {
  const [productos, setProductos] = useState<ProductoConStock[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function cargar() {
      setLoading(true)

      const { data } = await supabase
        .from('orden_items')
        .select('producto_id, cantidad, ordenes!inner(estado)')
        .in('ordenes.estado', ESTADOS_PAGADOS)
        .range(0, 499)

      if (cancelled) return

      const contador = new Map<string, number>()
      for (const item of data ?? []) {
        const id = String(item.producto_id)
        contador.set(id, (contador.get(id) ?? 0) + Number(item.cantidad ?? 1))
      }

      const ordenados = [...contador.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id]) => id)

      const ids = await cargarProductosPorIds(ordenados)
      if (cancelled) return

      setProductos(await completarConRecientes(ids, limit))
      setLoading(false)
    }

    cargar()
    return () => { cancelled = true }
  }, [limit])

  return { productos, loading }
}

export function useMejorValorados(limit = 8): ResultadoTop {
  const [productos, setProductos] = useState<ProductoConStock[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function cargar() {
      setLoading(true)

      const { data } = await supabase
        .from('resenas')
        .select('producto_id, puntuacion')
        .eq('aprobado', true)

      if (cancelled) return

      const acumulado = new Map<string, { suma: number; cantidad: number }>()
      for (const r of data ?? []) {
        const id = String(r.producto_id)
        const prev = acumulado.get(id) ?? { suma: 0, cantidad: 0 }
        prev.suma += Number(r.puntuacion) || 0
        prev.cantidad += 1
        acumulado.set(id, prev)
      }

      const ordenados = [...acumulado.entries()]
        .map(([id, a]) => ({ id, promedio: a.suma / a.cantidad, cantidad: a.cantidad }))
        .sort((a, b) => b.promedio - a.promedio || b.cantidad - a.cantidad)
        .slice(0, limit)
        .map((p) => p.id)

      const ids = await cargarProductosPorIds(ordenados)
      if (cancelled) return

      setProductos(await completarConRecientes(ids, limit))
      setLoading(false)
    }

    cargar()
    return () => { cancelled = true }
  }, [limit])

  return { productos, loading }
}

export function useDescuentos(limit = 8): ResultadoTop {
  const [productos, setProductos] = useState<ProductoConStock[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function cargar() {
      setLoading(true)
      const { data } = await supabase
        .from('productos')
        .select('*, variaciones_stock(*)')
        .eq('activo', true)
        .gt('discount_percent', 0)
        .order('discount_percent', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit)

      if (!cancelled) {
        setProductos((data ?? []) as ProductoConStock[])
        setLoading(false)
      }
    }

    cargar()
    return () => { cancelled = true }
  }, [limit])

  return { productos, loading }
}

export interface ResenaDestacada {
  id: string
  nombre_usuario: string
  puntuacion: number
  comentario: string
  imagen_url: string | null
  producto_nombre: string | null
  created_at: string
}

export const RESENAS_FALLBACK: ResenaDestacada[] = [
  {
    id: 'fallback-1',
    nombre_usuario: 'Lucas García',
    puntuacion: 5,
    comentario:
      'Las prendas son de altísima calidad y el calce es perfecto. La Remera Oversize se volvió mi favorita para todos los días.',
    imagen_url: null,
    producto_nombre: 'Remera Oversize',
    created_at: '',
  },
  {
    id: 'fallback-2',
    nombre_usuario: 'Sofía Rodríguez',
    puntuacion: 5,
    comentario:
      'Compré el Hoodie Boxy Fit y es súper abrigado. La atención por WhatsApp fue excelente y el envío llegó rapidísimo.',
    imagen_url: null,
    producto_nombre: 'Hoodie Boxy Fit',
    created_at: '',
  },
  {
    id: 'fallback-3',
    nombre_usuario: 'Matías Fernández',
    puntuacion: 5,
    comentario:
      'El Pantalón Cargo es una locura, tela súper resistente y detalles muy cuidados. Me encanta que haya outfit combos.',
    imagen_url: null,
    producto_nombre: 'Pantalón Cargo',
    created_at: '',
  },
  {
    id: 'fallback-4',
    nombre_usuario: 'Camila López',
    puntuacion: 4,
    comentario:
      'Muy buenos productos y precios justos. El Jogger Deportivo lo uso para entrenar y para salir, cómodísimo.',
    imagen_url: null,
    producto_nombre: 'Jogger Deportivo',
    created_at: '',
  },
  {
    id: 'fallback-5',
    nombre_usuario: 'Joaquín Pérez',
    puntuacion: 5,
    comentario:
      'Excelente calidad en todas las prendas. Pedí por transferencia y tuve un 10% de descuento, un golazo.',
    imagen_url: null,
    producto_nombre: 'Remera Oversize',
    created_at: '',
  },
  {
    id: 'fallback-6',
    nombre_usuario: 'Valentina Martínez',
    puntuacion: 5,
    comentario:
      'Mi look favorito es el combo de Hoodie con Jogger. La ropa tiene un estilo único y súper canchero.',
    imagen_url: null,
    producto_nombre: 'Hoodie Boxy Fit',
    created_at: '',
  },
]

export function useResenasDestacadas(limit = 6): { resenas: ResenaDestacada[]; loading: boolean } {
  const [resenas, setResenas] = useState<ResenaDestacada[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function cargar() {
      setLoading(true)

      const { data } = await supabase
        .from('resenas')
        .select(
          'id, nombre_usuario, puntuacion, comentario, imagen_url, created_at, producto:productos(nombre)',
        )
        .eq('aprobado', true)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (cancelled) return

      if ((data ?? []).length > 0) {
        setResenas(
          (data as unknown as (Omit<ResenaDestacada, 'producto_nombre'> & {
            producto: { nombre: string } | { nombre: string }[]
          })[]).map((r) => {
            const producto = Array.isArray(r.producto) ? r.producto[0] : r.producto
            return {
              id: r.id,
              nombre_usuario: r.nombre_usuario,
              puntuacion: r.puntuacion,
              comentario: r.comentario,
              imagen_url: r.imagen_url,
              producto_nombre: (producto as { nombre: string } | null)?.nombre ?? null,
              created_at: r.created_at,
            }
          }),
        )
      } else {
        setResenas(RESENAS_FALLBACK)
      }
      setLoading(false)
    }

    cargar()
    return () => { cancelled = true }
  }, [limit])

  return { resenas, loading }
}