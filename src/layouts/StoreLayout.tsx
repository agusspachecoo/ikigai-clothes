import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from '../components/Header'
import { Footer } from '../components/Footer'
import { AuthModal } from '../components/AuthModal'
import { WhatsAppButton } from '../components/WhatsAppButton'
import { BannerCookies } from '../components/BannerCookies'
import { Analytics } from '../components/Analytics'
import { useAuth } from '../context/auth'
import { TiendaProvider } from '../context/TiendaContext'

const WELCOME_FLAG = 'ikigai-auth-welcome-visto'

export function StoreLayout() {
  const { user, cargando, abrirAuthModal } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (cargando || user) return
    if (location.pathname.startsWith('/admin')) return
    if (location.pathname.startsWith('/checkout')) return
    if (location.pathname.startsWith('/restablecer-password')) return
    if (sessionStorage.getItem(WELCOME_FLAG)) return

    sessionStorage.setItem(WELCOME_FLAG, '1')
    abrirAuthModal()
  }, [cargando, user, location.pathname, abrirAuthModal])

  const esAdmin = location.pathname.startsWith('/admin')

  return (
    <TiendaProvider>
      <div className="min-h-screen bg-base-200 flex flex-col">
        <Header />

        <main className="flex-1 pb-14 lg:pb-0">
          <Outlet />
        </main>

        <AuthModal />

        {!esAdmin && <Analytics />}
        {!esAdmin && <WhatsAppButton />}

        <Footer />
        {!esAdmin && <BannerCookies />}
      </div>
    </TiendaProvider>
  )
}

export default StoreLayout

