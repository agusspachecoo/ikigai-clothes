import { useState, useEffect } from 'react'
import {
  getOrdenesAdmin,
  actualizarEstadoOrden,
  ESTADOS_ORDEN,
  ESTADO_LABEL,
  type EstadoOrden,
  type OrdenConItems,
} from '../../lib/adminApi'

const BADGE: Record<EstadoOrden, string> = {
  pendiente: 'badge-error',
  pagado: 'badge-success',
  enviado: 'badge-info',
  cancelado: 'badge-neutral',
}

const METODO_LABEL: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  transferencia: 'Transferencia bancaria',
}

export function PedidosAdmin() {
  const [ordenes, setOrdenes] = useState<OrdenConItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'' | EstadoOrden>('')
  const [detalle, setDetalle] = useState<OrdenConItems | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [notificacion, setNotificacion] = useState<string | null>(null)

  useEffect(() => {
    let activo = true

    async function cargar() {
      setLoading(true)
      const { data, error: err } = await getOrdenesAdmin()
      if (activo) {
        setOrdenes(data)
        setError(err)
        setLoading(false)
      }
    }

    cargar()
    return () => { activo = false }
  }, [recarga])

  useEffect(() => {
    if (!notificacion) return
    const t = window.setTimeout(() => setNotificacion(null), 2500)
    return () => window.clearTimeout(t)
  }, [notificacion])

  const filtradas = filtro ? ordenes.filter((o) => o.estado === filtro) : ordenes

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Pedidos</h1>

      {notificacion && (
        <div className="alert alert-success text-sm mb-4 shadow-sm">{notificacion}</div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          className="select select-bordered"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as '' | EstadoOrden)}
        >
          <option value="">Todos los estados</option>
          {ESTADOS_ORDEN.map((e) => (
            <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
          ))}
        </select>
        <span className="text-sm opacity-60">{filtradas.length} pedidos</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-20 w-full rounded-lg"></div>
          ))}
        </div>
      ) : error ? (
        <div className="alert alert-error text-sm">{error}</div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-16 opacity-60">No hay pedidos</div>
      ) : (
        <div className="card bg-base-100 shadow-sm">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Contacto</th>
                  <th>Método</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <span className="font-mono text-sm">{o.id.slice(0, 8).toUpperCase()}</span>
                      <span className="block text-xs opacity-50">
                        {new Date(o.created_at).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="font-medium">{o.cliente_nombre}</td>
                    <td className="text-sm">
                      <span className="block">{o.cliente_email}</span>
                      <span className="text-xs opacity-50">{o.cliente_telefono}</span>
                    </td>
                    <td>
                      <span className="badge badge-outline">{METODO_LABEL[o.metodo_pago] ?? o.metodo_pago}</span>
                    </td>
                    <td className="font-semibold">${Number(o.monto_total).toLocaleString('es-AR')}</td>
                    <td>
                      <span className={`badge ${BADGE[(o.estado as EstadoOrden) ?? 'pendiente']}`}>
                        {ESTADO_LABEL[(o.estado as EstadoOrden) ?? 'pendiente']}
                      </span>
                    </td>
                    <td className="text-right">
                      <button className="btn btn-xs btn-ghost" onClick={() => setDetalle(o)}>
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detalle && (
        <PedidoDetalle
          orden={detalle}
          onCerrar={() => setDetalle(null)}
          onActualizado={() => {
            setDetalle(null)
            setNotificacion('Estado actualizado')
            setRecarga((n) => n + 1)
          }}
        />
      )}
    </div>
  )
}

