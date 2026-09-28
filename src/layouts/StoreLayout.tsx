import { useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Header } from '../components/Header'
import { AuthModal } from '../components/AuthModal'
import { SocialLinks } from '../components/SocialLinks'
import { NewsletterForm } from '../components/NewsletterForm'
import { WhatsAppButton } from '../components/WhatsAppButton'
import { useAuth } from '../context/auth'
import { TiendaProvider } from '../context/TiendaContext'
import { useTienda } from '../context/tienda'
import { CONTACTO, WHATSAPP_URL } from '../lib/contacto'
import logoDark from '../assets/logo-transparent.png'

const WELCOME_FLAG = 'ikigai-auth-welcome-visto'

const NAV_ITEMS = [
  { to: '/', label: 'Inicio' },
  { to: '/catalogo', label: 'Productos' },
  { to: '/catalogo?descuentos=1', label: 'Descuentos' },
  { to: '/outfits', label: 'Comprá el Outfit' },
]

const PIE_ITEMS = [
  { to: '/contacto', label: 'Contacto' },
  { to: '/devoluciones', label: 'Política de Devolución' },
  { to: '/preguntas-frecuentes', label: 'Preguntas Frecuentes' },
  { to: '/quienes-somos', label: 'Quienes Somos' },
]

const LEGALES = [
  {
    label: 'Defensa de los consumidores',
    href: 'https://www.argentina.gob.ar/producucion/defensadelconsumidor/formulario',
  },
  { label: 'Botón de arrepentimiento', to: '/contacto?arrepentimiento=1' },
]

function Footer() {
  const { nombre_tienda } = useTienda()

  return (
    <footer className="bg-base-100 border-t border-line mt-auto">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-10">
          {/* Newsletter */}
          <div>
            <img src={logoDark} alt="Ikigai Clothes" className="h-12 w-auto" />
            <h3 className="mt-4 text-base">Suscribite a nuestro newsletter</h3>
            <p className="text-xs opacity-60 mt-1 mb-3 max-w-xs">
              Enterate de los drops, las ofertas y las liquidaciones antes que nadie.
            </p>
            <NewsletterForm />
            <SocialLinks className="mt-4" />
          </div>

          {/* Navegación */}
          <div>
            <h3 className="text-sm uppercase tracking-widest opacity-50 mb-3">Tienda</h3>
            <ul className="space-y-2 text-sm">
              {[...NAV_ITEMS, ...PIE_ITEMS].map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="link link-hover">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h3 className="text-sm uppercase tracking-widest opacity-50 mb-3">Contactános</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-hover"
                >
                  {CONTACTO.whatsappVisible}
                </a>
              </li>
              <li>
                <a href={`mailto:${CONTACTO.email}`} className="link link-hover">
                  {CONTACTO.email}
                </a>
              </li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Mercado Pago', 'Transferencia', '6 cuotas s/interés'].map((m) => (
                <span key={m} className="badge badge-outline badge-sm">
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-line py-5 flex flex-col gap-3 text-xs opacity-70 md:flex-row md:items-center md:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {nombre_tienda}. Todos los derechos reservados.
          </p>
          <ul className="flex flex-wrap gap-4">
            {LEGALES.map((l) => (
              <li key={l.label}>
                {l.to ? (
                  <Link to={l.to} className="link link-hover">
                    {l.label}
                  </Link>
                ) : (
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className="link link-hover">
                    {l.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}

export function StoreLayout() {
  const { user, cargando, abrirAuthModal } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (cargando || user) return
    if (location.pathname.startsWith('/admin')) return
    if (sessionStorage.getItem(WELCOME_FLAG)) return

    sessionStorage.setItem(WELCOME_FLAG, '1')
    abrirAuthModal()
  }, [cargando, user, location.pathname, abrirAuthModal])

  const esAdmin = location.pathname.startsWith('/admin')

  return (
    <TiendaProvider>
      <div className="min-h-screen bg-base-200 flex flex-col">
        <Header />

        {/* Main content */}
        <main className="flex-1 pb-14 lg:pb-0">
          <Outlet />
        </main>

        <AuthModal />

        {!esAdmin && <WhatsAppButton />}

        <Footer />
      </div>
    </TiendaProvider>
  )
}
