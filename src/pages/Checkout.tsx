import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/cart'
import { crearOrden, type DatosOrden } from '../lib/ordenes'
import { crearPreferenciaMP } from '../lib/mercadopago'
import { DATOS_TRANSFERENCIA, whatsappComprobante } from '../lib/pagos'
import { imagenProducto } from '../lib/imagenes'
import type { CartItem } from '../types/cart'

type MetodoPago = DatosOrden['metodo_pago']

const initialState = {
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
  dni: '',
  direccion: '',
  codigo_postal: '',
}

export function Checkout() {
  const { items, total, vaciar } = useCart()
  const [form, setForm] = useState(initialState)
  const [retiro, setRetiro] = useState(false)
  const [metodo, setMetodo] = useState<MetodoPago>('mercadopago')
  const [enviando, setEnviando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [confirmacion, setConfirmacion] = useState<{
    id: string
    metodo: MetodoPago
    items: CartItem[]
    total: number
  } | null>(null)

  if (items.length === 0 && !confirmacion) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">Tu carrito está vacío</h2>
        <p className="opacity-60 mb-8">Agregá productos para continuar con la compra.</p>
        <Link to="/catalogo" className="btn btn-primary">Ir al Catálogo</Link>
      </div>
    )
  }

  if (confirmacion) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-success/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="h-10 w-10 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold">¡Gracias por tu compra!</h2>
        <p className="opacity-60 mt-2">Tu pedido fue registrado con éxito.</p>
        <p className="font-mono text-sm bg-base-200 rounded-lg px-3 py-2 inline-block mt-3">
          Pedido: <span className="font-bold">{confirmacion.id.slice(0, 8).toUpperCase()}</span>
        </p>

        <div className="mt-8 text-left bg-base-200 rounded-2xl p-5">
          <p className="font-semibold text-sm mb-3">Resumen</p>
          {confirmacion.items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 mb-2">
              <img src={imagenProducto(item.imagen, i)} alt="" className="w-10 h-10 rounded-lg object-cover" />
              <div className="flex-1 text-sm">
                <span className="font-medium">{item.nombre}</span>
                <span className="opacity-50 ml-2">Talle {item.talle} × {item.cantidad}</span>
              </div>
              <span className="text-sm font-bold">${(item.precio_unitario * item.cantidad).toLocaleString('es-AR')}</span>
            </div>
          ))}
          <div className="border-t mt-3 pt-3 flex justify-between font-bold">
            <span>Total</span>
            <span className="text-primary">${confirmacion.total.toLocaleString('es-AR')}</span>
          </div>
        </div>

        {confirmacion.metodo === 'transferencia' && (
          <div className="mt-6 text-left bg-base-200 rounded-2xl p-5">
            <p className="font-semibold text-sm mb-3">Datos para transferencia</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="opacity-50">Titular</dt>
              <dd className="font-medium">{DATOS_TRANSFERENCIA.titular}</dd>
              <dt className="opacity-50">CUIT</dt>
              <dd className="font-medium">{DATOS_TRANSFERENCIA.cuit}</dd>
              <dt className="opacity-50">Banco</dt>
              <dd className="font-medium">{DATOS_TRANSFERENCIA.banco}</dd>
              <dt className="opacity-50">CBU</dt>
              <dd className="font-mono font-medium">{DATOS_TRANSFERENCIA.cbu}</dd>
              <dt className="opacity-50">Alias</dt>
              <dd className="font-medium">{DATOS_TRANSFERENCIA.alias}</dd>
            </dl>
            <a
              href={whatsappComprobante(confirmacion.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-success btn-block mt-5 gap-2"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Enviar comprobante por WhatsApp
            </a>
          </div>
        )}

        {confirmacion.metodo === 'mercadopago' && (
          <div className="mt-6 bg-base-200 rounded-2xl p-5 text-left">
            <p className="font-semibold text-sm mb-2">Pago con Mercado Pago</p>
            <p className="text-sm opacity-60">
              Se te redirigió a la pasarela de pago. Tu pedido quedó registrado como{' '}
              <strong>pendiente de pago</strong> hasta que se confirme el pago.
            </p>
          </div>
        )}

        <Link to="/catalogo" className="btn btn-primary btn-block mt-8">Volver al Catálogo</Link>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorMsg(null)

    if (!retiro && (!form.direccion || !form.codigo_postal)) {
      setErrorMsg('Completá la dirección y el código postal.')
      return
    }

    setEnviando(true)

    const res = await crearOrden({
      cliente_nombre: `${form.nombre} ${form.apellido}`.trim(),
      cliente_email: form.email,
      cliente_telefono: form.telefono,
      cliente_dni: form.dni,
      direccion: retiro ? 'Retiro en showroom' : form.direccion,
      codigo_postal: retiro ? '' : form.codigo_postal,
      metodo_pago: metodo,
      costo_envio: 0,
      items: items.map(i => ({
        producto_id: i.producto_id,
        talle: i.talle,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
      })),
    })

    if (res.error) {
      setEnviando(false)
      setErrorMsg(res.error)
      return
    }

    if (metodo === 'transferencia') {
      setEnviando(false)
      setConfirmacion({ id: res.ordenId, metodo, items, total })
      vaciar()
      window.scrollTo(0, 0)
      return
    }

    // Mercado Pago: crear preferencia y redirigir al checkout de MP
    const pref = await crearPreferenciaMP(
      res.ordenId,
      items,
      {
        nombre: `${form.nombre} ${form.apellido}`.trim(),
        email: form.email,
        telefono: form.telefono,
        dni: form.dni,
      },
    )

    setEnviando(false)

    if (pref.error || !pref.init_point) {
      setErrorMsg(pref.error ?? 'No se pudo iniciar el pago.')
      return
    }

    window.location.href = pref.init_point
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-8">Finalizar compra</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulario */}
        <div className="lg:col-span-2 space-y-6">
          <fieldset className="bg-base-200 rounded-2xl p-5">
            <legend className="font-semibold text-sm px-2 mb-1">Datos de contacto</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="floating-label">
                <span>Nombre</span>
                <input type="text" className="input input-bordered w-full" required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
              </label>
              <label className="floating-label">
                <span>Apellido</span>
                <input type="text" className="input input-bordered w-full" required value={form.apellido} onChange={e => setForm({ ...form, apellido: e.target.value })} />
              </label>
              <label className="floating-label">
                <span>Email</span>
                <input type="email" className="input input-bordered w-full" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </label>
              <label className="floating-label">
                <span>Teléfono</span>
                <input type="tel" className="input input-bordered w-full" required value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
              </label>
              <label className="floating-label sm:col-span-2">
                <span>DNI</span>
                <input type="text" className="input input-bordered w-full" required value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} />
              </label>
            </div>
          </fieldset>

          <fieldset className="bg-base-200 rounded-2xl p-5">
            <legend className="font-semibold text-sm px-2 mb-1">Envío</legend>

            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={retiro}
                onChange={e => setRetiro(e.target.checked)}
              />
              <span className="text-sm font-medium">Retiro en showroom (sin cargo)</span>
            </label>

            {!retiro && (
              <div className="space-y-4">
                <label className="floating-label">
                  <span>Dirección</span>
                  <input type="text" className="input input-bordered w-full" required value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
                </label>
                <label className="floating-label">
                  <span>Código Postal</span>
                  <input type="text" className="input input-bordered w-full" required value={form.codigo_postal} onChange={e => setForm({ ...form, codigo_postal: e.target.value })} />
                </label>
                <p className="text-xs opacity-50">El costo de envío se confirmará al procesar el pedido.</p>
              </div>
            )}

            {retiro && (
              <p className="text-sm opacity-60 bg-base-100 rounded-xl p-3">
                Retirá tu pedido en nuestro showroom sin costo adicional. Te contactaremos para coordinar el horario.
              </p>
            )}
          </fieldset>

          <fieldset className="bg-base-200 rounded-2xl p-5">
            <legend className="font-semibold text-sm px-2 mb-1">Método de pago</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMetodo('mercadopago')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  metodo === 'mercadopago'
                    ? 'border-primary bg-base-100 shadow-sm'
                    : 'border-base-300 hover:border-base-content/20'
                }`}
              >
                <p className="font-semibold text-sm">Mercado Pago</p>
                <p className="text-xs opacity-50 mt-1">Tarjeta, débito o cuenta</p>
              </button>

              <button
                type="button"
                onClick={() => setMetodo('transferencia')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  metodo === 'transferencia'
                    ? 'border-primary bg-base-100 shadow-sm'
                    : 'border-base-300 hover:border-base-content/20'
                }`}
              >
                <p className="font-semibold text-sm">Transferencia bancaria</p>
                <p className="text-xs opacity-50 mt-1">Datos al confirmar el pedido</p>
              </button>
            </div>
          </fieldset>

          {errorMsg && <div className="alert alert-error text-sm">{errorMsg}</div>}
        </div>

        {/* Resumen */}
        <div className="lg:col-span-1">
          <div className="bg-base-200 rounded-2xl p-5 sticky top-24">
            <p className="font-semibold text-sm mb-4">Tu pedido</p>
            <ul className="space-y-3 mb-4">
              {items.map((item, i) => (
                <li key={`${item.producto_id}-${item.talle}`} className="flex items-center gap-3">
                  <img src={imagenProducto(item.imagen, i)} alt="" className="w-10 h-10 rounded-lg object-cover" />
                  <div className="flex-1 text-sm min-w-0">
                    <p className="font-medium truncate">{item.nombre}</p>
                    <p className="opacity-50 text-xs">Talle {item.talle} × {item.cantidad}</p>
                  </div>
                  <span className="text-sm font-bold whitespace-nowrap">
                    ${(item.precio_unitario * item.cantidad).toLocaleString('es-AR')}
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-t pt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="opacity-60">Envío</span>
                <span className="font-medium">{retiro ? 'Sin cargo' : 'A confirmar'}</span>
              </div>
              <div className="flex justify-between font-bold pt-1">
                <span>Total</span>
                <span className="text-primary text-lg">${total.toLocaleString('es-AR')}</span>
              </div>
            </div>
            <button
              type="submit"
              disabled={enviando}
              className="btn btn-primary btn-block mt-5"
            >
              {enviando ? (
                <span className="loading loading-spinner loading-sm" />
              ) : metodo === 'mercadopago' ? (
                'Pagar con Mercado Pago'
              ) : (
                'Confirmar pedido'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
