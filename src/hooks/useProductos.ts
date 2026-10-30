import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DROP_EMBED, esDropFuturo, filtrarDropsFuturos } from '../lib/drops'
import type { ProductoConStock } from '../types/database'

type ProductoProximo = Omit<ProductoConStock, 'variaciones_stock' | 'bloqueado'>

function enmascararProximos(data: unknown): ProductoConStock[] {
  return ((data ?? []) as ProductoProximo[]).map((p) => ({
    ...p,
    variaciones_stock: [],
    bloqueado: true,
  }))
}

interface UseProductosOptions {
  categoria?: string
  buscar?: string
  descuentos?: boolean
  limit?: number
  offset?: number
  productoIds?: string[]
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
        .select(`*, variaciones_stock(*), ${DROP_EMBED}`, { count: 'exact' })
        .eq('activo', true)
        .order('created_at', { ascending: false })

      const ids = options.productoIds?.map((id) => String(id).trim()).filter(Boolean) ?? []
      const tieneIds = ids.length > 0
      const termino = options.buscar?.trim() ?? ''

      if (tieneIds) {
        query = query.in('id', ids)
      } else {
        if (options.categoria) {
          query = query.eq('categoria', options.categoria)
        }

        if (options.descuentos) {
          query = query.gt('discount_percent', 0)
        }

        // Limpiar caracteres que rompen la sintaxis del `.or()` de Supabase
        // (las comas y paréntesis son separadores de cláusula) además de los
        // comodines LIKE. Sin esto, buscar "remera, manga" genera una query inválida.
        if (termino) {
          query = query.or(`nombre.ilike.%${termino}%,categoria.ilike.%${termino}%`)
        }
      }

      if (options.limit) {
        query = query.range(options.offset ?? 0, (options.offset ?? 0) + options.limit - 1)
      }

      // Drops futuros: se traen enmascarados por RPC (la RLS los sigue ocultando).
      // No corresponden en la vista "Ofertas", porque aún no tienen descuento.
      const proximos = tieneIds
        ? Promise.resolve({ data: [] })
        : options.descuentos
          ? Promise.resolve({ data: [] })
          : supabase.rpc('productos_proximos', {
            p_categoria: options.categoria ?? null,
            p_buscar: termino || null,
          })

      const [{ data, error: err, count }, prox] = await Promise.all([query, proximos])
      const pendientes = enmascararProximos(prox?.data)

      if (!cancelled) {
        if (err) {
          setError(err.message)
        } else {
          // La tabla trae TODOS los productos activos; descartamos los de drops
          // futuros y los volvemos a agregar enmascarados vía el RPC.
          const reales = filtrarDropsFuturos((data ?? []) as ProductoConStock[])
          const descartados = (data?.length ?? 0) - reales.length
          setProductos([...reales, ...pendientes])
          setTotal(Math.max(0, (count ?? 0) - descartados + pendientes.length))
        }
        setLoading(false)
      }
    }

    fetchProductos()
    return () => { cancelled = true }
  }, [options.categoria, options.buscar, options.descuentos, options.limit, options.offset, options.productoIds])

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
        .select(`*, variaciones_stock(*), ${DROP_EMBED}`)
        .eq('id', id as string)
        .single()

      if (!cancelled) {
        const encontrado = data as ProductoConStock | null
        if (err) setError(err.message)
        else if (encontrado && esDropFuturo(encontrado)) {
          // Enlace directo a un producto de un drop aún no lanzado: no se revela.
          setError('Este producto forma parte de un próximo lanzamiento.')
        } else setProducto(encontrado)
        setLoading(false)
      }
    }

    fetchProducto()
    return () => { cancelled = true }
  }, [id])

  return { producto, loading, error }
}
