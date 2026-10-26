import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { RESET_PASSWORD_PATH } from '../lib/authUrls'
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
  const { user, cargando, abrirAuthModal, recuperacionPendiente } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Si el enlace de recuperación cayó en otra ruta (por ejemplo, porque Supabase
  // usó el Site URL como fallback), llevamos al usuario al formulario correcto
  // antes de que el modal automático de auth lo intercepte.
  useEffect(() => {
    if (!recuperacionPendiente) return
    if (location.pathname.startsWith(RESET_PASSWORD_PATH)) return
    navigate(RESET_PASSWORD_PATH, { replace: true })
  }, [recuperacionPendiente, location.pathname, navigate])

  useEffect(() => {
    if (recuperacionPendiente) return
    if (cargando || user) return
    if (location.pathname.startsWith('/admin')) return
    if (location.pathname.startsWith('/checkout')) return
    if (location.pathname.startsWith(RESET_PASSWORD_PATH)) return
    if (sessionStorage.getItem(WELCOME_FLAG)) return

    sessionStorage.setItem(WELCOME_FLAG, '1')
    abrirAuthModal()
  }, [cargando, user, location.pathname, abrirAuthModal, recuperacionPendiente])

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

