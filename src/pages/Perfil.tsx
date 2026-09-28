import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { getMisPedidos, ESTADO_PEDIDO_LABEL, ESTADO_PEDIDO_CLASS } from '../lib/misPedidos'
import type { OrdenConItems } from '../lib/misPedidos'
import { imagenProducto } from '../lib/imagenes'
import { usePerfil, type DatosPerfil } from '../hooks/usePerfil'
import { esDNIValido, esTelefonoValido, MENSAJE_DNI, MENSAJE_TELEFONO } from '../lib/validacion'
import type { Perfil } from '../types/database'

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function nombreIniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/)
  if (partes.length === 0) return 'U'
  return partes.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
}

export function Perfil() {
  const { user, cargando, abrirAuthModal, cerrarSesion } = useAuth()

  if (cargando) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-3">
        <div className="skeleton h-32 w-full rounded-2xl" />
        <div className="skeleton h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="card bg-base-100 shadow-sm p-10 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-base-300 flex items-center justify-center mb-4">
            <svg className="h-8 w-8 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-2">Mi perfil</h1>
          <p className="opacity-70 text-sm max-w-sm mx-auto mb-6">
            Iniciá sesión para consultar tus pedidos y ver su estado actualizado.
          </p>
          <div className="flex justify-center gap-2">
            <button className="btn btn-primary" onClick={() => abrirAuthModal()}>
              Iniciar sesión
            </button>
            <Link to="/catalogo" className="btn btn-ghost">
              Seguir comprando
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <PerfilAutenticado userId={user.id} email={user.email ?? ''} nombre={user.email?.split('@')[0] ?? ''} onCerrarSesion={cerrarSesion} />
}

