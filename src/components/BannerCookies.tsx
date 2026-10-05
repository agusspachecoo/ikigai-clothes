import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  alAbrirPreferencias,
  guardarConsentimiento,
  leerConsentimiento,
  type Consentimiento,
} from '../lib/consentimiento'

/**
 * Aviso de cookies. Aparece una sola vez por navegador hasta que el usuario
 * cambia de decisión desde el footer.
 *
 * Solo aparece en la tienda, nunca en /admin: el panel es una herramienta
 * interna y ahí el banner estorba.
 */
export function BannerCookies() {
  // localStorage se lee en el inicializador perezoso: es codigo de cliente y
  // evita el setState dentro de un efecto (que provoke un segundo render).
  const [consentimiento, setConsentimiento] = useState<Consentimiento>(() => leerConsentimiento())
  const [visible, setVisible] = useState(() => leerConsentimiento() === null)

  useEffect(() => alAbrirPreferencias(() => setVisible(true)), [])

  const decidir = useCallback((valor: Exclude<Consentimiento, null>) => {
    guardarConsentimiento(valor)
    setConsentimiento(valor)
    setVisible(false)
  }, [])

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Preferencias de cookies"
      /* En mobile se levanta sobre la barra de navegación inferior (h-14, z-40)
         para no taparla; en desktop va al piso. */
      className="fixed inset-x-0 bottom-14 lg:bottom-0 z-50 p-3 lg:pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto max-w-3xl bg-neutral text-neutral-content border border-line shadow-xl">
        <div className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold mb-1">
            {consentimiento
              ? 'Tus preferencias de cookies'
              : 'Usamos almacenamiento local y cookies'}
          </h2>
          {consentimiento && (
            <p className="text-xs opacity-70 mb-2">
              Ahora tenés {consentimiento === 'todo' ? 'analítica activada' : 'solo lo esencial'}.
            </p>
          )}
          <p className="text-xs leading-relaxed opacity-80">
            Necesitamos guardar tu carrito y tus preferencias en este navegador para que la tienda
            funcione. Eso es esencial y no requiere permiso. Si aceptás además, usamos Google
            Analytics con cookies para entender cómo se usa el sitio. No vendemos tus datos ni
            usamos cookies publicitarias.{' '}
            <Link to="/politica-de-privacidad" className="underline">
              Ver política de privacidad
            </Link>
            .
          </p>

          <div className="flex flex-col-reverse gap-2 mt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => decidir('esencial')}
              className="btn btn-sm btn-outline border-neutral-content/30 text-neutral-content hover:border-neutral-content hover:bg-neutral-content hover:text-neutral rounded-none"
            >
              Solo lo esencial
            </button>
            <button
              type="button"
              onClick={() => decidir('todo')}
              className="btn btn-sm btn-primary rounded-none"
            >
              Aceptar todo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
