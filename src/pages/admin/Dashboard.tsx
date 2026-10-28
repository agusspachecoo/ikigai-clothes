import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getProductosAdmin, getOutfitsAdmin, getOrdenesAdmin, getResenasAdmin } from '../../lib/adminApi'

interface Stats {
  productos: number
  productosActivos: number
  outfits: number
  outfitsActivos: number
  pedidos: number
  pedidosPendientes: number
  pedidosPagados: number
  ventasPagadas: number
  resenasPendientes: number
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true

    async function cargar() {
      const [p, o, or, r] = await Promise.all([
        getProductosAdmin(),
        getOutfitsAdmin(),
        getOrdenesAdmin(),
        getResenasAdmin(),
      ])

      if (p.error || o.error || or.error || r.error) {
        setError((p.error ?? o.error ?? or.error ?? r.error) as string)
        setLoading(false)
        return
      }

      if (activo) {
        setStats({
          productos: p.data.length,
          productosActivos: p.data.filter((x) => x.activo).length,
          outfits: o.data.length,
          outfitsActivos: o.data.filter((x) => x.activo).length,
          pedidos: or.data.length,
          pedidosPendientes: or.data.filter((x) => x.estado === 'pendiente').length,
          pedidosPagados: or.data.filter((x) => x.estado === 'pagado').length,
          ventasPagadas: or.data
            .filter((x) => x.estado === 'pagado' || x.estado === 'enviado')
            .reduce((n, x) => n + Number(x.monto_total), 0),
          resenasPendientes: r.data.filter((x) => !x.aprobado).length,
        })
        setLoading(false)
      }
    }

    cargar()
    return () => { activo = false }
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28 w-full rounded-2xl"></div>
        ))}
      </div>
    )
  }

  if (error) {
    return <div className="alert alert-error text-sm">Error al cargar estadísticas: {error}</div>
  }

  if (!stats) return null

  const cards = [
    { label: 'Productos activos', value: `${stats.productosActivos}/${stats.productos}`, to: '/admin/productos' },
    { label: 'Outfits activos', value: `${stats.outfitsActivos}/${stats.outfits}`, to: '/admin/outfits' },
    { label: 'Pedidos totales', value: String(stats.pedidos), to: '/admin/pedidos' },
    { label: 'Pedidos pendientes', value: String(stats.pedidosPendientes), to: '/admin/pedidos' },
    { label: 'Pedidos pagados', value: String(stats.pedidosPagados), to: '/admin/pedidos' },
    { label: 'Ventas pagadas', value: `$${stats.ventasPagadas.toLocaleString('es-AR')}`, to: '/admin/pedidos' },
    { label: 'Reseñas por moderar', value: String(stats.resenasPendientes), to: '/admin/resenas' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="card bg-base-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="card-body p-5">
              <p className="text-xs font-semibold uppercase tracking-widest opacity-50">{c.label}</p>
              <p className="text-2xl font-bold mt-1">{c.value}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}