import { useState, useEffect, useRef, type FormEvent, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/cart'
import { useAuth } from '../context/auth'
import { useTienda } from '../context/tienda'
import { usePerfil } from '../hooks/usePerfil'
import { crearOrden, type DatosOrden } from '../lib/ordenes'
import { crearPreferenciaMP } from '../lib/mercadopago'
import { cotizarEnvio, claveOpcion, nombreTransporte, ORIGEN_CP, type OpcionEnvio, type ResultadoCotizacion } from '../lib/enviopack'
import { DATOS_TRANSFERENCIA } from '../lib/pagos'
import { CouponInput } from '../components/CouponInput'
import { formatearPrecio } from '../lib/precios'
import { subirComprobante, actualizarComprobanteOrden } from '../lib/adminApi'
import { comprimirImagen, blobToFile, tamañoEnKB } from '../lib/imageCompression'
import { esDNIValido, esTelefonoValido, MENSAJE_DNI, MENSAJE_TELEFONO } from '../lib/validacion'
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
  const { items, total, vaciar, cupon, descuentoCupon } = useCart()
  const { descuento_transferencia, umbral_envio_gratis, envio_gratis_activo, cuotas_sin_interes } =
    useTienda()
  const { user } = useAuth()
  const [form, setForm] = useState(() =>
    user?.email ? { ...initialState, email: user.email } : initialState,
  )
  const { perfil } = usePerfil(user?.id)

  useEffect(() => {
    // Sincroniza datos guardados del perfil con el formulario al cargar.
    async function sincronizarPerfil() {
      if (!perfil) return
      setForm((prev) => ({
        nombre: prev.nombre || perfil.nombre || '',
        apellido: prev.apellido || perfil.apellido || '',
        dni: prev.dni || perfil.dni || '',
        telefono: prev.telefono || perfil.telefono || '',
        email: prev.email || user?.email || '',
        direccion: prev.direccion,
        codigo_postal: prev.codigo_postal,
      }))
    }
    sincronizarPerfil()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id])
  const [retiro, setRetiro] = useState(false)
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('mercadopago')
  const [enviando, setEnviando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [erroresContacto, setErroresContacto] = useState<{ dni?: string; telefono?: string }>({})
  const [confirmacion, setConfirmacion] = useState<{
    id: string
    metodo: MetodoPago
    items: CartItem[]
    total: number
    montoDescuento: number
  } | null>(null)

  const [opcionesEnvio, setOpcionesEnvio] = useState<OpcionEnvio[]>([])
  const [cotizandoEnvio, setCotizandoEnvio] = useState(false)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [opcionEnvio, setOpcionEnvio] = useState<OpcionEnvio | null>(null)
  const [cotizacion, setCotizacion] = useState<ResultadoCotizacion | null>(null)
  const secuenciaCotizacionRef = useRef(0)
  const costoEnvio = opcionEnvio?.costo ?? 0

  // Cotización de envío automática al ingresar el código postal (con debounce).
  useEffect(() => {
    const cp = form.codigo_postal.trim().replace(/\D/g, '')
    if (retiro || cp.length < 4) return

    let cancelled = false
    const secuencia = ++secuenciaCotizacionRef.current
    const timer = window.setTimeout(async () => {
      setCotizandoEnvio(true)
      const res = await cotizarEnvio(cp, items)
      if (cancelled || secuencia !== secuenciaCotizacionRef.current) { setCotizandoEnvio(false); return }
      setCotizandoEnvio(false)
      if (res.error) {
        setOpcionesEnvio([])
        setOpcionEnvio(null)
        setCotizacion(null)
        setErrorEnvio(res.error)
        return
      }
      setCotizacion(res)
      setOpcionesEnvio(res.opciones)
      if (res.opciones.length === 0) {
        setOpcionEnvio(null)
        setErrorEnvio('No se encontraron opciones de envío para el código postal ingresado.')
      } else {
        // Si la opción seleccionada ya no está disponible (carrito o CP cambiaron), se limpia.
        setOpcionEnvio((actual) => {
          if (!actual) return actual
          const sigue = res.opciones.some(
            (o) => o.carrier.id === actual.carrier.id && o.service_type.code === actual.service_type.code,
          )
          return sigue ? actual : null
        })
      }
    }, 600)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [form.codigo_postal, retiro, items])

  const esTransferencia = metodoPago === 'transferencia'
  const descuentoTransferencia = esTransferencia ? total * descuento_transferencia : 0
  const subtotalConDescuento = Math.max(0, total - descuentoTransferencia - descuentoCupon)

  // Envío gratis por monto: se evalúa sobre el subtotal ya descontado.
  const correspondeEnvioGratis =
    envio_gratis_activo && umbral_envio_gratis > 0 && subtotalConDescuento >= umbral_envio_gratis
  const costoEnvioCobrado = retiro || correspondeEnvioGratis ? 0 : costoEnvio
  const totalFinal = subtotalConDescuento + costoEnvioCobrado

  const dniValido = esDNIValido(form.dni)
  const telefonoValido = esTelefonoValido(form.telefono)
  const datosContactoValidos = dniValido && telefonoValido

  function validarCampo(campo: 'dni' | 'telefono', valor: string) {
    if (!valor.trim()) {
      return 'Campo obligatorio.'
    }
    return campo === 'dni'
      ? esDNIValido(valor) ? undefined : MENSAJE_DNI
      : esTelefonoValido(valor) ? undefined : MENSAJE_TELEFONO
  }

  function handleDniChange(valor: string) {
    const limpio = valor.replace(/\D/g, '')
    setForm({ ...form, dni: limpio })
    setErroresContacto((e) => ({ ...e, dni: validarCampo('dni', limpio) }))
  }

  function handleTelefonoChange(valor: string) {
    const limpio = valor.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')
    setForm({ ...form, telefono: limpio })
    setErroresContacto((e) => ({ ...e, telefono: validarCampo('telefono', limpio) }))
  }

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
      <ConfirmacionTransferencia
        confirmacion={confirmacion}
        onVolver={() => (
          <Link to="/catalogo" className="btn btn-primary btn-block mt-8">Volver al Catálogo</Link>
        )}
      />
    )
  }

  async function handleCotizarEnvio() {
    const limpio = form.codigo_postal.trim().replace(/\D/g, '')
    if (limpio.length < 4) {
      setErrorEnvio('El código postal debe tener al menos 4 dígitos.')
      return
    }
    setErrorEnvio(null)
    setOpcionEnvio(null)
    setCotizandoEnvio(true)
    const res = await cotizarEnvio(limpio, items)
    setCotizandoEnvio(false)
    if (res.error) {
      setErrorEnvio(res.error)
      setOpcionesEnvio([])
      setCotizacion(null)
      return
    }
    setCotizacion(res)
    setOpcionesEnvio(res.opciones)
    if (res.opciones.length === 0) {
      setErrorEnvio('No se encontraron opciones de envío para el código postal ingresado.')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorMsg(null)

    if (!dniValido || !telefonoValido) {
      setErroresContacto((prev) => ({
        dni: prev.dni ?? (!dniValido ? (form.dni ? MENSAJE_DNI : 'Campo obligatorio.') : undefined),
        telefono: prev.telefono ?? (!telefonoValido ? (form.telefono ? MENSAJE_TELEFONO : 'Campo obligatorio.') : undefined),
      }))
      setErrorMsg('Revisá el DNI y el teléfono: deben cumplir el formato válido.')
      return
    }

    if (!retiro && (!form.direccion || !form.codigo_postal)) {
      setErrorMsg('Completá la dirección y el código postal.')
      return
    }

    if (!retiro && !opcionEnvio) {
      setErrorMsg('Seleccioná un método de envío para continuar.')
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
      metodo_pago: metodoPago,
      costo_envio: costoEnvioCobrado,
      cupon_codigo: cupon?.codigo ?? null,
      descuento_cupon: descuentoCupon,
      descuento: descuentoTransferencia + descuentoCupon,
      envio: retiro
        ? { metodo: 'retiro' }
        : {
            metodo: 'envio',
            carrier: opcionEnvio ? nombreTransporte(opcionEnvio) : undefined,
            carrier_id: opcionEnvio?.carrier.id ?? null,
            servicio: opcionEnvio?.service_type.name,
            service_type: opcionEnvio?.service_type.code,
            logistic_type: opcionEnvio?.logistic_type,
            costo: costoEnvioCobrado,
            codigo_postal: form.codigo_postal,
            origen_cp: (cotizacion?.origen_cp ?? ORIGEN_CP) || null,
            tiempo: opcionEnvio?.estimado.leyenda || null,
            mock: cotizacion?.mock === true,
            seleccion: opcionEnvio,
            cotizacion,
          },
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

    if (metodoPago === 'transferencia') {
      setEnviando(false)
      setConfirmacion({
        id: res.ordenId,
        metodo: metodoPago,
        items,
        total: totalFinal,
        montoDescuento: descuentoTransferencia + descuentoCupon,
      })
      vaciar()
      window.scrollTo(0, 0)
      return
    }

    const pref = await crearPreferenciaMP(
      res.ordenId,
      items,
      {
        nombre: `${form.nombre} ${form.apellido}`.trim(),
        email: form.email,
        telefono: form.telefono,
        dni: form.dni,
      },
      costoEnvioCobrado,
      opcionEnvio && costoEnvioCobrado > 0 ? nombreTransporte(opcionEnvio) : undefined,
      cupon?.codigo,
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
              <div>
                <label className="floating-label">
                  <span>Teléfono</span>
                  <input
                    type="tel"
                    className={`input input-bordered w-full ${erroresContacto.telefono ? 'input-error' : ''}`}
                    required
                    inputMode="tel"
                    placeholder="Ej. 1155551234"
                    value={form.telefono}
                    onChange={(e) => handleTelefonoChange(e.target.value)}
                    onBlur={() => setErroresContacto((prev) => ({ ...prev, telefono: validarCampo('telefono', form.telefono) }))}
                    aria-invalid={!!erroresContacto.telefono}
                  />
                </label>
                {erroresContacto.telefono && (
                  <p className="text-error text-xs mt-1">{erroresContacto.telefono}</p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="floating-label">
                  <span>DNI</span>
                  <input
                    type="text"
                    className={`input input-bordered w-full ${erroresContacto.dni ? 'input-error' : ''}`}
                    required
                    inputMode="numeric"
                    placeholder="DNI sin puntos, entre 7 y 8 dígitos"
                    value={form.dni}
                    onChange={(e) => handleDniChange(e.target.value)}
                    onBlur={() => setErroresContacto((prev) => ({ ...prev, dni: validarCampo('dni', form.dni) }))}
                    aria-invalid={!!erroresContacto.dni}
                  />
                </label>
                {erroresContacto.dni && (
                  <p className="text-error text-xs mt-1">{erroresContacto.dni}</p>
                )}
              </div>
            </div>
          </fieldset>

          <fieldset className="bg-base-200 rounded-2xl p-5">
            <legend className="font-semibold text-sm px-2 mb-1">Envío</legend>

            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={retiro}
                onChange={e => {
                  setRetiro(e.target.checked)
                  if (e.target.checked) {
                    setOpcionEnvio(null)
                    setOpcionesEnvio([])
                    setErrorEnvio(null)
                    setCotizacion(null)
                  }
                }}
              />
              <span className="text-sm font-medium">Retiro en showroom (sin cargo)</span>
            </label>

            {!retiro && (
              <div className="space-y-4">
                <label className="floating-label">
                  <span>Dirección</span>
                  <input type="text" className="input input-bordered w-full" required value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} />
                </label>
                <div>
                  <span className="text-sm font-medium">Código Postal</span>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      className="input input-bordered flex-1 rounded-xl"
                      required
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="Ej: 4400"
                      value={form.codigo_postal}
                      onChange={e => {
                        setForm({ ...form, codigo_postal: e.target.value.replace(/\D/g, '') })
                        setOpcionEnvio(null)
                        setOpcionesEnvio([])
                        setErrorEnvio(null)
                        setCotizacion(null)
                      }}
                    />
                    <button
                      type="button"
                      disabled={cotizandoEnvio || form.codigo_postal.trim().length < 4}
                      onClick={handleCotizarEnvio}
                      className="btn btn-primary rounded-xl whitespace-nowrap"
                    >
                      {cotizandoEnvio ? (
                        <span className="loading loading-spinner loading-xs" />
                      ) : (
                        'Calcular envío'
                      )}
                    </button>
                  </div>

                  {errorEnvio && <p className="text-error text-xs mt-2">{errorEnvio}</p>}

                  {!cotizandoEnvio && opcionesEnvio.length === 0 && form.codigo_postal.trim().length >= 4 && !errorEnvio && (
                    <p className="text-xs opacity-60 mt-2">
                      Calculá el envío para ver las opciones disponibles.
                    </p>
                  )}

                  {opcionesEnvio.length > 0 && (
                    <ul className="mt-3 space-y-2 max-h-52 overflow-y-auto">
                      {opcionesEnvio.map((opt, idx) => {
                        const isSelected = claveOpcion(opcionEnvio) === claveOpcion(opt)
                        return (
                          <li key={`${opt.carrier.id ?? idx}-${opt.service_type.code}`}>
                            <button
                              type="button"
                              onClick={() => setOpcionEnvio(opt)}
                              disabled={!opt.selectable}
                              className={`w-full text-left rounded-xl p-3 border-2 transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary/5'
                                  : 'border-base-300 hover:border-primary/50'
                              } ${!opt.selectable ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-sm">{nombreTransporte(opt)}</span>
                                <span className="font-bold text-sm text-primary">
                                  ${opt.costo.toLocaleString('es-AR')}
                                </span>
                              </div>
                              <span className="text-xs opacity-60">
                                {opt.estimado.leyenda || 'Entrega a confirmar'}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {retiro && (
              <p className="text-sm opacity-60 bg-base-100 rounded-xl p-3">
                Retirá tu pedido en nuestro showroom sin costo adicional. Te contactaremos para coordinar el horario.
              </p>
            )}
          </fieldset>

          {/* Método de pago - Tarjetas claras minimalistas */}
          <div className="bg-base-200 rounded-2xl p-5">
            <div className="space-y-4 my-6">
              <h3 className="text-lg font-bold text-zinc-900 tracking-tight">Método de pago</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mercado Pago */}
                <button
                  type="button"
                  onClick={() => setMetodoPago('mercadopago')}
                  className={`relative flex flex-col justify-between p-5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                    metodoPago === 'mercadopago'
                      ? 'bg-white border-zinc-900 ring-2 ring-zinc-900 shadow-sm'
                      : 'bg-white border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-4">
                    <span className="text-xs font-bold tracking-wider uppercase px-2.5 py-1 bg-sky-50 text-sky-600 rounded-md border border-sky-100">
                      Mercado Pago
                    </span>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      metodoPago === 'mercadopago' ? 'border-zinc-900 bg-zinc-900' : 'border-zinc-300'
                    }`}>
                      {metodoPago === 'mercadopago' && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                  <div>
                    <p className="text-base font-bold text-zinc-900">Mercado Pago</p>
                    <p className="text-xs font-medium text-zinc-500 mt-0.5">6 cuotas sin interés</p>
                  </div>
                </button>

                {/* Transferencia Bancaria */}
                <button
                  type="button"
                  onClick={() => setMetodoPago('transferencia')}
                  className={`relative flex flex-col justify-between p-5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                    metodoPago === 'transferencia'
                      ? 'bg-white border-emerald-600 ring-2 ring-emerald-600 shadow-sm'
                      : 'bg-white border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-4">
                    <span className="text-xs font-bold tracking-wider uppercase px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
                      20% DE DESCUENTO
                    </span>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      metodoPago === 'transferencia' ? 'border-emerald-600 bg-emerald-600' : 'border-zinc-300'
                    }`}>
                      {metodoPago === 'transferencia' && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                  <div>
                    <p className="text-base font-bold text-zinc-900">Transferencia Bancaria</p>
                    <p className="text-xs font-medium text-zinc-500 mt-0.5">Paga con CBU o Alias</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

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
            <div className="mb-4">
              <CouponInput />
            </div>
            <div className="border-t border-line pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="opacity-60">Subtotal</span>
                <span className="font-medium">${formatearPrecio(total)}</span>
              </div>

              {descuentoTransferencia > 0 && (
                <div className="flex justify-between text-sm text-success font-medium">
                  <span>
                    Descuento Transferencia -{Math.round(descuento_transferencia * 100)}%
                  </span>
                  <span>-${formatearPrecio(descuentoTransferencia)}</span>
                </div>
              )}

              {descuentoCupon > 0 && (
                <div className="flex justify-between text-sm text-success font-medium">
                  <span>Cupón {cupon?.codigo}</span>
                  <span>-${formatearPrecio(descuentoCupon)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="opacity-60">Envío</span>
                <span className="font-medium">
                  {retiro
                    ? 'Sin cargo'
                    : correspondeEnvioGratis
                      ? 'Gratis'
                      : opcionEnvio
                        ? `${nombreTransporte(opcionEnvio)} · $${formatearPrecio(costoEnvio)}`
                        : 'Calculá tu envío'}
                </span>
              </div>

              <div className="h-px bg-line my-1"></div>

              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-lg">${formatearPrecio(totalFinal)}</span>
              </div>

              {cuotas_sin_interes > 1 && (
                <p className="text-xs opacity-60 text-right">
                  o {cuotas_sin_interes} cuotas sin interés de $
                  {formatearPrecio(totalFinal / cuotas_sin_interes)}
                </p>
              )}

              {descuentoTransferencia > 0 && (
                <p className="text-xs text-success font-medium text-right">
                  Ahorrás ${formatearPrecio(descuentoTransferencia + descuentoCupon)} pagando por
                  transferencia
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={enviando || !datosContactoValidos}
              className={`btn btn-block mt-5 ${esTransferencia ? 'btn-success' : 'btn-primary'}`}
            >
              {enviando ? (
                <span className="loading loading-spinner loading-sm" />
              ) : metodoPago === 'mercadopago' ? (
                'Pagar con Mercado Pago'
              ) : (
                'Confirmar pedido'
              )}
            </button>
            {!datosContactoValidos && (
              <p className="text-xs opacity-60 text-center mt-2">
                Completá un DNI (7-8 dígitos) y un teléfono válido para poder confirmar el pedido.
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}

/* ──── Pantalla de confirmación para transferencia ──── */

function ConfirmacionTransferencia({
  confirmacion,
  onVolver,
}: {
  confirmacion: { id: string; metodo: MetodoPago; items: CartItem[]; total: number; montoDescuento: number }
  onVolver: () => React.ReactNode
}) {
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null)
  const [comprobantePreview, setComprobantePreview] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [infoCompresion, setInfoCompresion] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  async function handleFile(file: File) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      setUploadError('Formato no válido. Subí JPG, PNG o PDF.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('El archivo no puede superar 10 MB.')
      return
    }

    let archivoFinal: File = file

    if (file.type.startsWith('image/')) {
      try {
        const blob = await comprimirImagen(file)
        archivoFinal = blobToFile(blob, file.name)
        setComprobantePreview(URL.createObjectURL(blob))
        setInfoCompresion(`Comprimida a ${tamañoEnKB(blob.size)}`)
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'No se pudo comprimir la imagen.')
        return
      }
    } else {
      setComprobantePreview(null)
    }

    setComprobanteFile(archivoFinal)
    setUploadError(null)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    dropRef.current?.classList.remove('border-primary', 'bg-primary/5')
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    dropRef.current?.classList.add('border-primary', 'bg-primary/5')
  }

  function handleDragLeave() {
    dropRef.current?.classList.remove('border-primary', 'bg-primary/5')
  }

  async function handleSubirComprobante() {
    if (!comprobanteFile) return
    setSubiendo(true)
    setUploadError(null)

    const { url, error } = await subirComprobante(comprobanteFile, confirmacion.id)
    if (error || !url) {
      setSubiendo(false)
      setUploadError(error ?? 'No se pudo subir el comprobante.')
      return
    }

    const { error: updateError } = await actualizarComprobanteOrden(confirmacion.id, url)
    setSubiendo(false)

    if (updateError) {
      setUploadError('Se subió el archivo pero no se pudo vincular al pedido. Contactanos.')
      return
    }

    setEnviado(true)
  }

  if (enviado) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-success/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="h-10 w-10 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold">¡Gracias por tu compra!</h2>
        <p className="opacity-70 mt-3 text-sm leading-relaxed">
          Tu pago está siendo verificado. Te notificaremos cuando se acredite.
        </p>
        <p className="font-mono text-sm bg-base-200 rounded-lg px-3 py-2 inline-block mt-4">
          Pedido: <span className="font-bold">{confirmacion.id.slice(0, 8).toUpperCase()}</span>
        </p>
        {onVolver()}
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <div className="bg-success/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="h-10 w-10 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold">¡Pedido registrado!</h2>
        <p className="opacity-60 mt-2">Completá la transferencia y subí tu comprobante.</p>
        <p className="font-mono text-sm bg-base-200 rounded-lg px-3 py-2 inline-block mt-3">
          Pedido: <span className="font-bold">{confirmacion.id.slice(0, 8).toUpperCase()}</span>
        </p>
      </div>

      {/* Resumen */}
      <div className="bg-base-200 rounded-2xl p-5 mb-6">
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
        <div className="border-t mt-3 pt-3 space-y-1">
          {confirmacion.montoDescuento > 0 && (
            <div className="flex justify-between text-sm text-success font-medium">
              <span>Descuento Transferencia -20%</span>
              <span>-${confirmacion.montoDescuento.toLocaleString('es-AR')}</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>Total a pagar</span>
            <span className="text-success">${confirmacion.total.toLocaleString('es-AR')}</span>
          </div>
        </div>
      </div>

      {/* Datos bancarios */}
      <div className="bg-base-200 rounded-2xl p-5 mb-6">
        <p className="font-semibold text-sm mb-3">Datos para transferencia</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="opacity-50">Banco / App</dt>
          <dd className="font-medium">{DATOS_TRANSFERENCIA.banco}</dd>
          <dt className="opacity-50">Titular</dt>
          <dd className="font-medium">{DATOS_TRANSFERENCIA.titular}</dd>
          <dt className="opacity-50">CUIL</dt>
          <dd className="font-mono font-medium">{DATOS_TRANSFERENCIA.cuil}</dd>
          <dt className="opacity-50">CBU</dt>
          <dd className="font-mono font-medium">{DATOS_TRANSFERENCIA.cbu}</dd>
          <dt className="opacity-50">Alias</dt>
          <dd className="font-medium">{DATOS_TRANSFERENCIA.alias}</dd>
          <dt className="opacity-50">Caja de Ahorro</dt>
          <dd className="font-mono font-medium">{DATOS_TRANSFERENCIA.cajaAhorro}</dd>
        </dl>
      </div>

      {/* Upload comprobante */}
      <div className="bg-base-200 rounded-2xl p-5">
        <p className="font-semibold text-sm mb-3">Subir comprobante de pago</p>

        <div
          ref={dropRef}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-base-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />

          {comprobantePreview ? (
            <img src={comprobantePreview} alt="Comprobante" className="max-h-40 mx-auto rounded-lg" />
          ) : comprobanteFile ? (
            <div className="flex items-center justify-center gap-2 text-sm">
              <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <span className="font-medium">{comprobanteFile.name}</span>
              <button
                type="button"
                className="btn btn-xs btn-ghost text-error"
                onClick={(e) => {
                  e.stopPropagation()
                  setComprobanteFile(null)
                  setComprobantePreview(null)
                  setInfoCompresion(null)
                }}
              >
                Quitar
              </button>
            </div>
          ) : (
            <>
              <svg className="h-10 w-10 mx-auto opacity-40 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm opacity-60">Arrastrá tu comprobante acá o hacé click para seleccionar</p>
              <p className="text-xs opacity-40 mt-1">JPG, PNG o PDF — Máximo 10 MB</p>
            </>
          )}
        </div>

        {uploadError && <p className="text-error text-xs mt-2">{uploadError}</p>}
        {infoCompresion && <p className="text-success text-xs mt-2">{infoCompresion}</p>}

        <button
          type="button"
          disabled={!comprobanteFile || subiendo}
          onClick={handleSubirComprobante}
          className="btn btn-success btn-block mt-4"
        >
          {subiendo ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            'Enviar comprobante'
          )}
        </button>
      </div>

      <div className="mt-8">{onVolver()}</div>
    </div>
  )
}
