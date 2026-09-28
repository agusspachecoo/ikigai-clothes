import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { SuscriptorNewsletter } from '../../types/database'

export function NewsletterAdmin() {
  const [suscriptores, setSuscriptores] = useState<SuscriptorNewsletter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notificacion, setNotificacion] = useState<string | null>(null)
  const [buscar, setBuscar] = useState('')

  async function cargar() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('suscriptores_newsletter')
      .select('*')
      .order('created_at', { ascending: false })
    setSuscriptores((data ?? []) as SuscriptorNewsletter[])
    setError(err?.message ?? null)
    setLoading(false)
  }

  useEffect(() => {
    let activo = true
    void (async () => {
      await Promise.resolve()
      await cargar()
      if (!activo) return
    })()
    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    if (!notificacion) return
    const t = window.setTimeout(() => setNotificacion(null), 2500)
    return () => window.clearTimeout(t)
  }, [notificacion])

  const filtrados = suscriptores.filter((s) =>
    s.email.toLowerCase().includes(buscar.trim().toLowerCase()),
  )
  const activos = suscriptores.filter((s) => s.activo).length

  function exportarCsv() {
    const filas = [
      ['email', 'activo', 'suscrito', new Date().toISOString()],
      ...suscriptores.map((s) => [s.email, String(s.activo), s.created_at]),
    ]
    const csv = filas.map((f) => f.map((c) => `"${c}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `newsletter-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function alternar(s: SuscriptorNewsletter) {
    const { error: err } = await supabase
      .from('suscriptores_newsletter')
      .update({ activo: !s.activo })
      .eq('id', s.id)
    if (err) setNotificacion(`Error: ${err.message}`)
    void cargar()
  }

  async function eliminar(s: SuscriptorNewsletter) {
    if (!window.confirm(`¿Eliminar ${s.email} de la lista?`)) return
    const { error: err } = await supabase
      .from('suscriptores_newsletter')
      .delete()
      .eq('id', s.id)
    if (err) setNotificacion(`Error: ${err.message}`)
    void cargar()
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Newsletter</h1>
        <div className="flex items-center gap-2">
          <input
            type="search"
            className="input input-bordered input-sm w-56"
            placeholder="Buscar email"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
          <button
            className="btn btn-sm btn-outline"
            onClick={exportarCsv}
            disabled={suscriptores.length === 0}
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {notificacion && <div className="alert alert-success text-sm mb-4">{notificacion}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card bg-base-100 p-4">
          <p className="text-xs uppercase tracking-widest opacity-60">Suscriptos</p>
          <p className="text-2xl font-bold">{suscriptores.length}</p>
        </div>
        <div className="card bg-base-100 p-4">
          <p className="text-xs uppercase tracking-widest opacity-60">Activos</p>
          <p className="text-2xl font-bold">{activos}</p>
        </div>
        <div className="card bg-base-100 p-4">
          <p className="text-xs uppercase tracking-widest opacity-60">Desuscritos</p>
          <p className="text-2xl font-bold">{suscriptores.length - activos}</p>
        </div>
        <div className="card bg-base-100 p-4">
          <p className="text-xs uppercase tracking-widest opacity-60">Último</p>
          <p className="text-sm mt-1">
            {suscriptores[0]?.created_at.slice(0, 10) ?? '—'}
          </p>
        </div>
      </div>

      <div className="card bg-base-100 shadow-sm">
        {error ? (
          <div className="p-4">
            <div className="alert alert-error text-sm">{error}</div>
          </div>
        ) : loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-10 w-full" />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <p className="p-6 text-sm opacity-60">
            {suscriptores.length === 0
              ? 'Todavía no hay suscriptores.'
              : 'No hay resultados para la búsqueda.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Suscrito</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-sm">{s.email}</td>
                    <td className="text-sm opacity-70">
                      {new Date(s.created_at).toLocaleDateString('es-AR')}
                    </td>
                    <td>
                      <span className={`badge badge-sm ${s.activo ? 'badge-success' : 'badge-ghost'}`}>
                        {s.activo ? 'Activo' : 'Pausado'}
                      </span>
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <button className="btn btn-xs btn-ghost" onClick={() => alternar(s)}>
                        {s.activo ? 'Pausar' : 'Reactivar'}
                      </button>
                      <button
                        className="btn btn-xs btn-ghost text-error"
                        onClick={() => eliminar(s)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
