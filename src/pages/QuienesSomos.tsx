import { Link } from 'react-router-dom'
import { PaginaInstitucional } from '../components/PaginaInstitucional'
import { useTienda } from '../context/tienda'
import { NewsletterForm } from '../components/NewsletterForm'
import { formatearPrecio } from '../lib/precios'
import { useSeo } from '../hooks/useSeo'

export function QuienesSomos() {
  useSeo()

  const { umbral_envio_gratis, descuento_transferencia, nombre_tienda } = useTienda()

  const pilares = [
    {
      titulo: 'Hecho para durar',
      texto: 'Costuras reforzadas y calidades que se lavan bien y siguen en uso.',
    },
    {
      titulo: 'Precios sin vueltas',
      texto: `Transferencia con ${Math.round(descuento_transferencia * 100)}% de descuento y cuotas sin interés.`,
    },
    {
      titulo: 'Envíos a todo el país',
      texto:
        umbral_envio_gratis > 0
          ? `Envío gratis desde $${formatearPrecio(umbral_envio_gratis)} y retiro en showroom sin cargo.`
          : 'Envíos a todo el país y retiro en showroom sin cargo.',
    },
  ]

  return (
    <PaginaInstitucional
      titulo="Quiénes somos"
      bajada="Ikigai es la razón de estar detrás de cada prenda: clothes que se sienten tuyas desde el primer uso."
    >
      <p>
        {nombre_tienda} nació en Argentina con una idea simple: hacer ropa urbana y deportiva que
        funcione de verdad. Sin vueltas y sin prendas que duran una temporada.
      </p>

      <div className="grid sm:grid-cols-3 gap-4 py-2">
        {pilares.map((p) => (
          <div key={p.titulo} className="border border-line p-4 bg-base-100">
            <h2 className="text-xs uppercase tracking-widest font-semibold">{p.titulo}</h2>
            <p className="mt-2 text-sm opacity-70">{p.texto}</p>
          </div>
        ))}
      </div>

      <p>
        Cuando no te queda una prenda, te la cambiamos. Si algo no salió como esperabas, contanos
        y lo resolvemos: la confianza se construye con cada pedido.
      </p>

      <div className="border border-line p-6 bg-base-100">
        <h2 className="font-display text-lg">Sumate a la comunidad</h2>
        <p className="text-sm opacity-70 mt-1 mb-4">
          Drops, ofertas y liquidaciones antes que nadie.
        </p>
        <NewsletterForm className="max-w-sm" />
      </div>

      <p>
        ¿Querés conocernos más?{' '}
        <Link to="/contacto" className="underline">
          Escribinos
        </Link>{' '}
        o seguinos en redes.
      </p>
    </PaginaInstitucional>
  )
}
