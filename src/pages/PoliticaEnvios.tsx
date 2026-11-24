import { Link } from 'react-router-dom'
import { PaginaInstitucional } from '../components/PaginaInstitucional'
import { MediosPagoBadges } from '../components/MediosPagoBadges'
import { useSeo } from '../hooks/useSeo'
import { useTienda } from '../context/tienda'
import { formatearPrecio } from '../lib/precios'
import { MAPS_SHOWROOM_URL, urlWhatsapp } from '../lib/contacto'

export function PoliticaEnvios() {
  useSeo()
  const {
    umbral_envio_gratis,
    envio_gratis_activo,
    cuotas_sin_interes,
    descuento_transferencia,
    direccion,
    horario_atencion,
    whatsapp,
  } = useTienda()
  const porcentajeTransferencia = Math.round(descuento_transferencia * 100)

  return (
    <PaginaInstitucional
      titulo="Política de Envíos"
      bajada="Enviamos a todo el país. Calculá el costo exacto por código postal antes de confirmar tu compra."
    >
      <section>
        <h2 className="font-display text-lg mb-2">Cómo calculamos el envío</h2>
        <p>
          Ingresá tu código postal en la calculadora de la ficha del producto o en el resumen del
          carrito para ver la tarifa estimada. El monto final se confirma al completar la dirección
          de entrega durante el checkout.
        </p>
      </section>

      {envio_gratis_activo && umbral_envio_gratis > 0 && (
        <section>
          <h2 className="font-display text-lg mb-2">Envío gratis</h2>
          <p>
            En compras desde <strong>${formatearPrecio(umbral_envio_gratis)}</strong> el envío es
            gratis. El beneficio se aplica automáticamente cuando se alcanza el monto y se muestra
            en el resumen del pedido.
          </p>
        </section>
      )}

      <section>
        <h2 className="font-display text-lg mb-2">Despacho y seguimiento</h2>
        <p>
          Preparamos tu pedido cuando se confirma el pago. Una vez despachado, te compartimos el
          número de seguimiento por email para que puedas seguir el envío. Si pagaste por
          transferencia, el despacho se realiza una vez acreditado el comprobante.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Formas de pago</h2>
        <MediosPagoBadges className="mb-3" />
        <p>
          {cuotas_sin_interes > 1
            ? `Podés pagar con tarjeta en hasta ${cuotas_sin_interes} cuotas sin interés a través de Mercado Pago. `
            : 'Podés pagar con tarjeta y dinero en cuenta a través de Mercado Pago. '}
          {porcentajeTransferencia > 0
            ? `También podés transferir con ${porcentajeTransferencia}% de descuento; los datos bancarios aparecen al confirmar la compra.`
            : 'También podés pagar por transferencia bancaria; los datos aparecen al confirmar la compra.'}
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Retiro en el showroom</h2>
        <p>
          Si preferís retirar sin costo, pasate por {direccion} ({horario_atencion}). Coordiná tu
          visita con{' '}
          <a href={urlWhatsapp(whatsapp)} target="_blank" rel="noopener noreferrer" className="underline">
            WhatsApp
          </a>{' '}
          o mirá{' '}
          <a href={MAPS_SHOWROOM_URL} target="_blank" rel="noopener noreferrer" className="underline">
            cómo llegar
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Cambios y devoluciones</h2>
        <p>
          Si la prenda no te quedó bien, consultá la{' '}
          <Link to="/devoluciones" className="underline">
            política de cambios y devoluciones
          </Link>
          . Para cualquier duda sobre tu envío,{' '}
          <Link to="/contacto" className="underline">
            escribinos
          </Link>
          .
        </p>
      </section>
    </PaginaInstitucional>
  )
}
