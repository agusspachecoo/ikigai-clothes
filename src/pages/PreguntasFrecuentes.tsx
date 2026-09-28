import { Link } from 'react-router-dom'
import { PaginaInstitucional, Pregunta } from '../components/PaginaInstitucional'
import { useTienda } from '../context/tienda'
import { formatearPrecio } from '../lib/precios'

export function PreguntasFrecuentes() {
  const { umbral_envio_gratis, descuento_transferencia, cuotas_sin_interes } = useTienda()

  const grupos = [
    {
      titulo: 'Envíos',
      items: [
        {
          q: '¿A qué lugares llegan los envíos?',
          r: 'Enviamos a todo el país y también podés retirar sin cargo en el showroom.',
        },
        {
          q: '¿El envío es gratis?',
          r:
            umbral_envio_gratis > 0
              ? `Sí, en compras desde $${formatearPrecio(umbral_envio_gratis)}. El umbral se puede ver en el carrito y en la ficha de cada producto.`
              : 'El costo se calcula según el código postal y el peso del pedido.',
        },
        {
          q: '¿Cuánto demora el envío?',
          r: 'Entre 3 y 8 días hábiles según la zona. Vas a recibir el seguimiento por email.',
        },
      ],
    },
    {
      titulo: 'Pagos',
      items: [
        {
          q: '¿Qué medios de pago aceptan?',
          r: 'Mercado Pago (tarjetas, débito y dinero en cuenta) y transferencia bancaria directa.',
        },
        {
          q: '¿Qué descuento tiene la transferencia?',
          r: `${Math.round(descuento_transferencia * 100)}% de descuento sobre el subtotal.`,
        },
        {
          q: '¿Hay cuotas?',
          r:
            cuotas_sin_interes > 1
              ? `Sí, hasta ${cuotas_sin_interes} cuotas sin interés con Mercado Pago.`
              : 'No hay cuotas disponibles por el momento.',
        },
        {
          q: '¿Los cupones se acumulan con el descuento por transferencia?',
          r: 'Sí, se suman hasta el total del subtotal. El pedido lo valida el servidor antes de cobrar.',
        },
      ],
    },
    {
      titulo: 'Talles y productos',
      items: [
        {
          q: '¿Cómo elijo el talle?',
          r: 'En cada ficha de producto tenés la guía de talles con medidas de referencia. Los talles sin stock aparecen tachados.',
        },
        {
          q: '¿Las prendas son originals?',
          r: 'Sí, todas nuestras prendas son de producción propia y controles de calidad.',
        },
        {
          q: '¿Puedo devolver una prenda?',
          r: 'Sí, tenés 30 días desde la recepción. Mirá la política de devolución.',
        },
      ],
    },
    {
      titulo: 'Outfits y combos',
      items: [
        {
          q: '¿Qué es comprar el outfit?',
          r: 'Es un combo de prendas ya combinadas, con un precio promocional menor al de comprar cada una por separado.',
        },
        {
          q: '¿Puedo cambiar una prenda del combo?',
          r: 'Sí, contactanos y armamos el cambio por otro talle o prenda del mismo valor.',
        },
      ],
    },
  ]

  return (
    <PaginaInstitucional
      titulo="Preguntas frecuentes"
      bajada="Todo lo que suelen preguntarnos antes de comprar."
    >
      {grupos.map((g) => (
        <section key={g.titulo}>
          <h2 className="font-display text-lg mb-3">{g.titulo}</h2>
          <div className="divide-y divide-line border-t border-line">
            {g.items.map((i) => (
              <Pregunta key={i.q} q={i.q}>
                <p>{i.r}</p>
              </Pregunta>
            ))}
          </div>
        </section>
      ))}

      <p>
        ¿Te quedó una duda?{' '}
        <Link to="/contacto" className="underline">
          Escribinos
        </Link>{' '}
        y te respondemos en el día.
      </p>
    </PaginaInstitucional>
  )
}
