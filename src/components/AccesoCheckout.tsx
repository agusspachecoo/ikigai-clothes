import { useState } from 'react'
import { useAuth } from '../context/auth'

export function AccesoCheckout() {
  const { user, cargando, abrirAuthModal } = useAuth()
  const [resuelto, setResuelto] = useState(false)

  if (cargando || user || resuelto) return null

  return (
    <section className="mb-8 rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-50">
            Acceso rápido
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-neutral-900">
            ¿Ya tenés cuenta?
          </h2>
          <p className="mt-1 text-sm leading-relaxed opacity-70">
            Iniciá sesión para autocompletar tus datos y ver el pedido en tu perfil. También podés
            comprar como invitado, sin registrarte.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setResuelto(true)
            }}
          >
            Continuar como invitado
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setResuelto(true)
              abrirAuthModal('login')
            }}
          >
            Iniciar sesión / Registrarse
          </button>
        </div>
      </div>

      <p className="mt-4 text-xs opacity-50">
        Tu carrito se mantiene en ambos casos. No hace falta registrarte para comprar.
      </p>
    </section>
  )
}
