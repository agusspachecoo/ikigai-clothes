import { Link } from 'react-router-dom'
import { SocialLinks } from './SocialLinks'
import { useTienda } from '../context/tienda'
import logoWhite from '../assets/logo-white.png'

const INSTITUCIONAL = [
  { label: 'Contacto', to: '/contacto' },
  { label: 'Preguntas Frecuentes', to: '/preguntas-frecuentes' },
  { label: 'Términos y Condiciones', to: '/terminos-y-condiciones' },
  { label: 'Política de Privacidad', to: '/politica-de-privacidad' },
  { label: 'Política de Devolución', to: '/devoluciones' },
  { label: 'Quiénes Somos', to: '/quienes-somos' },
]

export function Footer() {
  const { nombre_tienda } = useTienda()
  const year = new Date().getFullYear()

  return (
    <footer className="bg-neutral text-neutral-content mt-auto border-t border-white/10">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 py-12 md:py-16">
          <div className="lg:col-span-2">
            <Link to="/" aria-label="Ikigai Clothes - Inicio" className="inline-flex items-center">
              <img
                src={logoWhite}
                alt="Ikigai Clothes"
                loading="lazy"
                decoding="async"
                width={500}
                height={500}
                onError={(e) => {
                  ;(e.currentTarget as HTMLElement).style.display = 'none'
                }}
                className="h-12 md:h-14 w-auto"
              />
            </Link>
            <p className="mt-4 max-w-md text-sm text-neutral-content/70 leading-relaxed">
              Ropa urbana con identidad propia. Prendas pensadas para durar, con drops exclusivos y envíos a todo el país.
            </p>
            <SocialLinks className="mt-6" />
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-[0.25em] text-neutral-content/60 mb-4">
              Institucional
            </h3>
            <ul className="space-y-2.5">
              {INSTITUCIONAL.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="text-sm transition-colors hover:text-white text-neutral-content/80"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-[0.25em] text-neutral-content/60 mb-4">
              Ayuda
            </h3>
            <ul className="space-y-2.5">
              <li>
                <Link
                  to="/contacto"
                  className="text-sm transition-colors hover:text-white text-neutral-content/80"
                >
                  Contacto
                </Link>
              </li>
              <li>
                <Link
                  to="/preguntas-frecuentes"
                  className="text-sm transition-colors hover:text-white text-neutral-content/80"
                >
                  Preguntas Frecuentes
                </Link>
              </li>
              <li>
                <Link
                  to="/devoluciones"
                  className="text-sm transition-colors hover:text-white text-neutral-content/80"
                >
                  Política de Devolución
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-content/60">
          <p>
            © {year} {nombre_tienda || 'Ikigai Clothes'}. Todos los derechos reservados.
          </p>
          <p className="text-center sm:text-right">Diseñado y desarrollado para Ikigai Clothes</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
