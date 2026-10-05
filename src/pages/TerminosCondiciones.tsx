import { PaginaInstitucional } from '../components/PaginaInstitucional'
import { useSeo } from '../hooks/useSeo'
import { CONTACTO, SHOWROOM } from '../lib/contacto'

export function TerminosCondiciones() {
  useSeo()

  return (
    <PaginaInstitucional
      titulo="Términos y Condiciones"
      bajada="Las condiciones de compra en Ikigai Clothes. Leelas antes de confirmar tu pedido."
    >
      <section>
        <h2 className="font-display text-lg mb-2">Quiénes somos</h2>
        <p>
          Ikigai Clothes vende indumentaria urbana y deportiva de forma directa desde Oberá,
          Misiones, Argentina. Podés visitarnos en el showroom o comprar online en este sitio. Para
          cualquier consulta:{' '}
          <a href={CONTACTO.whatsapp} target="_blank" rel="noopener noreferrer" className="underline">
            WhatsApp {CONTACTO.whatsappVisible}
          </a>{' '}
          o{' '}
          <a href={`mailto:${CONTACTO.email}`} className="underline">
            {CONTACTO.email}
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Precio y pagos</h2>
        <p>
          Los precios están expresados en pesos argentinos y se muestran con el descuento aplicado
          cuando corresponde. Aceptamos dos medios de pago:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>
            <strong>Mercado Pago:</strong> tarjetas de crédito, débito y dinero en cuenta, en cuotas
            según las opciones disponibles al momento de pagar.
          </li>
          <li>
            <strong>Transferencia bancaria:</strong> tiene un descuento adicional sobre el subtotal.
            Al confirmar el pedido te mostramos los datos bancarios y el número de pedido. El pago
            se verifica dentro de las 72 horas hábiles.
          </li>
        </ul>
        <p className="mt-2">
          El pedido se considera pagado cuando Mercado Pago lo aprueba o cuando validamos la
          transferencia. Hasta entonces queda pendiente.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Envíos</h2>
        <p>
          Enviamos a todo el país. El costo se calcula según tu código postal antes de confirmar el
          pedido. Los plazos de entrega son estimados y dependen de la empresa de correo.
          También podés retirar sin cargo en nuestro showroom de Oberá coordinando previamente.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Stock y disponibilidad</h2>
        <p>
          Cada prenda es de edición única. Si al agregar algo a tu carrito ya lo tenés, el sitio te
          avisa y te ofrece reemplazarlo, de modo que nunca vas a recibir dos unidades de la misma
          prenda.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Cambios y devoluciones</h2>
        <p>
          Tenés 30 días corridos desde la recepción para solicitar un cambio, siempre que la prenda
          conserve su etiqueta y no haya sido usada. El detalle está en nuestra{' '}
          <a href="/devoluciones" className="underline">
            política de devoluciones
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Garantía</h2>
        <p>
          Los productos tienen garantía legal conforme a la Ley 24.240 de Defensa del Consumidor.
          Ante cualquier problema, escribinos y lo resolvemos.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Derecho de arrepentimiento</h2>
        <p>
          Si compraste desde el sitio, podés expresar tu arrepentimiento dentro de los 10 días
          hábiles de la entrega. Más detalle en{' '}
          <a
            href="/contacto?arrepentimiento=1"
            className="underline"
          >
            nuestra sección de contacto
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Propiedad intelectual</h2>
        <p>
          Los textos, fotos y el diseño de este sitio pertenecen a Ikigai Clothes. Las fotos de los
          productos son de venta propia.
        </p>
      </section>

      <p className="text-xs opacity-60">
        Showroom: {SHOWROOM.direccion}. {SHOWROOM.horario}. Última actualización: enero de 2026.
      </p>
    </PaginaInstitucional>
  )
}
