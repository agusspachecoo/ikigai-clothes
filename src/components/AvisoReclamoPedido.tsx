import { useState } from 'react'
import { useAuth } from '../context/auth'
import { supabase } from '../lib/supabase'

interface Props {
  ordenId: string
  email: string
}

export function AvisoReclamoPedido({ ordenId, email }: Props) {
  const { user, abrirAuthModal } = useAuth()
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'enviado' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (user) return null

  async function enviarLink() {
    setEstado('enviando')
    setError(null)

    const redirectTo = `${window.location.origin}/checkout/pending?external_reference=${encodeURIComponent(ordenId)}`
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    })

    if (err) {
      setEstado('error')
      setError(err.message || 'No pudimos enviar el link.')
      return
    }

    setEstado('enviado')
  }

  if (estado === 'enviado') {
    return (
      <div className="alert alert-success alert-soft items-start">
        <span className="text-sm">
          Te enviamos un link a <strong>{email}</strong>. Abrilo desde este dispositivo para guardar
          el pedido en tu cuenta. Si no llega en unos minutos, revisá spam.
        </span>
      </div>
    )
  }

  return (
    <div className="alert alert-info alert-soft items-start">
      <div className="w-full">
        <p className="text-sm">
          ¿Querés guardar este pedido en tu cuenta? Te mandamos un link de acceso a{' '}
          <strong>{email}</strong>.
        </p>
        <p className="text-xs opacity-70 mt-1">
          El link confirma tu email y asocia el pedido sin crear una contraseña nueva.
        </p>
        {error && <p className="text-xs text-error mt-2">{error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={enviarLink}
            disabled={estado === 'enviando'}
          >
            {estado === 'enviando' && <span className="loading loading-spinner loading-xs" />}
            Enviarme el link
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => abrirAuthModal()}>
            Ya tengo cuenta
          </button>
        </div>
      </div>
    </div>
  )
}