function PerfilAutenticado({
  userId,
  email,
  nombre,
  onCerrarSesion,
}: {
  userId: string
  email: string
  nombre: string
  onCerrarSesion: () => Promise<void>
}) {
  const [pedidos, setPedidos] = useState<OrdenConItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'pedidos' | 'cuenta'>('pedidos')
  const location = useLocation()
  const tabDesdeNavegacion = (location.state as { tab?: 'pedidos' | 'cuenta' } | null)?.tab ?? null
  const [ultimoTab, setUltimoTab] = useState<typeof tabDesdeNavegacion>(tabDesdeNavegacion)
  if (tabDesdeNavegacion && tabDesdeNavegacion !== ultimoTab) {
    setUltimoTab(tabDesdeNavegacion)
    setTab(tabDesdeNavegacion)
  }
  const { perfil, cargandoPerfil, actualizarPerfil } = usePerfil(userId)

  useEffect(() => {
    let activo = true

    async function cargar() {
      setLoading(true)
      const res = await getMisPedidos(email)
      if (!activo) return
      setPedidos(res.data)
      setError(res.error)
      setLoading(false)
    }

    cargar()
    return () => {
      activo = false
    }
  }, [email])

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Cabecera del perfil */}
      <div className="card bg-base-100 shadow-sm p-6 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="avatar placeholder">
            <div className="bg-black text-white rounded-full w-14 h-14 text-lg font-bold flex items-center justify-center">
              {nombreIniciales(nombre)}
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">Hola, {nombre}</h1>
            <p className="text-sm opacity-60 truncate">{email}</p>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={async () => { await onCerrarSesion() }}>
          Cerrar sesión
        </button>
      </div>

      {/* Tabs */}
      <div role="tablist" className="tabs tabs-boxed gap-1 p-1 mb-6 w-fit">
        <button
          role="tab"
          type="button"
          className={`tab ${tab === 'pedidos' ? 'tab-active' : ''}`}
          onClick={() => setTab('pedidos')}
        >
          Mis Pedidos
        </button>
        <button
          role="tab"
          type="button"
          className={`tab ${tab === 'cuenta' ? 'tab-active' : ''}`}
          onClick={() => setTab('cuenta')}
        >
          Mi cuenta
        </button>
      </div>

      {tab === 'pedidos' && (
        <section>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="skeleton h-40 w-full rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <div className="alert alert-error text-sm">{error}</div>
          ) : pedidos.length === 0 ? (
            <div className="card bg-base-100 shadow-sm p-10 text-center">
              <p className="opacity-70">Todavía no tenés pedidos registrados con esta cuenta.</p>
              <Link to="/catalogo" className="btn btn-primary btn-sm mx-auto mt-4 w-fit">
                Comenzar a comprar
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {pedidos.map((pedido, idx) => (
                <article key={pedido.id} className="card bg-base-100 shadow-sm overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 p-5 border-b border-base-200">
                    <div>
                      <p className="text-sm font-semibold">
                        Pedido #{idx + 1}
                        <span className="ml-2 font-normal opacity-50 text-xs">
                          {pedido.id.slice(0, 8).toUpperCase()}
                        </span>
                      </p>
                      <p className="text-xs opacity-60 mt-0.5">{fechaCorta(pedido.created_at)}</p>
                    </div>
                    <span className={`badge ${ESTADO_PEDIDO_CLASS[pedido.estado] ?? 'badge-neutral'} badge-lg`}>
                      {ESTADO_PEDIDO_LABEL[pedido.estado] ?? pedido.estado}
                    </span>
                  </div>

                  <div className="p-5">
                    <ul className="space-y-3">
                      {pedido.orden_items.map((item, i) => (
                        <li key={`${item.orden_id}-${i}`} className="flex items-center gap-3">
                          <img
                            src={imagenProducto(item.producto?.imagenes[0], 0)}
                            alt={item.producto?.nombre ?? 'Producto'}
                            className="w-12 h-14 rounded-lg object-cover bg-base-300 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {item.producto?.nombre ?? 'Producto eliminado'}
                            </p>
                            <p className="text-xs opacity-60">
                              Talle {item.talle} · Cant. {item.cantidad}
                            </p>
                          </div>
                          <p className="text-sm font-semibold">
                            ${(item.precio_unitario * item.cantidad).toLocaleString('es-AR')}
                          </p>
                        </li>
                      ))}
                    </ul>

                    <div className="divider my-4" />
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <p className="text-xs opacity-60">
                        {pedido.metodo_pago === 'transferencia' ? 'Transferencia bancaria' : 'Mercado Pago'}
                        {pedido.costo_envio > 0
                          ? ` · Envío $${Number(pedido.costo_envio).toLocaleString('es-AR')}`
                          : ' · Envío sin cargo'}
                      </p>
                      <p className="font-bold">
                        Total: <span className="text-primary">${Number(pedido.monto_total).toLocaleString('es-AR')}</span>
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

{tab === 'cuenta' && (
        <section className="card bg-base-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Cuenta</p>
              <p className="text-xs opacity-60">Detalles de tu sesión en Ikigai Clothes</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={async () => { await onCerrarSesion() }}>
              Cerrar sesión
            </button>
          </div>
          <div className="divider my-0" />
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="opacity-60">Email</dt>
              <dd className="font-medium">{email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="opacity-60">Estado</dt>
              <dd className="font-medium">Cuenta activa</dd>
            </div>
          </dl>

          <div className="divider my-0" />
          {cargandoPerfil ? (
            <div className="skeleton h-56 w-full rounded-2xl" />
          ) : (
            <PerfilForm perfil={perfil} actualizarPerfil={actualizarPerfil} />
          )}
        </section>
      )}
    </div>
  )
}

function PerfilForm({
  perfil,
  actualizarPerfil,
}: {
  perfil: Perfil | null
  actualizarPerfil: (datos: DatosPerfil) => Promise<{ error: string | null }>
}) {
  const [form, setForm] = useState<DatosPerfil>(() => ({
    nombre: perfil?.nombre ?? '',
    apellido: perfil?.apellido ?? '',
    dni: perfil?.dni ?? '',
    telefono: perfil?.telefono ?? '',
  }))
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [errores, setErrores] = useState<{ dni?: string; telefono?: string }>({})

  function validarCampo(campo: 'dni' | 'telefono', valor: string): string | undefined {
    if (!valor.trim()) return undefined
    return campo === 'dni'
      ? (esDNIValido(valor) ? undefined : MENSAJE_DNI)
      : (esTelefonoValido(valor) ? undefined : MENSAJE_TELEFONO)
  }

  function handleDniChange(valor: string) {
    const limpio = valor.replace(/\D/g, '')
    setForm({ ...form, dni: limpio })
    setErrores((e) => ({ ...e, dni: validarCampo('dni', limpio) }))
  }

  function handleTelefonoChange(valor: string) {
    const limpio = valor.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')
    setForm({ ...form, telefono: limpio })
    setErrores((e) => ({ ...e, telefono: validarCampo('telefono', limpio) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMensaje(null)

    const errDni = validarCampo('dni', form.dni)
    const errTel = validarCampo('telefono', form.telefono)
    setErrores({ dni: errDni, telefono: errTel })
    if (errDni || errTel) {
      setMensaje({ tipo: 'error', texto: 'Revisá los campos marcados antes de guardar.' })
      return
    }

    setCargando(true)
    const { error } = await actualizarPerfil(form)
    setCargando(false)
    if (error) {
      setMensaje({ tipo: 'error', texto: error })
    } else {
      setMensaje({ tipo: 'ok', texto: 'Tus datos se guardaron correctamente.' })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Datos personales</p>
        <p className="text-xs opacity-60">
          Completá tus datos opcionales para agilizar el proceso de compra. Se precargarán automáticamente en el checkout.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="floating-label">
          <span>Nombre</span>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="Tu nombre"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
        </label>
        <label className="floating-label">
          <span>Apellido</span>
          <input
            type="text"
            className="input input-bordered w-full"
            placeholder="Tu apellido"
            value={form.apellido}
            onChange={(e) => setForm({ ...form, apellido: e.target.value })}
          />
        </label>
        <div>
          <label className="floating-label">
            <span>DNI</span>
            <input
              type="text"
              className={`input input-bordered w-full ${errores.dni ? 'input-error' : ''}`}
              placeholder="DNI sin puntos, entre 7 y 8 dígitos"
              inputMode="numeric"
              value={form.dni}
              onChange={(e) => handleDniChange(e.target.value)}
              onBlur={() => setErrores((e) => ({ ...e, dni: validarCampo('dni', form.dni) }))}
            />
          </label>
          {errores.dni && <p className="text-error text-xs mt-1">{errores.dni}</p>}
        </div>
        <div>
          <label className="floating-label">
            <span>Teléfono</span>
            <input
              type="tel"
              className={`input input-bordered w-full ${errores.telefono ? 'input-error' : ''}`}
              placeholder="Ej. 1155551234"
              inputMode="tel"
              value={form.telefono}
              onChange={(e) => handleTelefonoChange(e.target.value)}
              onBlur={() => setErrores((e) => ({ ...e, telefono: validarCampo('telefono', form.telefono) }))}
            />
          </label>
          {errores.telefono && <p className="text-error text-xs mt-1">{errores.telefono}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="btn btn-primary btn-sm rounded-xl px-6"
          disabled={cargando}
        >
          {cargando ? <span className="loading loading-spinner loading-xs" /> : 'Guardar cambios'}
        </button>
        {mensaje && (
          <span className={`text-sm ${mensaje.tipo === 'ok' ? 'text-success' : 'text-error'}`}>
            {mensaje.texto}
          </span>
        )}
      </div>
    </form>
  )
}