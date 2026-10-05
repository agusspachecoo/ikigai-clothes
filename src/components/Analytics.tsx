import { useCallback, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Analytics as VercelAnalytics } from '@vercel/analytics/react'
import { alCambiarConsentimiento, permitirAnaliticas } from '../lib/consentimiento'

const GA_ID = import.meta.env.VITE_GA_ID as string | undefined

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

/**
 * Inyecta el tag de GA4 una sola vez. Idempotente: si el script ya está en el
 * DOM no hace nada, así se puede llamar desde varios efectos.
 */
function cargarGtag() {
  if (!GA_ID) return
  if (document.getElementById('ga4-script')) return

  window.dataLayer = window.dataLayer ?? []
  // Cola de eventos hasta que el script real de Google la vacíe.
  window.gtag ??= function gtag(...args: unknown[]) {
    window.dataLayer?.push(args)
  }
  window.gtag('js', new Date())
  // send_page_view:false porque en una SPA las navegaciones las mandamos a
  // mano, si no se contaría dos veces cada ruta.
  window.gtag('config', GA_ID, { send_page_view: false })

  const script = document.createElement('script')
  script.id = 'ga4-script'
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(script)
}

/**
 * Analiticas: Vercel Web Analytics + GA4.
 *
 * Las dos quedan detrás del mismo consentimiento declarado en
 * `src/lib/consentimiento.ts`. Sin `VITE_GA_ID` configurado, GA4 no inyecta
 * nada, asi el build no rompe.
 */
export function Analytics() {
  const location = useLocation()
  const consentida = permitirAnaliticas()

  useEffect(() => {
    if (!GA_ID || !permitirAnaliticas()) return
    cargarGtag()
  }, [])

  useEffect(() => {
    return alCambiarConsentimiento((valor) => {
      if (!GA_ID) return
      if (valor === 'todo') {
        cargarGtag()
      } else if (valor === 'esencial') {
        // Cortar el seguimiento de la sesion en caliente. No alcanza con
        // vaciar el dataLayer: el tag ya cargado seguiria.reportando.
        window.gtag?.('consent', 'update', {
          analytics_storage: 'denied',
          ad_storage: 'denied',
        })
      }
    })
  }, [])

  const enviarPageView = useCallback(() => {
    window.gtag?.('event', 'page_view', {
      page_path: location.pathname + location.search,
      page_location: window.location.href,
      page_title: document.title,
    })
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!consentida) return
    // gtag puede no existir todavia en el primer render si el script sigue
    // cargando; en ese caso el evento queda encolado en dataLayer.
    enviarPageView()
  }, [consentida, enviarPageView])

  return (
    <VercelAnalytics
      /* Cortafuegos de privacidad: Vercel Analytics se inyecta siempre (es un
         script propio, sin cookies), pero beforeSend descarta cualquier evento
         si el usuario todavia no acepto. Asi el switch de consentimiento es
         real y no solo cosmetico. */
      beforeSend={(event) => (permitirAnaliticas() ? event : null)}
    />
  )
}
