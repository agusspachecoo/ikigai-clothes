import type { ReactNode } from 'react'

const ICONO_CAMION = (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
  </svg>
)

const ICONO_TARJETA = (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
  </svg>
)

const ICONO_ESCUDO = (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
)

interface Beneficio {
  titulo: string
  icono: ReactNode
  texto: ReactNode
}

const BENEFICIOS: Beneficio[] = [
  {
    titulo: 'Logística',
    icono: ICONO_CAMION,
    texto: (
      <>
        Hacemos envíos a <strong className="text-neutral-900">TODA la Argentina</strong>{' '}
        <strong className="text-neutral-900">TODOS los días</strong> por{' '}
        <span className="whitespace-nowrap">
          <strong className="text-neutral-900">Correo Argentino</strong>,
        </span>{' '}
        <strong className="text-neutral-900">OCA</strong>, <strong className="text-neutral-900">y Andreani</strong>
        . Despachamos tu pedido en un plazo de{' '}
        <strong className="text-neutral-900">1 a 3 días hábiles</strong>.
      </>
    ),
  },
  {
    titulo: 'Pagos y Descuentos',
    icono: ICONO_TARJETA,
    texto: (
      <>
        Aceptamos <strong className="text-neutral-900">TODAS las tarjetas</strong> de crédito y débito,
        ofrecemos hasta <strong className="text-neutral-900">6 cuotas SIN INTERÉS</strong> y un{' '}
        <strong className="text-neutral-900">20% de descuento</strong> abonando con transferencia. También
        aceptamos <strong className="text-neutral-900">Mercado Pago</strong>.
      </>
    ),
  },
  {
    titulo: 'Seguridad y Atención',
    icono: ICONO_ESCUDO,
    texto: (
      <>
        La compra en Ikigai es <strong className="text-neutral-900">100% segura</strong>. Una vez que hacés
        una compra, te hacemos todo un <strong className="text-neutral-900">seguimiento de tu pedido</strong>{' '}
        por Mail, tu cuenta de la página y {' '}<strong className="text-neutral-900">WhatsApp</strong>.
      </>
    ),
  },
]

export function BeneficiosSection() {
  return (
    <section className="bg-gray-100 py-12">
      <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
        {BENEFICIOS.map((b) => (
          <div key={b.titulo}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white border border-base-300/70">
              {b.icono}
            </div>
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] mb-3">{b.titulo}</h3>
            <p className="text-sm md:text-base leading-relaxed text-neutral-600 max-w-md mx-auto">
              {b.texto}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}