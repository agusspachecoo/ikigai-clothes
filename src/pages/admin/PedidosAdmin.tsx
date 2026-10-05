import { useState, useEffect } from 'react'
import {
  getOrdenesAdmin,
  actualizarEstadoOrden,
  comprobanteFirmado,
  ESTADOS_ORDEN,
  ESTADO_LABEL,
  type EstadoOrden,
  type OrdenConItems,
} from '../../lib/adminApi'
import { useCierreModal } from '../../hooks/useCierreModal'

const BADGE: Record<EstadoOrden, string> = {
  pendiente: 'badge-error',
  pendiente_verificacion: 'badge-warning',
  pagado: 'badge-success',
  enviado: 'badge-info',
  entregado: 'badge-neutral',
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
  const [busqueda, setBusqueda] = useState('')
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

  const filtradas = ordenes.filter((o) => {
    const cumpleEstado = filtro ? o.estado === filtro : true
    if (!cumpleEstado) return false
    if (!busqueda.trim()) return true
    const q = busqueda.trim().toLowerCase()
    const idCorto = o.id.slice(0, 8).toLowerCase()
    const idCompleto = o.id.toLowerCase()
    return (
      idCorto.includes(q) ||
      idCompleto.includes(q) ||
      o.cliente_nombre?.toLowerCase().includes(q) ||
      o.cliente_email?.toLowerCase().includes(q)
    )
  })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Pedidos</h1>

      {notificacion && (
        <div className="alert alert-success text-sm mb-4 shadow-sm">{notificacion}</div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          className="input input-bordered w-full sm:w-80"
          placeholder="Buscar por ID de pedido, nombre o email"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
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
                  <th>Comprobante</th>
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
                    <td>
                      {o.comprobante_url ? (
                        <button
                          className="btn btn-xs btn-outline btn-primary"
                          onClick={() => setDetalle(o)}
                        >
                          Ver comprobante
                        </button>
                      ) : (
                        <span className="text-xs opacity-40">—</span>
                      )}
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
  const [mostrarComprobante, setMostrarComprobante] = useState(false)
  useCierreModal(true, onCerrar)
  useCierreModal(mostrarComprobante, () => setMostrarComprobante(false))

  // El bucket de comprobantes es privado: la URL se pide al abrir el modal y
  // expira en 5 minutos, así que hay que firmarla de nuevo en cada apertura.
  const [comprobante, setComprobante] = useState<{ url: string | null; error: string | null }>({
    url: null,
    error: null,
  })

  useEffect(() => {
    if (!mostrarComprobante) return

    let vigente = true
    // El reseteo va en `abrirComprobante`, no acá: setState directo en el cuerpo
    // del efecto dispara un render en cascada.
    comprobanteFirmado(orden.comprobante_url).then((res) => {
      if (vigente) setComprobante(res)
    })

    return () => {
      vigente = false
    }
  }, [mostrarComprobante, orden.comprobante_url])

  function abrirComprobante() {
    setComprobante({ url: null, error: null })
    setMostrarComprobante(true)
  }

  const esRetiro = orden.envio_detalle?.metodo === 'retiro' || orden.direccion === 'Retiro en showroom'

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
    <>
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
              <div className="bg-base-200 rounded-xl p-4 text-sm space-y-1.5">
                {esRetiro ? (
                  <p>Retiro en showroom (sin envío).</p>
                ) : (
                  <>
                    <p className="font-medium">{orden.direccion}</p>
                    <p className="opacity-60">CP destino: {orden.codigo_postal}</p>
                    {orden.envio_detalle?.carrier && (
                      <p className="opacity-60">
                        Transporte: {orden.envio_detalle.carrier}
                        {orden.envio_detalle.servicio ? ` — ${orden.envio_detalle.servicio}` : ''}
                      </p>
                    )}
                    {orden.envio_detalle?.tiempo && (
                      <p className="opacity-60">Tiempo estimado: {orden.envio_detalle.tiempo}</p>
                    )}
                    {orden.envio_detalle?.mock && (
                      <span className="badge badge-warning text-xs">Cotización de prueba (mock)</span>
                    )}
                  </>
                )}
                <p className="opacity-60">Costo de envío: ${Number(orden.costo_envio).toLocaleString('es-AR')}</p>

                {!esRetiro && (Boolean(orden.envio_detalle?.cotizacion) || Boolean(orden.envio_detalle?.seleccion)) && (
                  <details className="mt-2">
                    <summary className="text-xs opacity-50 cursor-pointer hover:opacity-80">
                      Payload completo (para etiqueta)
                    </summary>
                    <pre className="mt-2 p-3 bg-base-300 rounded-lg text-[11px] overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(
                        {
                          seleccion: orden.envio_detalle?.seleccion,
                          cotizacion_completa: orden.envio_detalle?.cotizacion,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                )}
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
            </section>

            {/* Comprobante */}
            {orden.comprobante_url && (
              <section>
                <h3 className="font-semibold text-sm mb-2 text-gray-900">Comprobante de pago</h3>
                <div className="bg-base-200 rounded-xl p-4">
                  <button
                    type="button"
                    onClick={abrirComprobante}
                    className="btn btn-sm btn-outline btn-primary gap-2"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                    </svg>
                    Ver comprobante
                  </button>
                </div>
              </section>
            )}

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
          </div>
        </div>
      </dialog>

      {/* Modal de comprobante */}
      {mostrarComprobante && orden.comprobante_url && (
        <dialog className="modal modal-open" onClose={() => setMostrarComprobante(false)}>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setMostrarComprobante(false)}>cerrar</button>
          </form>
          <div className="modal-box max-w-3xl p-0 overflow-hidden rounded-3xl">
            <div className="flex items-center justify-between p-4 border-b border-base-300">
              <h3 className="font-bold text-gray-900">Comprobante de pago</h3>
            </div>
            <div className="p-4">
              {comprobante.error ? (
                <div className="alert alert-error text-sm">
                  {comprobante.error}
                </div>
              ) : !comprobante.url ? (
                <div className="flex items-center justify-center h-[40vh]">
                  <span className="loading loading-spinner loading-lg" />
                </div>
              ) : comprobante.url.toLowerCase().split('?')[0].endsWith('.pdf') ? (
                <iframe
                  src={comprobante.url}
                  className="w-full h-[70vh] rounded-lg"
                  title="Comprobante"
                />
              ) : (
                <img
                  src={comprobante.url}
                  alt="Comprobante de pago"
                  className="max-w-full max-h-[70vh] mx-auto rounded-lg object-contain"
                />
              )}
            </div>
            <div className="p-4 border-t border-base-300 flex justify-end">
              {comprobante.url && (
                <a
                  href={comprobante.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-outline"
                >
                  Abrir en nueva pestaña
                </a>
              )}
            </div>
          </div>
        </dialog>
      )}
    </>
  )
}