function PedidoDetalle({
  orden,
  onCerrar,
  onActualizado,
}: {
  orden: OrdenConItems
  onCerrar: () => void
  onActualizado: () => void
}) {
  const [estado, setEstado] = useState<EstadoOrden>((orden.estado as EstadoOrden) ?? 'pendiente')
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const esRetiro = orden.direccion === 'Retiro en showroom'

  async function guardarEstado() {
    setGuardando(true)
    setErrorMsg(null)
    const { error } = await actualizarEstadoOrden(orden.id, estado)
    setGuardando(false)
    if (error) setErrorMsg(error)
    else onActualizado()
  }

  const items = orden.orden_items ?? []

  return (
    <dialog className="modal modal-open" onClose={onCerrar}>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onCerrar}>cerrar</button>
      </form>

      <div className="modal-box max-w-2xl p-0 overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between p-5 border-b border-base-300">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Pedido {orden.id.slice(0, 8).toUpperCase()}</h2>
            <p className="text-xs opacity-50">
              {new Date(orden.created_at).toLocaleString('es-AR')}
            </p>
          </div>
          <button onClick={onCerrar} className="btn btn-ghost btn-circle btn-sm" aria-label="Cerrar">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Cliente */}
          <section>
            <h3 className="font-semibold text-sm mb-2 text-gray-900">Cliente</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm bg-base-200 rounded-xl p-4">
              <div>
                <dt className="opacity-50">Nombre</dt>
                <dd className="font-medium">{orden.cliente_nombre}</dd>
              </div>
              <div>
                <dt className="opacity-50">DNI</dt>
                <dd className="font-medium">{orden.cliente_dni}</dd>
              </div>
              <div>
                <dt className="opacity-50">Email</dt>
                <dd className="font-medium">{orden.cliente_email}</dd>
              </div>
              <div>
                <dt className="opacity-50">Teléfono</dt>
                <dd className="font-medium">{orden.cliente_telefono}</dd>
              </div>
            </dl>
          </section>

          {/* Envío */}
          <section>
            <h3 className="font-semibold text-sm mb-2 text-gray-900">Entrega</h3>
            <div className="bg-base-200 rounded-xl p-4 text-sm">
              {esRetiro ? (
                <p>Retiro en showroom (sin envío).</p>
              ) : (
                <>
                  <p className="font-medium">{orden.direccion}</p>
                  <p className="opacity-60">CP: {orden.codigo_postal}</p>
                </>
              )}
              <p className="opacity-60 mt-1">Costo de envío: ${Number(orden.costo_envio).toLocaleString('es-AR')}</p>
            </div>
          </section>

          {/* Método de pago */}
          <section>
            <h3 className="font-semibold text-sm mb-2 text-gray-900">Pago</h3>
            <div className="bg-base-200 rounded-xl p-4 text-sm flex items-center justify-between">
              <span>{METODO_LABEL[orden.metodo_pago] ?? orden.metodo_pago}</span>
              <span className="font-bold text-primary">
                ${Number(orden.monto_total).toLocaleString('es-AR')}
              </span>
            </div>
            {orden.comprobante_url && (
              <a
                href={orden.comprobante_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-outline mt-2"
              >
                Ver comprobante
              </a>
            )}
          </section>

          {/* Items */}
          <section>
            <h3 className="font-semibold text-sm mb-2 text-gray-900">Ítems</h3>
            <ul className="space-y-2">
              {items.map((it, i) => (
                <li key={i} className="flex items-center gap-3 bg-base-200 rounded-xl p-3">
                  <div className="flex-1 text-sm">
                    <p className="font-medium">{it.producto?.nombre ?? 'Producto'}</p>
                    <p className="text-xs opacity-50">
                      Talle {it.talle} · {it.cantidad} uds
                    </p>
                  </div>
                  <span className="text-sm font-bold">
                    ${(Number(it.precio_unitario) * it.cantidad).toLocaleString('es-AR')}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Estado */}
          <section>
            <h3 className="font-semibold text-sm mb-2 text-gray-900">Estado del pedido</h3>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="select select-bordered select-sm"
                value={estado}
                onChange={(e) => setEstado(e.target.value as EstadoOrden)}
              >
                {ESTADOS_ORDEN.map((e) => (
                  <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
                ))}
              </select>
              <button className="btn btn-primary btn-sm" onClick={guardarEstado} disabled={guardando}>
                {guardando ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  'Actualizar estado'
                )}
              </button>
            </div>
            {errorMsg && <div className="alert alert-error text-sm mt-2">{errorMsg}</div>}
          </section>

          <div className="flex justify-end pt-2 border-t border-base-300 -mx-5 px-5 pb-0">
            <button className="btn btn-ghost" onClick={onCerrar}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}