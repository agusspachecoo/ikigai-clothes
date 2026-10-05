import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCart } from '../context/cart'
import { CONTACTO } from '../lib/contacto'
import { formatearPrecio } from '../lib/precios'
import { imagenProducto, srcsetImagen } from '../lib/imagenes'
import { TEXTO_METODO } from '../lib/pagos'
import { leerResumen, podarResumen, type ResumenPedido } from '../lib/resumenPedido'

interface Props {
  status: 'success' | 'failure' | 'pending'
}

const CONFIG = {
  success: {
    title: '¡Pago aprobado!',
    description:
      'Tu pago fue confirmado y tu pedido ya está en proceso. Te avisamos por WhatsApp para coordinar la entrega.',
    icon: (
      <svg className="h-10 w-10 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    ),
    iconBox: 'bg-success/10',
    link: { to: '/catalogo', label: 'Seguir comprando', color: 'btn-primary' },
    pasos: [
      'Recibimos la confirmación del pago.',
      'Preparamos tu pedido y coordinamos la entrega por WhatsApp.',
      'Guardá el número de pedido por si necesitás consultar algo.',
    ],
  },
  failure: {
    title: 'El pago no pudo completarse',
    description:
      'No se realizó ningún cargo. Podés intentar nuevamente o elegir otro medio de pago.',
    icon: (
      <svg className="h-10 w-10 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    iconBox: 'bg-error/10',
    link: { to: '/checkout', label: 'Reintentar pago', color: 'btn-primary' },
    pasos: [
      'Revisá los datos de tu tarjeta o elegí transferencia bancaria, que tiene descuento.',
      'Si el problema sigue, escribinos por WhatsApp y lo resolvemos.',
    ],
  },
  pending: {
    title: 'Pago pendiente',
    description:
      'Tu pago está siendo procesado. Se liquida solo con la acreditación: no tenés que hacer nada más.',
    icon: (
      <svg className="h-10 w-10 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    iconBox: 'bg-warning/10',
    link: { to: '/catalogo', label: 'Volver a la tienda', color: 'btn-primary' },
    pasos: [
      'Si pagaste con tarjeta, la acreditación puede tardar unos minutos.',
      'Te confirmamos por WhatsApp apenas el pago figure acreditado.',
      'No vuelvas a pagar: si hay algún problema te lo avisamos.',
    ],
  },
} satisfies Record<Props['status'], {
  title: string
  description: string
  icon: React.ReactNode
  iconBox: string
  link: { to: string; label: string; color: string }
  pasos: string[]
}>

export function CheckoutResultado({ status }: Props) {
  const [searchParams] = useSearchParams()
  const { vaciar } = useCart()
  const limpiado = useRef(false)

  // Mercado Pago devuelve `external_reference` con el UUID de la orden. Si no
  // viene (el usuario cerró la pestaña del checkout y volvió al navegador a
  // mano), `leerResumen` cae al puntero del último pedido guardado.
  const orderRef = searchParams.get('external_reference') ?? ''

  // El resumen se lee una sola vez al montar, con un inicializador de
  // `useState`: si se leyera en cada render, al podar el storage un rerender lo
  // volvería a dejar en null y el desglose parpadearía.
  const [resumen] = useState<ResumenPedido | null>(() => leerResumen(orderRef))

  useEffect(() => {
    if (status === 'success' && !limpiado.current) {
      limpiado.current = true
      vaciar()
    }
  }, [status, vaciar])

  useEffect(() => {
    // Se poda después de leer, no antes, y conservando el pedido actual: si el
    // pago falló, el usuario vuelve al checkout y puede reintentar; los
    // resúmenes de intentos anteriores ya no sirven para nada.
    if (resumen) podarResumen(resumen.id)
  }, [resumen])

  const cfg = CONFIG[status]
  const codigoPedido = (resumen?.id ?? orderRef).slice(0, 8).toUpperCase()

  const whatsapp = `${CONTACTO.whatsapp}?text=${encodeURIComponent(
    `Hola Ikigai Clothes! Consulta sobre el pedido ${codigoPedido}.`,
  )}`

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <div className="text-center">
        <div
          className={`${cfg.iconBox} w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6`}
        >
          {cfg.icon}
        </div>
        <h2 className="text-2xl font-bold">{cfg.title}</h2>
        <p className="opacity-60 mt-2">{cfg.description}</p>

        {status !== 'failure' && codigoPedido && (
          <div className="inline-flex flex-col items-center mt-4">
            <p className="text-xs opacity-50 mb-1">Número de pedido</p>
            <p className="font-mono text-lg font-bold bg-base-200 rounded-lg px-4 py-2 tracking-wider">
              {codigoPedido}
            </p>
          </div>
        )}
      </div>

      {resumen && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-8">
          <div className="lg:col-span-3 space-y-6">
            <section className="bg-base-200 rounded-2xl p-5">
              <h3 className="font-semibold text-sm mb-4">Detalle del pedido</h3>

              <ul className="space-y-3 mb-4">
                {resumen.items.map((item, i) => (
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
                        Talle {item.talle} · {item.cantidad} × $
                        {formatearPrecio(item.precio_unitario)}
                      </p>
                    </div>
                    <span className="text-sm font-bold whitespace-nowrap">
                      ${formatearPrecio(item.precio_unitario * item.cantidad)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="border-t border-line pt-3 space-y-2">
                <Fila etiqueta="Subtotal" valor={`$${formatearPrecio(resumen.subtotal)}`} />
                {resumen.descuentoOutfit > 0 && (
                  <Fila
                    etiqueta="Descuento outfit"
                    valor={`-$${formatearPrecio(resumen.descuentoOutfit)}`}
                    clase="text-success font-medium"
                  />
                )}
                {resumen.descuentoTransferencia > 0 && (
                  <Fila
                    etiqueta="Descuento por transferencia"
                    valor={`-$${formatearPrecio(resumen.descuentoTransferencia)}`}
                    clase="text-success font-medium"
                  />
                )}
                {resumen.descuentoCupon > 0 && (
                  <Fila
                    etiqueta={`Cupón ${resumen.cuponCodigo ?? ''}`.trim()}
                    valor={`-$${formatearPrecio(resumen.descuentoCupon)}`}
                    clase="text-success font-medium"
                  />
                )}
                <Fila
                  etiqueta="Envío"
                  valor={
                    resumen.retiro || resumen.envioGratis || resumen.costoEnvio <= 0
                      ? 'Sin cargo'
                      : `$${formatearPrecio(resumen.costoEnvio)}`
                  }
                />
                <div className="h-px bg-line my-2" />
                <div className="flex justify-between items-baseline">
                  <span className="font-bold">Total</span>
                  <span className="text-xl font-bold text-success">
                    ${formatearPrecio(resumen.total)}
                  </span>
                </div>
              </div>
            </section>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <section className="bg-base-200 rounded-2xl p-5">
              <h3 className="font-semibold text-sm mb-3">Método de pago</h3>
              <p className="text-sm font-medium">{TEXTO_METODO[resumen.metodo].titulo}</p>
              <p className="text-xs opacity-60 mt-1">{TEXTO_METODO[resumen.metodo].resumen}</p>
            </section>

            <section className="bg-base-200 rounded-2xl p-5">
              <h3 className="font-semibold text-sm mb-1">Entrega</h3>
              <p className="text-sm font-medium">{resumen.envioLabel}</p>
              <p className="text-xs opacity-60 mt-1">
                {resumen.retiro
                  ? 'Te contactamos por WhatsApp para coordinar el horario en el showroom.'
                  : 'Envío a domicilio al código postal que cargaste.'}
              </p>
            </section>
          </div>
        </div>
      )}

      <div className="bg-base-200 rounded-2xl p-5 mt-8">
        <h3 className="font-semibold text-sm mb-3">Qué sigue</h3>
        <ol className="space-y-3">
          {cfg.pasos.map((paso, i) => (
            <li key={paso} className="flex gap-3 text-sm">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral text-neutral-content text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="opacity-80 pt-0.5">{paso}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-2 mt-6">
        <Link to={cfg.link.to} className={`btn ${cfg.link.color} btn-block`}>
          {cfg.link.label}
        </Link>
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost btn-block btn-sm"
        >
          Consultar por WhatsApp
        </a>
      </div>
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