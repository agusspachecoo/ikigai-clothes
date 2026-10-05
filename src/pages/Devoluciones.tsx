import { Link } from 'react-router-dom'
import { PaginaInstitucional, Pregunta } from '../components/PaginaInstitucional'
import { useSeo } from '../hooks/useSeo'

export function Devoluciones() {
  useSeo()

  return (
    <PaginaInstitucional
      titulo="Política de devolución"
      bajada="Comprás sin vueltas: si la prenda no te sirve, tenés 30 días para cambiarla."
    >
      <section>
        <h2 className="font-display text-lg mb-2">Plazo</h2>
        <p>
          Disponés de 30 días corridos desde la recepción del pedido para solicitar el cambio. La
          prenda debe conservar su etiqueta, estar sin uso y en su empaque original.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Cómo hacer el cambio</h2>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Escribinos por WhatsApp o desde el formulario de contacto con tu número de pedido.</li>
          <li>Te respondemos con las opciones de envío disponibles.</li>
          <li>Mandás la prenda y validamos el cambio en 48 horas hábiles.</li>
        </ol>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Costos</h2>
        <p>
          El costo del envío corre por nuestra cuenta cuando la devolución se debe a un error nuestro.
          Si elegiste un talle que no te quedó bien, el envío de ida y vuelta queda a tu cargo.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Cambios sin stock</h2>
        <p>
          Si el talle que querés cambiar no tiene stock, te ofrecemos un crédito por el mismo valor
          o el reintegro del dinero.
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg mb-2">Reintegros</h2>
        <p>
          Los reintegros se acreditan en el mismo medio de pago con el que abonaste y pueden tardar
          hasta 10 días hábiles según tu banco.
        </p>
      </section>

      <BloqueFaqExtra />
    </PaginaInstitucional>
  )
}

function BloqueFaqExtra() {
  return (
    <section>
      <h2 className="font-display text-lg mb-2">Dudas frecuentes</h2>
      <div className="divide-y divide-line border-t border-line">
        <Pregunta q="¿Puedo devolver una prenda en oferta?">
          <p>
            Sí, mientras conserve la etiqueta y no haya sido usada. El descuento se calcula sobre el
            precio efectivamente pagado.
          </p>
        </Pregunta>
        <Pregunta q="¿El cambio es sin cargo?">
          <p>
            El cambio por error de fábrica o de talle enviado por nosotros no tiene costo. Si el
            talle elegido no te quedó bien, el costo del transporte queda a tu cargo.
          </p>
        </Pregunta>
        <Pregunta q="¿Cómo pido la devolución?">
          <p>
            Escribinos por <Link to="/contacto" className="underline">contacto</Link> con tu número
            de pedido y te guiamos en el paso a paso.
          </p>
        </Pregunta>
      </div>
    </section>
  )
}
