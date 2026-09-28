const PREGUNTAS = [
  {
    pregunta: '¿HAY DEVOLUCIÓN o CAMBIO si no me gusta o no me queda?',
    respuesta:
      'Por supuesto, tenés 10 días corridos una vez recibido el pedido para devolver o cambiar la prenda siempre y cuando esta se encuentre sin uso.',
  },
  {
    pregunta: '¿Cuánto tarda el ENVÍO?',
    respuesta:
      'Despachamos en 1 a 3 días hábiles. El tiempo final depende del correo seleccionado (entre 2 y 5 días hábiles a todo el país).',
  },
  {
    pregunta: '¿La prenda se va a achicar cuando la lave?',
    respuesta:
      'Nuestras prendas cuentan con tratamiento pre-encogido. Te recomendamos lavar con agua fría y no usar secadora para mantener su estado original.',
  },
  {
    pregunta: '¿Puedo rastrear mi pedido?',
    respuesta:
      'Sí, una vez despachado te enviamos el código de seguimiento por Mail y WhatsApp.',
  },
  {
    pregunta: '¿Mi compra es segura?',
    respuesta:
      'Sí, operamos con cobros encriptados mediante Mercado Pago e integraciones oficiales.',
  },
  {
    pregunta: '¿Qué pasa si mi producto llega con falla?',
    respuesta:
      'Nos escribís por WhatsApp dentro de las 48 hs de recibido y te realizamos el cambio sin costo adicional.',
  },
  {
    pregunta: '¿Aceptan tarjetas de crédito?',
    respuesta:
      'Aceptamos todas las tarjetas de crédito y débito, con opción de hasta 6 cuotas sin interés.',
  },
]

export function FAQSection() {
  return (
    <section className="mt-16">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold mb-6">Preguntas frecuentes</h2>

        <div className="flex flex-col gap-3">
          {PREGUNTAS.map((p, i) => (
            <div
              key={i}
              className="collapse collapse-arrow border border-base-300 bg-white rounded-xl shadow-sm"
            >
              <input
                type="checkbox"
                name={`faq-${i}`}
                aria-label={`Abrir pregunta: ${p.pregunta}`}
              />
              <div className="collapse-title text-sm md:text-base font-bold text-base-content">
                {p.pregunta}
              </div>
              <div className="collapse-content text-sm md:text-base leading-relaxed opacity-70">
                {p.respuesta}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}