import { useState, useEffect, useRef, type FormEvent, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/cart'
import { useAuth } from '../context/auth'
import { useTienda } from '../context/tienda'
import { usePerfil } from '../hooks/usePerfil'
import { crearOrden } from '../lib/ordenes'
import { crearPreferenciaMP } from '../lib/mercadopago'
import {
  cotizarEnvioLocal,
  claveOpcion,
  nombreTransporte,
  ORIGEN_CP,
  type OpcionEnvio,
  type ResultadoCotizacion,
} from '../lib/tarifasEnvio'
import { PASOS_PAGO, TEXTO_METODO, type MetodoPago } from '../lib/pagos'
import { guardarResumen, type ResumenPedido } from '../lib/resumenPedido'
import { CouponInput } from '../components/CouponInput'
import { DatosBancarios } from '../components/DatosBancarios'
import { formatearPrecio } from '../lib/precios'
import { subirComprobante, actualizarComprobanteOrden } from '../lib/adminApi'
import { comprimirImagen, blobToFile, tamañoEnKB } from '../lib/imageCompression'
import { CONTACTO } from '../lib/contacto'
import {
  validarFormulario,
  type Campo,
  type ErroresFormulario,
} from '../lib/validacion'
import { imagenProducto, srcsetImagen } from '../lib/imagenes'

const initialState = {
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
  dni: '',
  direccion: '',
  codigo_postal: '',
}

/** Campos que se limpian de dígitos mientras se tipea. */
const SOLO_DIGITOS: Partial<Record<Campo, boolean>> = {
  dni: true,
}

// El código postal NO va acá: `validacion.ts` acepta CPA (`N3360ABC`) además del
// CP de 4 dígitos, y filtrar los dígitos al tipear hacía imposible escribirlo.

/**
 * Solo los 4 dígitos del CP, que es lo que necesita el tarifario local.
 * `N3360ABC` -> `3360`. Si el CPA viniera incompleto, devuelve menos de 4
 * dígitos y la cotización no se dispara.
 */
function digitosCp(valor: string): string {
  return valor.replace(/\D/g, '')
}

/**
 * El retiro en showroom se modela como una OpcionEnvio más, con costo 0.
 *
 * Antes `retiro` era un flag aparte y el checkout validaba
 * `!retiro && !opcionEnvio`. Con dos fuentes de verdad para "cómo se lo lleva"
 * era fácil quedar en un estado inconsistente (flag en true, sin opción
 * cargada) y bloquear el pago con "Seleccioná un método de envío" aunque el
 * showroom estuviera marcado. Con una sola fuente desaparece esa clase de bug.
 */
const OPCION_SHOWROOM: OpcionEnvio = {
  id_servicio: 'showroom',
  correo_id: null,
  carrier: { id: null, name: 'Retiro en showroom', rating: null, logo: null },
  service_type: { code: 'RETIRO_SHOWROOM', name: 'Retiro en showroom (sin cargo)' },
  costo: 0,
  tiempo_estimado: 'A coordinar',
  modalidad: 'retiro',
  despacho: null,
  horas_entrega: null,
  cumplimiento: null,
  anomalos: null,
  logistic_type: null,
  estimado: {
    minimo_dias: null,
    maximo_dias: null,
    estimado: null,
    leyenda: 'A coordinar por WhatsApp',
  },
  tags: ['cheapest', 'fastest'],
  selectable: true,
}

/** Lo que la pantalla de confirmación necesita del pedido ya creado. */
type PedidoConfirmado = ResumenPedido

export function Checkout() {
  const { items, total, vaciar, cupon, descuentoCupon, descuentoOutfit } = useCart()
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

  const [metodoPago, setMetodoPago] = useState<MetodoPago>('mercadopago')
  const [enviando, setEnviando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // `tocados` marca los campos que el usuario ya interactuó. El error de un campo
  // aparece solo después del primer blur o de haber tipeado: si no, el DNI
  // muestra "faltan dígitos" mientras se escribe.
  const [tocados, setTocados] = useState<Partial<Record<Campo, boolean>>>({})
  const [enviado, setEnviado] = useState(false)
  const [confirmacion, setConfirmacion] = useState<PedidoConfirmado | null>(null)

  const [opcionesEnvio, setOpcionesEnvio] = useState<OpcionEnvio[]>([])
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  // `opcionEnvio` es la única fuente de verdad del método de envío. null =
  // todavía no eligió nada. Si vale OPCION_SHOWROOM, es retiro en showroom.
  const [opcionEnvio, setOpcionEnvio] = useState<OpcionEnvio | null>(null)
  const [cotizacion, setCotizacion] = useState<ResultadoCotizacion | null>(null)
  const secuenciaCotizacionRef = useRef(0)

  const retiro = opcionEnvio?.id_servicio === OPCION_SHOWROOM.id_servicio
  const costoEnvio = opcionEnvio?.costo ?? 0

  // Cotización de envío automática al ingresar el código postal (con debounce).
  // Es local (tarifario fijo), sin red: el debounce queda solo para no recalcular
  // en cada tecla mientras se tipea el CP.
  useEffect(() => {
    const cp = digitosCp(form.codigo_postal)
    if (retiro || cp.length < 4) return

    let cancelled = false
    const secuencia = ++secuenciaCotizacionRef.current
    const timer = window.setTimeout(() => {
      const res = cotizarEnvioLocal(cp, items)
      if (cancelled || secuencia !== secuenciaCotizacionRef.current) return

      if (res.error) {
        setOpcionesEnvio([])
        setOpcionEnvio(null)
        setCotizacion(null)
        setErrorEnvio(res.error)
        return
      }
      setCotizacion(res)
      setOpcionesEnvio(res.opciones)
      setErrorEnvio(res.opciones.length === 0
        ? 'No se encontraron opciones de envío para el código postal ingresado.'
        : null)
      if (res.opciones.length === 0) {
        setOpcionEnvio(null)
      } else {
        // Si la opción seleccionada ya no está disponible (carrito o CP cambiaron), se limpia.
        setOpcionEnvio((actual: OpcionEnvio | null) => {
          // El retiro en showroom no viene del tarifario: si sigue elegido, se
          // mantiene aunque las opciones del CP no lo incluyan.
          if (!actual || actual.id_servicio === OPCION_SHOWROOM.id_servicio) return actual
          const sigue = res.opciones.some((o) => o.id_servicio === actual.id_servicio)
          return sigue ? actual : null
        })
      }
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [form.codigo_postal, retiro, items])

  const esTransferencia = metodoPago === 'transferencia'
  const descuentoTransferencia = esTransferencia ? total * descuento_transferencia : 0
  const subtotalConDescuento = Math.max(
    0,
    total - descuentoTransferencia - descuentoCupon - descuentoOutfit,
  )

  // Envío gratis por monto: se evalúa sobre el subtotal ya descontado.
  const correspondeEnvioGratis =
    envio_gratis_activo && umbral_envio_gratis > 0 && subtotalConDescuento >= umbral_envio_gratis
  const costoEnvioCobrado = retiro || correspondeEnvioGratis ? 0 : costoEnvio
  const totalFinal = subtotalConDescuento + costoEnvioCobrado

  // Errores de todo el formulario, recalculados en cada tecla.
  const errores: ErroresFormulario = validarFormulario(form, { retiro })
  const errorVisible = (campo: Campo) => (tocados[campo] ? errores[campo] : undefined)

  const primeraFalta = (campos: Campo[]) => campos.find((c) => errores[c])
  const faltaContacto =
    primeraFalta(['nombre', 'apellido', 'email', 'telefono', 'dni']) ??
    (retiro ? undefined : primeraFalta(['direccion', 'codigo_postal']))

  function actualizar(campo: Campo, valor: string) {
    let limpio = SOLO_DIGITOS[campo] ? valor.replace(/\D/g, '') : valor
    // El CPA se escribe con letras; se pasan a mayúsculas y se descarta lo que
    // no sea alfanumérico para no dejar el campo en un estado que el validador
    // va a rechazar igual.
    if (campo === 'codigo_postal') {
      limpio = limpio.toUpperCase().replace(/[^A-Z0-9]/g, '')
    }
    setForm((prev) => ({ ...prev, [campo]: limpio }))
    setTocados((prev) => ({ ...prev, [campo]: true }))
    if (campo === 'codigo_postal') {
      setOpcionEnvio(null)
      setOpcionesEnvio([])
      setErrorEnvio(null)
      setCotizacion(null)
    }
  }

  function marcarTocado(campo: Campo) {
    setTocados((prev) => ({ ...prev, [campo]: true }))
  }

  // Al cambiar el tipo de envío, dirección y CP dejan de ser obligatorios (o
  // vuelven a serlo), así que se recalculan sus errores.
  function cambiarRetiro(checked: boolean) {
    if (checked) {
      setOpcionEnvio(OPCION_SHOWROOM)
      setOpcionesEnvio([])
      setErrorEnvio(null)
      setCotizacion(null)
    } else {
      setOpcionEnvio(null)
    }
    setErrorMsg(null)
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
      <ConfirmacionPedido
        pedido={confirmacion}
        enviado={enviado}
        onComprobanteEnviado={() => setEnviado(true)}
        onVolver={() => (
          <Link to="/catalogo" className="btn btn-primary btn-block mt-8">Volver al Catálogo</Link>
        )}
      />
    )
  }

  function handleCotizarEnvio() {
    const limpio = digitosCp(form.codigo_postal)
    if (limpio.length < 4) {
      setErrorEnvio('El código postal debe tener al menos 4 dígitos.')
      return
    }
    setErrorEnvio(null)
    setOpcionEnvio(null)

    // Local: sin red, sin estado de carga.
    const res = cotizarEnvioLocal(limpio, items)
    if (res.error) {
      setErrorEnvio(res.error)
      setOpcionesEnvio([])
      setCotizacion(null)
      return
    }
    setCotizacion(res)
    setOpcionesEnvio(res.opciones)
    setErrorEnvio(
      res.opciones.length === 0
        ? 'No se encontraron opciones de envío para el código postal ingresado.'
        : null,
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorMsg(null)

    // Al enviar, todos los campos pasan a "tocados": así quedan visibles los
    // errores de los que el usuario nunca llegó a tocar.
    setTocados({
      nombre: true,
      apellido: true,
      email: true,
      telefono: true,
      dni: true,
      direccion: true,
      codigo_postal: true,
    })

    const found = validarFormulario(form, { retiro })
    if (Object.keys(found).length > 0) {
      setErrorMsg('Revisá los campos marcados en rojo para continuar.')
      return
    }

    if (!opcionEnvio) {
      setErrorMsg('Seleccioná un método de envío para continuar.')
      return
    }

    setEnviando(true)

    const nombreCompleto = `${form.nombre.trim()} ${form.apellido.trim()}`.trim()
    const envioLabel = retiro
      ? 'Retiro en showroom'
      : `${nombreTransporte(opcionEnvio)} · $${formatearPrecio(costoEnvio)}`

    const res = await crearOrden({
      cliente_nombre: nombreCompleto,
      cliente_email: form.email.trim(),
      cliente_telefono: form.telefono.trim(),
      cliente_dni: form.dni.trim(),
      direccion: retiro ? 'Retiro en showroom' : form.direccion.trim(),
      codigo_postal: retiro ? '' : form.codigo_postal.trim(),
      metodo_pago: metodoPago,
      // Se manda el costo CRUDO cotizado, no `costoEnvioCobrado`: el servidor
      // decide si aplica envío gratis. Mandarle 0 haría que rechace la orden.
      costo_envio: retiro ? 0 : costoEnvio,
      cupon_codigo: cupon?.codigo ?? null,
      envio: retiro
        ? { metodo: 'retiro' }
        : {
            metodo: 'envio',
            carrier: opcionEnvio ? nombreTransporte(opcionEnvio) : undefined,
            carrier_id: opcionEnvio?.carrier.id ?? null,
            servicio: opcionEnvio?.service_type.name,
            service_type: opcionEnvio?.service_type.code,
            logistic_type: opcionEnvio?.logistic_type,
            costo: costoEnvio,
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

    // Se muestra el total que devolvió el servidor, no el cálculo local: si un
    // precio cambió entre armar el carrito y confirmar, el importe que ve el
    // cliente es el que realmente se le va a cobrar.
    const pedido: PedidoConfirmado = {
      id: res.ordenId,
      metodo: metodoPago,
      items,
      subtotal: res.subtotal ?? total,
      descuentoTransferencia: res.descuento_transferencia ?? 0,
      descuentoCupon: res.descuento_cupon ?? 0,
      descuentoOutfit: res.descuento_outfit ?? descuentoOutfit,
      costoEnvio: res.costo_envio ?? costoEnvioCobrado,
      envioGratis: res.envio_gratis ?? false,
      total: res.monto_total ?? totalFinal,
      cuponCodigo: cupon?.codigo ?? null,
      envioLabel,
      retiro,
      nombre: nombreCompleto,
      email: form.email.trim(),
    }

    if (metodoPago === 'transferencia') {
      setEnviando(false)
      setConfirmacion(pedido)
      vaciar()
      window.scrollTo(0, 0)
      return
    }

    const pref = await crearPreferenciaMP(
      res.ordenId,
      items,
      {
        nombre: nombreCompleto,
        email: form.email.trim(),
        telefono: form.telefono.trim(),
        dni: form.dni.trim(),
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

    // Antes de dejar la pestaña: el comprador no tiene cuenta, así que RLS le
    // impide leer `ordenes` y no hay forma de recuperar el desglose del lado del
    // servidor. Se deja en `sessionStorage` para que la pantalla de resultado lo
    // muestre al volver de Mercado Pago.
    guardarResumen(pedido)

    window.location.href = pref.init_point
  }

  const pasos = PASOS_PAGO[metodoPago]

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">Finalizar compra</h1>
      <p className="text-sm opacity-60 mb-8">
        Los campos con <span className="text-error">*</span> son obligatorios. Usamos tu email para
        mandarte la confirmación y tu teléfono para coordinar la entrega.
      </p>

      <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulario */}
        <div className="lg:col-span-2 space-y-6">
          <fieldset className="bg-base-200 rounded-2xl p-5">
            <legend className="font-semibold text-sm px-2 mb-1">Datos de contacto</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo
                etiqueta="Nombre"
                campo="nombre"
                valor={form.nombre}
                error={errorVisible('nombre')}
                autoComplete="given-name"
                onChange={(v) => actualizar('nombre', v)}
                onBlur={() => marcarTocado('nombre')}
              />
              <Campo
                etiqueta="Apellido"
                campo="apellido"
                valor={form.apellido}
                error={errorVisible('apellido')}
                autoComplete="family-name"
                onChange={(v) => actualizar('apellido', v)}
                onBlur={() => marcarTocado('apellido')}
              />
              <Campo
                etiqueta="Email"
                campo="email"
                tipo="email"
                valor={form.email}
                error={errorVisible('email')}
                autoComplete="email"
                inputMode="email"
                placeholder="tu@mail.com"
                ayuda="Acá te mandamos la confirmación del pedido."
                onChange={(v) => actualizar('email', v)}
                onBlur={() => marcarTocado('email')}
              />
              <Campo
                etiqueta="Teléfono"
                campo="telefono"
                tipo="tel"
                valor={form.telefono}
                error={errorVisible('telefono')}
                autoComplete="tel"
                inputMode="tel"
                placeholder="1155551234"
                ayuda="Para coordinar la entrega por WhatsApp."
                onChange={(v) => actualizar('telefono', v)}
                onBlur={() => marcarTocado('telefono')}
              />
              <div className="sm:col-span-2">
                <Campo
                  etiqueta="DNI"
                  campo="dni"
                  valor={form.dni}
                  error={errorVisible('dni')}
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="12345678"
                  ayuda="Sin puntos ni letras. Lo necesita la pasarela de pago."
                  onChange={(v) => actualizar('dni', v)}
                  onBlur={() => marcarTocado('dni')}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="bg-base-200 rounded-2xl p-5">
            <legend className="font-semibold text-sm px-2 mb-1">
              {retiro ? 'Retiro en showroom' : 'Envío a domicilio'}
            </legend>

            <label className="flex items-center gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                className="checkbox checkbox-primary"
                checked={retiro}
                onChange={(e) => cambiarRetiro(e.target.checked)}
              />
              <span className="text-sm font-medium">
                Retiro en showroom (sin cargo) — Oberá, Misiones
              </span>
            </label>

            {retiro ? (
              <p className="text-sm opacity-70 bg-base-100 rounded-xl p-4">
                No necesitás completar la dirección. Después de confirmar el pago te escribimos por
                WhatsApp para coordinar día y horario.
              </p>
            ) : (
              <div className="space-y-4">
                <Campo
                  etiqueta="Dirección"
                  campo="direccion"
                  valor={form.direccion}
                  error={errorVisible('direccion')}
                  autoComplete="street-address"
                  placeholder="Calle, número, piso/depto"
                  onChange={(v) => actualizar('direccion', v)}
                  onBlur={() => marcarTocado('direccion')}
                />

                <div>
                  <Campo
                    etiqueta="Código Postal"
                    campo="codigo_postal"
                    valor={form.codigo_postal}
                    error={errorVisible('codigo_postal')}
                    inputMode="text"
                    autoComplete="postal-code"
                    maxLength={8}
                    placeholder="3360 o N3360ABC"
                    ayuda="4 dígitos (3360) o CPA completo (N3360ABC)."
                    onChange={(v) => actualizar('codigo_postal', v)}
                    onBlur={() => marcarTocado('codigo_postal')}
                  />
                  <button
                    type="button"
                    disabled={digitosCp(form.codigo_postal).length < 4}
                    onClick={handleCotizarEnvio}
                    className="btn btn-outline btn-sm mt-2"
                  >
                    Calcular envío
                  </button>

                  {errorEnvio && <p className="text-error text-xs mt-2">{errorEnvio}</p>}

                  {opcionesEnvio.length === 0 && digitosCp(form.codigo_postal).length >= 4 && !errorEnvio && (
                    <p className="text-xs opacity-60 mt-2">
                      Calculamos el envío automáticamente. Elegí una opción para continuar.
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
                              onClick={() => {
                                setOpcionEnvio(opt)
                                setErrorMsg(null)
                              }}
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
          </fieldset>

          {/* Método de pago */}
          <div className="bg-base-200 rounded-2xl p-5">
            <h3 className="text-lg font-bold text-zinc-900 tracking-tight">Método de pago</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
              <MetodoBoton
                seleccionado={metodoPago === 'mercadopago'}
                onClick={() => setMetodoPago('mercadopago')}
                etiqueta="Mercado Pago"
                descripcion={
                  cuotas_sin_interes > 1
                    ? `${cuotas_sin_interes} cuotas sin interés`
                    : 'Tarjeta de crédito o débito'
                }
                badge={{ texto: 'COMPRA SEGURA', clases: 'bg-sky-50 text-sky-600 border-sky-100' }}
                activo="border-zinc-900 ring-zinc-900"
              />
              <MetodoBoton
                seleccionado={metodoPago === 'transferencia'}
                onClick={() => setMetodoPago('transferencia')}
                etiqueta="Transferencia bancaria"
                descripcion={
                  descuento_transferencia > 0
                    ? `${Math.round(descuento_transferencia * 100)}% de descuento, sin comisión`
                    : 'Sin comisión'
                }
                badge={
                  descuento_transferencia > 0
                    ? {
                        texto: `${Math.round(descuento_transferencia * 100)}% DE DESCUENTO`,
                        clases: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                      }
                    : undefined
                }
                activo="border-emerald-600 ring-emerald-600"
              />
            </div>

            {/* Pasos del método elegido, visibles antes de confirmar */}
            <ol className="space-y-2 bg-base-100 rounded-xl p-4">
              {pasos.map((paso, i) => (
                <li key={paso} className="flex gap-3 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-neutral text-neutral-content text-[11px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="opacity-80">{paso}</span>
                </li>
              ))}
            </ol>

            {esTransferencia && (
              <div className="mt-4 bg-base-100 rounded-xl p-4">
                <p className="text-sm font-semibold">Datos de la cuenta</p>
                <p className="text-xs opacity-60 mt-1 mb-3">
                  Podés dejar la transferencia lista desde ahora. El importe exacto a transferir es el
                  total que ves en el resumen.
                </p>
                <DatosBancarios monto={totalFinal} />
              </div>
            )}
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
                  <img
                    src={imagenProducto(item.imagen, i)}
                    srcSet={srcsetImagen(item.imagen, 40).srcset}
                    sizes={srcsetImagen(item.imagen, 40).sizes}
                    alt={`${item.nombre}, talle ${item.talle || 'único'}`}
                    loading="lazy"
                    decoding="async"
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
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

              {descuentoOutfit > 0 && (
                <div className="flex justify-between text-sm text-success font-medium">
                  <span>Descuento outfit</span>
                  <span>-${formatearPrecio(descuentoOutfit)}</span>
                </div>
              )}

              {descuentoTransferencia > 0 && (
                <div className="flex justify-between text-sm text-success font-medium">
                  <span>
                    Descuento transferencia -{Math.round(descuento_transferencia * 100)}%
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

              {metodoPago === 'mercadopago' && cuotas_sin_interes > 1 && (
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
              disabled={enviando}
              className={`btn btn-block mt-5 ${esTransferencia ? 'btn-success' : 'btn-primary'}`}
            >
              {enviando ? (
                <span className="loading loading-spinner loading-sm" />
              ) : esTransferencia ? (
                `Confirmar pedido por $${formatearPrecio(totalFinal)}`
              ) : (
                'Pagar con Mercado Pago'
              )}
            </button>
            {faltaContacto ? (
              <p className="text-xs opacity-60 text-center mt-2">
                {`Falta completar: ${faltaContacto.replace('_', ' ')}.`}
              </p>
            ) : !opcionEnvio && !retiro ? (
              <p className="text-xs opacity-60 text-center mt-2">
                Elegí una opción de envío para continuar.
              </p>
            ) : null}
          </div>
        </div>
      </form>
    </div>
  )
}

/* ──── Campos ──── */

function Campo({
  etiqueta,
  campo,
  valor,
  error,
  ayuda,
  tipo = 'text',
  inputMode,
  autoComplete,
  placeholder,
  maxLength,
  onChange,
  onBlur,
}: {
  etiqueta: string
  campo: Campo
  valor: string
  error?: string
  ayuda?: string
  tipo?: string
  inputMode?: 'text' | 'numeric' | 'tel' | 'email'
  autoComplete?: string
  placeholder?: string
  maxLength?: number
  onChange: (valor: string) => void
  onBlur: () => void
}) {
  return (
    <div>
      <label className="floating-label">
        <span>
          {etiqueta} <span className="text-error">*</span>
        </span>
        <input
          type={tipo}
          className={`input input-bordered w-full ${error ? 'input-error' : ''}`}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-invalid={!!error}
          aria-describedby={`ayuda-${campo}`}
        />
      </label>
      {error ? (
        <p id={`ayuda-${campo}`} className="text-error text-xs mt-1 flex items-center gap-1">
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      ) : ayuda ? (
        <p id={`ayuda-${campo}`} className="text-xs opacity-50 mt-1">{ayuda}</p>
      ) : null}
    </div>
  )
}

function MetodoBoton({
  seleccionado,
  onClick,
  etiqueta,
  descripcion,
  badge,
  activo,
}: {
  seleccionado: boolean
  onClick: () => void
  etiqueta: string
  descripcion: string
  badge?: { texto: string; clases: string }
  activo: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={seleccionado}
      className={`relative flex flex-col justify-between p-5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
        seleccionado ? `bg-white ring-2 ${activo} shadow-sm` : 'bg-white border-zinc-200 hover:border-zinc-400'
      }`}
    >
      <div className="flex items-center justify-between w-full mb-4">
        {badge ? (
          <span className={`text-xs font-bold tracking-wider uppercase px-2.5 py-1 rounded-md border ${badge.clases}`}>
            {badge.texto}
          </span>
        ) : (
          <span />
        )}
        <div
          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
            seleccionado ? `${activo} border-2` : 'border-zinc-300'
          }`}
        >
          {seleccionado && <div className="w-2 h-2 rounded-full bg-white" />}
        </div>
      </div>
      <div>
        <p className="text-base font-bold text-zinc-900">{etiqueta}</p>
        <p className="text-xs font-medium text-zinc-500 mt-0.5">{descripcion}</p>
      </div>
    </button>
  )
}

/* ──── Pantalla de confirmación ──── */

function ConfirmacionPedido({
  pedido,
  enviado,
  onComprobanteEnviado,
  onVolver,
}: {
  pedido: PedidoConfirmado
  enviado: boolean
  onComprobanteEnviado: () => void
  onVolver: () => React.ReactNode
}) {
  const esTransferencia = pedido.metodo === 'transferencia'
  const codigoPedido = pedido.id.slice(0, 8).toUpperCase()
  const pasos = PASOS_PAGO[pedido.metodo]

  const whatsappComprobante = `${CONTACTO.whatsapp}?text=${encodeURIComponent(
    `Hola Ikigai Clothes! Acabo de hacer una compra por transferencia.\nPedido: ${codigoPedido}\nImporte: $${pedido.total}\nTe paso el comprobante.`,
  )}`

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="bg-success/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="h-10 w-10 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold">
          {enviado ? '¡Gracias por tu compra!' : '¡Pedido registrado!'}
        </h2>
        <p className="opacity-70 mt-2 text-sm max-w-md mx-auto leading-relaxed">
          {enviado
            ? 'Recibimos tu comprobante y estamos verificando la acreditación. Te escribimos por WhatsApp cuando esté confirmada.'
            : esTransferencia
              ? 'Tu pedido quedó guardado. Completá la transferencia y subí el comprobante para que lo verifiquemos.'
              : 'Tu pedido quedó guardado. Te avisamos por WhatsApp para coordinar la entrega.'}
        </p>
        <div className="inline-flex flex-col items-center mt-4">
          <p className="text-xs opacity-50 mb-1">Número de pedido</p>
          <p className="font-mono text-lg font-bold bg-base-200 rounded-lg px-4 py-2 tracking-wider">
            {codigoPedido}
          </p>
          <p className="text-xs opacity-40 mt-1">
            Guardalo: es lo que vamos a pedir si necesitás consultar algo.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Desglose */}
        <div className="lg:col-span-3 space-y-6">
          <section className="bg-base-200 rounded-2xl p-5">
            <h3 className="font-semibold text-sm mb-4">Detalle del pedido</h3>

            <ul className="space-y-3 mb-4">
              {pedido.items.map((item, i) => (
                <li key={`${item.producto_id}-${item.talle}-${i}`} className="flex items-center gap-3">
                  <img
                    src={imagenProducto(item.imagen, i)}
                    srcSet={srcsetImagen(item.imagen, 48).srcset}
                    sizes={srcsetImagen(item.imagen, 48).sizes}
                    alt={`${item.nombre}, talle ${item.talle || 'único'}`}
                    loading="lazy"
                    decoding="async"
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 text-sm min-w-0">
                    <p className="font-medium">{item.nombre}</p>
                    <p className="opacity-50 text-xs">
                      Talle {item.talle} · {item.cantidad} × ${formatearPrecio(item.precio_unitario)}
                    </p>
                  </div>
                  <span className="text-sm font-bold whitespace-nowrap">
                    ${formatearPrecio(item.precio_unitario * item.cantidad)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="border-t border-line pt-3 space-y-2">
              <Fila etiqueta="Subtotal" valor={`$${formatearPrecio(pedido.subtotal)}`} />
              {pedido.descuentoOutfit > 0 && (
                <Fila
                  etiqueta="Descuento outfit"
                  valor={`-$${formatearPrecio(pedido.descuentoOutfit)}`}
                  clase="text-success font-medium"
                />
              )}
              {pedido.descuentoTransferencia > 0 && (
                <Fila
                  etiqueta="Descuento por transferencia"
                  valor={`-$${formatearPrecio(pedido.descuentoTransferencia)}`}
                  clase="text-success font-medium"
                />
              )}
              {pedido.descuentoCupon > 0 && (
                <Fila
                  etiqueta={`Cupón ${pedido.cuponCodigo ?? ''}`.trim()}
                  valor={`-$${formatearPrecio(pedido.descuentoCupon)}`}
                  clase="text-success font-medium"
                />
              )}
              <Fila
                etiqueta="Envío"
                valor={
                  pedido.retiro || pedido.envioGratis
                    ? 'Sin cargo'
                    : pedido.costoEnvio > 0
                      ? `$${formatearPrecio(pedido.costoEnvio)}`
                      : 'Sin cargo'
                }
              />
              <div className="h-px bg-line my-2" />
              <div className="flex justify-between items-baseline">
                <span className="font-bold">Total</span>
                <span className="text-xl font-bold text-success">
                  ${formatearPrecio(pedido.total)}
                </span>
              </div>
            </div>
          </section>

          <section className="bg-base-200 rounded-2xl p-5">
            <h3 className="font-semibold text-sm mb-3">Cómo sigue</h3>
            <ol className="space-y-3">
              {pasos.map((paso, i) => (
                <li key={paso} className="flex gap-3 text-sm">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral text-neutral-content text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="opacity-80 pt-0.5">{paso}</span>
                </li>
              ))}
            </ol>

            <div className="mt-4 pt-4 border-t border-line flex flex-wrap gap-2">
              <a
                href={esTransferencia ? whatsappComprobante : `${CONTACTO.whatsapp}?text=${encodeURIComponent(`Hola Ikigai Clothes! Consulta sobre el pedido ${codigoPedido}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-outline"
              >
                Consultar por WhatsApp
              </a>
              <Link to="/catalogo" className="btn btn-sm btn-ghost">
                Seguir comprando
              </Link>
            </div>
          </section>
        </div>

        {/* Datos de pago */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-base-200 rounded-2xl p-5">
            <h3 className="font-semibold text-sm mb-3">Método de pago</h3>
            <p className="text-sm font-medium">{TEXTO_METODO[pedido.metodo].titulo}</p>
            <p className="text-xs opacity-60 mt-1">{TEXTO_METODO[pedido.metodo].resumen}</p>
          </section>

          <section className="bg-base-200 rounded-2xl p-5">
            <h3 className="font-semibold text-sm mb-1">Entrega</h3>
            <p className="text-sm font-medium">{pedido.envioLabel}</p>
            {pedido.retiro ? (
              <p className="text-xs opacity-60 mt-1">
                Te contactamos por WhatsApp para coordinar el horario en el showroom.
              </p>
            ) : (
              <p className="text-xs opacity-60 mt-1">
                Envío a domicilio al código postal que cargaste.
              </p>
            )}
          </section>

          {esTransferencia && !enviado && (
            <section className="bg-base-200 rounded-2xl p-5">
              <h3 className="font-semibold text-sm mb-1">Datos de la cuenta</h3>
              <p className="text-xs opacity-60 mb-3">
                Transferí el importe exacto y después subí el comprobante.
              </p>
              <DatosBancarios monto={pedido.total} />
            </section>
          )}

          {esTransferencia && (
            <UploadComprobante
              ordenId={pedido.id}
              enviado={enviado}
              onEnviado={onComprobanteEnviado}
            />
          )}
        </div>
      </div>

      <div className="mt-8">{onVolver()}</div>
    </div>
  )
}

/** Fila etiqueta/valor del desglose. */
function Fila({ etiqueta, valor, clase = '' }: { etiqueta: string; valor: string; clase?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="opacity-60">{etiqueta}</span>
      <span className={clase}>{valor}</span>
    </div>
  )
}

function UploadComprobante({
  ordenId,
  enviado,
  onEnviado,
}: {
  ordenId: string
  enviado: boolean
  onEnviado: () => void
}) {
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null)
  const [comprobantePreview, setComprobantePreview] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [infoCompresion, setInfoCompresion] = useState<string | null>(null)
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

    const { url, error } = await subirComprobante(comprobanteFile, ordenId)
    if (error || !url) {
      setSubiendo(false)
      setUploadError(error ?? 'No se pudo subir el comprobante.')
      return
    }

    const { error: updateError } = await actualizarComprobanteOrden(ordenId, url)
    setSubiendo(false)

    if (updateError) {
      setUploadError('Se subió el archivo pero no se pudo vincular al pedido. Contactanos.')
      return
    }

    onEnviado()
  }

  if (enviado) {
    return (
      <section className="bg-success/10 border border-success/30 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <svg className="h-6 w-6 text-success shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          <div>
            <p className="font-semibold text-sm">Comprobante recibido</p>
            <p className="text-xs opacity-70 mt-1 leading-relaxed">
              Lo estamos verificando. Te escribimos por WhatsApp cuando el pago se acredite.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-base-200 rounded-2xl p-5">
      <h3 className="font-semibold text-sm mb-1">Subir comprobante</h3>
      <p className="text-xs opacity-60 mb-3">
        Es la forma más rápida de que verifiquemos tu pago.
      </p>

      <div
        ref={dropRef}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-base-300 rounded-xl p-5 text-center cursor-pointer hover:border-primary/50 transition-colors"
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
          <img src={comprobantePreview} alt="Comprobante" className="max-h-32 mx-auto rounded-lg" />
        ) : comprobanteFile ? (
          <div className="flex items-center justify-center gap-2 text-sm">
            <svg className="h-5 w-5 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <span className="font-medium truncate max-w-[12rem]">{comprobanteFile.name}</span>
            <button
              type="button"
              className="btn btn-xs btn-ghost text-error shrink-0"
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
            <svg className="h-8 w-8 mx-auto opacity-40 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className="text-sm opacity-60">Arrastrá el comprobante o hacé click</p>
            <p className="text-xs opacity-40 mt-1">JPG, PNG o PDF — máximo 10 MB</p>
          </>
        )}
      </div>

      {uploadError && <p className="text-error text-xs mt-2">{uploadError}</p>}
      {infoCompresion && <p className="text-success text-xs mt-2">{infoCompresion}</p>}

      <button
        type="button"
        disabled={!comprobanteFile || subiendo}
        onClick={handleSubirComprobante}
        className="btn btn-success btn-block btn-sm mt-4"
      >
        {subiendo ? (
          <span className="loading loading-spinner loading-sm" />
        ) : (
          'Enviar comprobante'
        )}
      </button>
    </section>
  )
}