import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { Checkout } from '../pages/Checkout'

export function CheckoutGuard() {
  const { user, cargando, abrirAuthModal } = useAuth()

  useEffect(() => {
    if (!cargando && !user) {
      abrirAuthModal()
    }
  }, [cargando, user, abrirAuthModal])

  if (cargando) {
    return (
      <div className="max-w-lg mx-auto px-4 py-40 text-center">
        <div className="loading loading-spinner loading-lg text-primary mx-auto" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-base-300 flex items-center justify-center mb-4">
          <svg className="h-8 w-8 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-3">Finalizar compra</h1>
        <p className="opacity-70 text-sm max-w-sm mx-auto mb-6">
          Debes iniciar sesión o crear una cuenta para continuar con tu compra. No perdés nada: tu
          carrito se mantiene guardado.
        </p>
        <div className="flex justify-center gap-2">
          <button className="btn btn-primary" onClick={() => abrirAuthModal()}>
            Iniciar sesión / Registrarse
          </button>
          <Link to="/catalogo" className="btn btn-ghost">
            Seguir comprando
          </Link>
        </div>
      </div>
    )
  }

  return <Checkout />
}