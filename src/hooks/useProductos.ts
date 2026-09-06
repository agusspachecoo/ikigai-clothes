import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { ProductoConStock } from '../types/database'

interface UseProductosOptions {
  categoria?: string
  buscar?: string
  limit?: number
  offset?: number
}

interface UseProductosResult {
  productos: ProductoConStock[]
  loading: boolean
  error: string | null
  total: number
}

export function useProductos(options: UseProductosOptions = {}): UseProductosResult {
  const [productos, setProductos] = useState<ProductoConStock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function fetchProductos() {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('productos')
        .select('*, variaciones_stock(*)', { count: 'exact' })
        .eq('activo', true)
        .order('created_at', { ascending: false })

      if (options.categoria) {
        query = query.eq('categoria', options.categoria)
      }

      if (options.buscar) {
        const termino = options.buscar.replace(/["'%\\]/g, '')
        query = query.or(`nombre.ilike.%${termino}%,categoria.ilike.%${termino}%`)
      }

      if (options.limit) {
        query = query.range(options.offset ?? 0, (options.offset ?? 0) + options.limit - 1)
      }

      const { data, error: err, count } = await query

      if (!cancelled) {
        if (err) {
          setError(err.message)
        } else {
          setProductos(data as ProductoConStock[])
          setTotal(count ?? 0)
        }
        setLoading(false)
      }
    }

    fetchProductos()
    return () => { cancelled = true }
  }, [options.categoria, options.buscar, options.limit, options.offset])

  return { productos, loading, error, total }
}

export function useProducto(id: string | null) {
  const [producto, setProducto] = useState<ProductoConStock | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    let cancelled = false

    async function fetchProducto() {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('productos')
        .select('*, variaciones_stock(*)')
        .eq('id', id as string)
        .single()

      if (!cancelled) {
        if (err) setError(err.message)
        else setProducto(data as ProductoConStock)
        setLoading(false)
      }
    }

    fetchProducto()
    return () => { cancelled = true }
  }, [id])

  return { producto, loading, error }
}
